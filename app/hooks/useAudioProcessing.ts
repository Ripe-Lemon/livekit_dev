// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';

export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    voiceIsolation: boolean;
    microphoneThreshold: number;
    sampleRate: number;
    channelCount: number;
    latency: number;
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => Promise<void>;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
    isProcessingActive: boolean;
    isInitialized: boolean;
    audioLevel: number;
}

const DEFAULT_SETTINGS: AudioProcessingSettings = {
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: false, // 只能在获取原始流时设置
    voiceIsolation: false,
    microphoneThreshold: 0.3,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0.01
};

const STORAGE_KEY = 'livekit_audio_processing_settings';

export function useAudioProcessing(): AudioProcessingControls {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    // 状态管理
    const [settings, setSettings] = useState<AudioProcessingSettings>(() => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });
    
    const [applyingSettings, setApplyingSettings] = useState<Set<string>>(new Set());
    const [isProcessingActive, setIsProcessingActive] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    
    // Web Audio API 节点引用
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    
    // 音频处理节点
    const gainNodeRef = useRef<GainNode | null>(null);
    const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
    const highpassFilterRef = useRef<BiquadFilterNode | null>(null);
    const lowpassFilterRef = useRef<BiquadFilterNode | null>(null);
    const gateNodeRef = useRef<GainNode | null>(null);
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    
    // 其他引用
    const originalStreamRef = useRef<MediaStream | null>(null);
    const processedTrackRef = useRef<LocalAudioTrack | null>(null);
    const isInitializingRef = useRef<boolean>(false);
    const animationFrameRef = useRef<number | null>(null);
    const audioDataRef = useRef<Uint8Array | null>(null);

    // 保存设置到本地存储
    const saveSettings = useCallback((newSettings: AudioProcessingSettings) => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
            } catch (error) {
                console.warn('保存音频处理设置失败:', error);
            }
        }
    }, []);

    // 获取当前音频设备ID
    const getCurrentAudioDeviceId = useCallback((): string => {
        if (processedTrackRef.current?.mediaStreamTrack) {
            const trackSettings = processedTrackRef.current.mediaStreamTrack.getSettings();
            if (trackSettings.deviceId) {
                return trackSettings.deviceId;
            }
        }
        
        try {
            const storedDevices = localStorage.getItem('livekit_selected_devices');
            if (storedDevices) {
                const parsed = JSON.parse(storedDevices);
                if (parsed.audioinput) {
                    return parsed.audioinput;
                }
            }
        } catch (error) {
            console.warn('读取存储的设备选择失败:', error);
        }
        
        return 'default';
    }, []);

    // 初始化 Web Audio API 处理链
    const initializeAudioProcessingChain = useCallback(async () => {
        console.log('🎛️ 初始化音频处理链...');
        
        try {
            // 创建音频上下文
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: settings.sampleRate,
                latencyHint: 'interactive'
            });

            const audioContext = audioContextRef.current;

            // 创建音频处理节点链
            gainNodeRef.current = audioContext.createGain();
            compressorNodeRef.current = audioContext.createDynamicsCompressor();
            highpassFilterRef.current = audioContext.createBiquadFilter();
            lowpassFilterRef.current = audioContext.createBiquadFilter();
            gateNodeRef.current = audioContext.createGain();
            analyserNodeRef.current = audioContext.createAnalyser();
            destinationNodeRef.current = audioContext.createMediaStreamDestination();

            // 配置分析器
            analyserNodeRef.current.fftSize = 256;
            analyserNodeRef.current.smoothingTimeConstant = 0.8;
            audioDataRef.current = new Uint8Array(analyserNodeRef.current.frequencyBinCount);

            // 配置滤波器（噪声抑制）
            highpassFilterRef.current.type = 'highpass';
            highpassFilterRef.current.frequency.value = 85; // 去除低频噪音
            highpassFilterRef.current.Q.value = 0.7;

            lowpassFilterRef.current.type = 'lowpass';
            lowpassFilterRef.current.frequency.value = 8000; // 去除高频噪音
            lowpassFilterRef.current.Q.value = 0.7;

            // 配置压缩器（自动增益控制）
            compressorNodeRef.current.threshold.value = -24;
            compressorNodeRef.current.knee.value = 30;
            compressorNodeRef.current.ratio.value = 12;
            compressorNodeRef.current.attack.value = 0.003;
            compressorNodeRef.current.release.value = 0.25;

            // 配置增益节点
            gainNodeRef.current.gain.value = 1.0;
            gateNodeRef.current.gain.value = 1.0;

            console.log('✅ 音频处理链节点创建完成');
            return true;
        } catch (error) {
            console.error('❌ 音频处理链初始化失败:', error);
            throw error;
        }
    }, [settings.sampleRate]);

    // 连接音频处理链
    const connectAudioChain = useCallback(() => {
        if (!sourceNodeRef.current || !destinationNodeRef.current) return;

        console.log('🔗 连接音频处理链...');

        // 构建处理链：输入 → 分析器 → 增益 → 高通滤波 → 低通滤波 → 压缩器 → 噪声门 → 输出
        sourceNodeRef.current.connect(analyserNodeRef.current!);
        analyserNodeRef.current!.connect(gainNodeRef.current!);
        gainNodeRef.current!.connect(highpassFilterRef.current!);
        highpassFilterRef.current!.connect(lowpassFilterRef.current!);
        lowpassFilterRef.current!.connect(compressorNodeRef.current!);
        compressorNodeRef.current!.connect(gateNodeRef.current!);
        gateNodeRef.current!.connect(destinationNodeRef.current);

        console.log('✅ 音频处理链已连接');
    }, []);

    // 🎯 实时更新音频处理参数（不重建轨道）
    const updateProcessingChain = useCallback(() => {
        if (!isInitialized) return;

        console.log('⚙️ 实时更新音频处理参数:', settings);

        // 1. 自动增益控制（通过压缩器实现）
        if (compressorNodeRef.current) {
            if (settings.autoGainControl) {
                compressorNodeRef.current.threshold.value = -24;
                compressorNodeRef.current.ratio.value = 12;
                compressorNodeRef.current.attack.value = 0.003;
                compressorNodeRef.current.release.value = 0.25;
                gainNodeRef.current!.gain.value = 1.2; // 稍微提升音量
            } else {
                compressorNodeRef.current.threshold.value = -50; // 几乎不压缩
                compressorNodeRef.current.ratio.value = 1;
                gainNodeRef.current!.gain.value = 1.0;
            }
        }

        // 2. 噪声抑制（通过滤波器实现）
        if (highpassFilterRef.current && lowpassFilterRef.current) {
            if (settings.noiseSuppression) {
                highpassFilterRef.current.frequency.value = 85; // 过滤低频噪音
                lowpassFilterRef.current.frequency.value = 8000; // 过滤高频噪音
                highpassFilterRef.current.Q.value = 0.7;
                lowpassFilterRef.current.Q.value = 0.7;
            } else {
                highpassFilterRef.current.frequency.value = 20; // 最小值
                lowpassFilterRef.current.frequency.value = 20000; // 最大值
                highpassFilterRef.current.Q.value = 0.1;
                lowpassFilterRef.current.Q.value = 0.1;
            }
        }

        // 3. 语音隔离（强化的噪声抑制）
        if (settings.voiceIsolation && highpassFilterRef.current && lowpassFilterRef.current && compressorNodeRef.current) {
            highpassFilterRef.current.frequency.value = 120; // 更激进的低频过滤
            lowpassFilterRef.current.frequency.value = 6000; // 更激进的高频过滤
            compressorNodeRef.current.threshold.value = -18; // 更强的压缩
            compressorNodeRef.current.ratio.value = 16;
        }

        console.log('✅ 音频处理参数已实时更新');
    }, [settings, isInitialized]);

    // 实时音频监控和噪声门控
    const startAudioMonitoring = useCallback(() => {
        if (!analyserNodeRef.current || !audioDataRef.current || !gateNodeRef.current || !audioContextRef.current) return;

        const processFrame = () => {
            if (!isProcessingActive || !analyserNodeRef.current || !audioDataRef.current || !gateNodeRef.current || !audioContextRef.current) return;

            // 获取音频数据
            analyserNodeRef.current.getByteFrequencyData(audioDataRef.current);
            
            // 计算音量级别（RMS）
            let sum = 0;
            for (let i = 0; i < audioDataRef.current.length; i++) {
                sum += audioDataRef.current[i] * audioDataRef.current[i];
            }
            const rms = Math.sqrt(sum / audioDataRef.current.length);
            const volume = rms / 255; // 归一化到 0-1

            // 更新音量状态
            setAudioLevel(volume);

            // 实现噪声门控（基于麦克风门限）
            if (volume < settings.microphoneThreshold) {
                // 音量低于门限，渐进式降低音量（避免突然切断）
                const targetGain = Math.max(0, volume / settings.microphoneThreshold * 0.1);
                gateNodeRef.current.gain.exponentialRampToValueAtTime(
                    targetGain, 
                    audioContextRef.current.currentTime + 0.1
                );
            } else {
                // 音量高于门限，恢复正常音量
                gateNodeRef.current.gain.exponentialRampToValueAtTime(
                    1.0, 
                    audioContextRef.current.currentTime + 0.05
                );
            }

            // 继续下一帧
            animationFrameRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();
    }, [isProcessingActive, settings.microphoneThreshold]);

    // 🎯 核心：初始化音频处理（只执行一次）
    const initializeAudioProcessing = useCallback(async () => {
        if (isInitializingRef.current || isInitialized || !localParticipant || !room) {
            return;
        }

        isInitializingRef.current = true;

        try {
            console.log('🎛️ 开始初始化音频处理系统...');

            // 1. 初始化 Web Audio API 处理链
            await initializeAudioProcessingChain();

            // 2. 获取原始音频流（包含原生浏览器处理）
            const deviceId = getCurrentAudioDeviceId();
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
                    echoCancellation: false,//settings.echoCancellation, // 🎯 只在获取流时设置
                    sampleRate: { ideal: settings.sampleRate },
                    channelCount: { exact: 1 } // 强制单声道
                }
            };

            console.log('🎤 获取原始音频流，约束:', constraints);
            const originalStream = await navigator.mediaDevices.getUserMedia(constraints);
            originalStreamRef.current = originalStream;

            // 3. 连接到 Web Audio API 处理链
            sourceNodeRef.current = audioContextRef.current!.createMediaStreamSource(originalStream);
            connectAudioChain();

            // 4. 获取处理后的音频流
            const processedStream = destinationNodeRef.current!.stream;

            // 5. 🎯 关键：从处理后的流创建音频轨道（只创建一次）
            const processedAudioTrack = processedStream.getAudioTracks()[0];
            if (!processedAudioTrack) {
                throw new Error('无法获取处理后的音频轨道');
            }

            // 包装为 LocalAudioTrack
            processedTrackRef.current = new LocalAudioTrack(
                processedAudioTrack,
                undefined,
                false // 不是来自屏幕共享
            );

            // 6. 🎯 一次性发布到 LiveKit（后续不再重建）
            await localParticipant.publishTrack(processedTrackRef.current, {
                name: 'microphone',
                source: Track.Source.Microphone,
                stopMicTrackOnMute: true
            });

            // 7. 应用初始处理设置
            updateProcessingChain();

            // 8. 开始实时监控
            startAudioMonitoring();

            setIsProcessingActive(true);
            setIsInitialized(true);

            console.log('✅ 音频处理系统初始化完成 - 轨道已发布，后续只更新处理参数');

        } catch (error) {
            console.error('❌ 音频处理系统初始化失败:', error);
            setIsProcessingActive(false);
            throw error;
        } finally {
            isInitializingRef.current = false;
        }
    }, [
        localParticipant, 
        room, 
        isInitialized, 
        settings.echoCancellation, 
        settings.sampleRate, 
        settings.latency,
        initializeAudioProcessingChain,
        getCurrentAudioDeviceId,
        connectAudioChain,
        updateProcessingChain,
        startAudioMonitoring
    ]);

    // 🎯 更新单个设置（只更新处理参数，不重建轨道）
    const updateSetting = useCallback(async (
        key: keyof AudioProcessingSettings, 
        value: boolean | number
    ) => {
        if (applyingSettings.has(key)) {
            console.log(`⏳ ${key} 设置正在应用中，跳过`);
            return;
        }

        const settingKey = key;
        setApplyingSettings(prev => new Set(prev).add(settingKey));

        try {
            const newSettings = { ...settings, [key]: value };
            
            // 立即更新本地状态和存储
            setSettings(newSettings);
            saveSettings(newSettings);

            // 🎯 关键：只更新处理参数，不重建轨道
            if (isInitialized) {
                console.log(`🔄 实时更新 ${key} 设置: ${value}`);
                
                // 直接调用处理链更新，使用新设置
                if (key === 'autoGainControl' && compressorNodeRef.current && gainNodeRef.current) {
                    if (value) {
                        compressorNodeRef.current.threshold.value = -24;
                        compressorNodeRef.current.ratio.value = 12;
                        gainNodeRef.current.gain.value = 1.2;
                    } else {
                        compressorNodeRef.current.threshold.value = -50;
                        compressorNodeRef.current.ratio.value = 1;
                        gainNodeRef.current.gain.value = 1.0;
                    }
                } else if (key === 'noiseSuppression' && highpassFilterRef.current && lowpassFilterRef.current) {
                    if (value) {
                        highpassFilterRef.current.frequency.value = 85;
                        lowpassFilterRef.current.frequency.value = 8000;
                    } else {
                        highpassFilterRef.current.frequency.value = 20;
                        lowpassFilterRef.current.frequency.value = 20000;
                    }
                } else if (key === 'voiceIsolation') {
                    // 语音隔离需要完整更新处理链
                    updateProcessingChain();
                }
                // microphoneThreshold 会在实时监控中自动使用新值
                
                console.log(`✅ ${key} 设置已实时生效: ${value}`);
            } else {
                console.log(`💾 ${key} 设置已保存，将在初始化时生效: ${value}`);
            }

        } catch (error) {
            console.error(`❌ 更新 ${key} 设置失败:`, error);
            setSettings(settings); // 回滚
            throw error;
        } finally {
            setApplyingSettings(prev => {
                const newSet = new Set(prev);
                newSet.delete(settingKey);
                return newSet;
            });
        }
    }, [settings, applyingSettings, saveSettings, isInitialized, updateProcessingChain]);

    // 检查是否正在应用设置
    const isApplying = useCallback((key: keyof AudioProcessingSettings) => {
        return applyingSettings.has(key);
    }, [applyingSettings]);

    // 重置为默认设置
    const resetToDefaults = useCallback(async () => {
        console.log('🔄 重置音频处理设置为默认值');
        
        try {
            setSettings(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
            
            if (isInitialized) {
                // 🎯 只更新处理参数，不重建轨道
                updateProcessingChain();
            }
            
            console.log('✅ 已重置为默认设置');
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, isInitialized, updateProcessingChain]);

    // 监听房间连接状态，自动初始化
    useEffect(() => {
        if (!localParticipant || !room || room.state !== 'connected') {
            return;
        }

        if (isInitialized || isInitializingRef.current) {
            return;
        }

        console.log('🎛️ 房间已连接，准备初始化音频处理');

        const timer = setTimeout(() => {
            initializeAudioProcessing().catch(error => {
                console.error('❌ 音频处理自动初始化失败:', error);
            });
        }, 1500);

        return () => clearTimeout(timer);
    }, [localParticipant, room, room?.state, isInitialized, initializeAudioProcessing]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            
            // 停止实时监控
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            
            // 清理 Web Audio API 节点
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
                sourceNodeRef.current = null;
            }
            
            // 关闭音频上下文
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            
            // 停止原始流
            if (originalStreamRef.current) {
                originalStreamRef.current.getTracks().forEach(track => track.stop());
                originalStreamRef.current = null;
            }
            
            // 清理轨道引用
            if (processedTrackRef.current) {
                processedTrackRef.current = null;
            }
            
            // 重置所有节点引用
            gainNodeRef.current = null;
            compressorNodeRef.current = null;
            highpassFilterRef.current = null;
            lowpassFilterRef.current = null;
            gateNodeRef.current = null;
            analyserNodeRef.current = null;
            destinationNodeRef.current = null;
            audioDataRef.current = null;
            
            setIsProcessingActive(false);
            setIsInitialized(false);
            isInitializingRef.current = false;
        };
    }, []);

    return {
        settings,
        updateSetting,
        isApplying,
        resetToDefaults,
        isProcessingActive,
        isInitialized,
        audioLevel
    };
}