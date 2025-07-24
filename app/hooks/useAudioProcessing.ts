// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';
import { MicVAD } from '@ricky0123/vad-web';

export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    vadEnabled: boolean;
    vadPositiveSpeechThreshold: number; 
    vadNegativeSpeechThreshold: number;
    // VAD 静音延迟，值越大，语音结束后等待时间越长
    vadRedemptionFrames: number;
    sampleRate: number;
    channels: number;
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => Promise<void>;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
    isProcessingActive: boolean;
    isInitialized: boolean;
    audioLevel: number;
    isVADActive: boolean;
}

const DEFAULT_SETTINGS: Omit<AudioProcessingSettings, 'echoCancellation'> = {
    autoGainControl: true,
    noiseSuppression: true,
    vadEnabled: true,
    vadPositiveSpeechThreshold: 0.5, // 官方默认值
    vadNegativeSpeechThreshold: 0.35,
    vadRedemptionFrames: 8,          // 官方默认值
    sampleRate: 48000,
    channels: 1,
};

const STORAGE_KEY = 'livekit_audio_processing_settings';
type StoredSettings = Partial<AudioProcessingSettings & { microphoneThreshold?: number }>;

export function useAudioProcessing(): AudioProcessingControls {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    // 状态管理
    const [settings, setSettings] = useState<AudioProcessingSettings>(() => {
        if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS, echoCancellation: false };
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: StoredSettings = JSON.parse(stored);
                // 移除已废弃的 microphoneThreshold 属性
                delete parsed.microphoneThreshold;
                return { ...DEFAULT_SETTINGS, echoCancellation: false, ...parsed };
            }
            return { ...DEFAULT_SETTINGS, echoCancellation: false };
        } catch {
            return { ...DEFAULT_SETTINGS, echoCancellation: false };
        }
    });
    
    const [applyingSettings, setApplyingSettings] = useState<Set<string>>(new Set());
    const [isProcessingActive, setIsProcessingActive] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    
    const [isVADActive, setIsVADActive] = useState(false);

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
    const vadRef = useRef<MicVAD | null>(null); // 引用类型更新为 MicVAD
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
        // 1. 优先检查用户是否手动选择了设备
        try {
            const storedDevices = localStorage.getItem('livekit_selected_devices');
            if (storedDevices) {
                const parsed = JSON.parse(storedDevices);
                if (parsed.audioinput && parsed.audioinput !== 'default') {
                    console.log('🎤 使用用户选择的设备:', parsed.audioinput);
                    return parsed.audioinput;
                }
            }
        } catch (error) {
            console.warn('读取存储的设备选择失败:', error);
        }
        
        // 2. 检查当前轨道设备
        if (processedTrackRef.current?.mediaStreamTrack) {
            const trackSettings = processedTrackRef.current.mediaStreamTrack.getSettings();
            if (trackSettings.deviceId) {
                console.log('🎤 使用当前轨道设备:', trackSettings.deviceId);
                return trackSettings.deviceId;
            }
        }
        
        // 3. 🎯 默认返回 'default' 设备（系统默认麦克风）
        console.log('🎤 使用系统默认麦克风设备');
        return 'default';
    }, []);

    const controlGate = useCallback((action: 'open' | 'close') => {
        // 使用函数式更新，避免isVADActive的陈旧状态问题
        if (action === 'open') {
            setIsVADActive(true);
        } else {
            setIsVADActive(false);
        }

        if (gateNodeRef.current && audioContextRef.current?.state === 'running') {
            const gateNode = gateNodeRef.current;
            const audioContext = audioContextRef.current;
            const targetGain = action === 'open' ? 1.0 : 0.0001;
            const delay = action === 'open' ? 0.1 : 0.5;
            gateNode.gain.exponentialRampToValueAtTime(targetGain, audioContext.currentTime + delay);
        }
    }, []);

    // 🎯 2. 修正：更新 VAD 初始化和启动逻辑
    const initializeVAD = useCallback(async (stream: MediaStream) => {
        if (vadRef.current) {
            // 先暂停并销毁旧实例
            vadRef.current.destroy();
        }

        try {
            console.log('🎤 正在加载 VAD 模型并应用设置:', {
                positiveSpeechThreshold: settings.vadPositiveSpeechThreshold,
                redemptionFrames: settings.vadRedemptionFrames
            });
            
            // 使用 MicVAD.new() 并直接在构造函数中传入 stream
            const vad = await MicVAD.new({
                // 关键：在这里传入我们自己创建的音频流
                stream: stream,

                // --- 回调函数 ---
                onSpeechStart: () => {
                    console.log('VAD: 检测到语音开始');
                    controlGate('open');
                },
                onSpeechEnd: (audio) => { // audio 参数是录制的音频数据，我们用不上但可以接收
                    console.log('VAD: 检测到语音结束');
                    controlGate('close');
                },
                // 建议：添加对 VADMisfire 的处理，用于调试
                onVADMisfire: () => {
                    console.log('VAD Misfire: 检测到过短的语音片段，已忽略');
                    controlGate('close');
                },
                ...settings,

                // 其他参数可保持默认或根据需要暴露
                minSpeechFrames: 3,            //
                preSpeechPadFrames: 1,         //
            });
            
            // 实例创建后直接启动监听
            vad.start();
            vadRef.current = vad;
            console.log('✅ VAD 模型加载并启动成功');
            
        } catch (error) {
            console.error('❌ VAD 初始化失败:', error);
            // VAD失败时，默认打开音频门，以保证通话可用性
            controlGate('open');
        }

    }, [controlGate, settings]);

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

            gateNodeRef.current.gain.value = 0.0;

            // 配置分析器
            analyserNodeRef.current.fftSize = 256;
            analyserNodeRef.current.smoothingTimeConstant = 0.8;
            audioDataRef.current = new Uint8Array(analyserNodeRef.current.frequencyBinCount);

            // 配置滤波器（噪声抑制）
            highpassFilterRef.current.type = 'highpass';
            highpassFilterRef.current.frequency.value = 85; // 去除低频噪音
            highpassFilterRef.current.Q.value = 0.7;

            lowpassFilterRef.current.type = 'lowpass';
            lowpassFilterRef.current.frequency.value = 16000; // 去除高频噪音
            lowpassFilterRef.current.Q.value = 0.7;

            // 配置压缩器（自动增益控制）
            compressorNodeRef.current.threshold.value = -24;
            compressorNodeRef.current.knee.value = 30;
            compressorNodeRef.current.ratio.value = 12;
            compressorNodeRef.current.attack.value = 0.003;
            compressorNodeRef.current.release.value = 0.25;

            // 配置增益节点
            gainNodeRef.current.gain.value = 1.0;
            
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

        console.log('✅ 音频处理参数已实时更新');
    }, [settings, isInitialized]);

    // 实时音频监控和噪声门控
    const startAudioMonitoring = useCallback(() => {
        if (!analyserNodeRef.current || !audioDataRef.current) return;
        const analyser = analyserNodeRef.current;
        const audioData = audioDataRef.current;
        
        const processFrame = () => {
            if (analyser) {
                analyser.getByteFrequencyData(audioData);
                let sum = 0;
                for (let i = 0; i < audioData.length; i++) {
                    sum += audioData[i] * audioData[i];
                }
                const rms = Math.sqrt(sum / audioData.length);
                // 直接更新状态，这是性能瓶颈的来源，但我们需要它
                // UI层的优化将解决这个问题
                setAudioLevel(rms / 255);
            }
            animationFrameRef.current = requestAnimationFrame(processFrame);
        };
        processFrame();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    // 🎯 新增：确保 AudioContext 处于运行状态的函数
    const ensureAudioContextRunning = useCallback(async () => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            console.log('AudioContext is suspended, attempting to resume...');
            try {
                await audioContextRef.current.resume();
                console.log('✅ AudioContext resumed successfully.');
            } catch (e) {
                console.error('❌ Failed to resume AudioContext:', e);
            }
        }
    }, []);

    // 🎯 核心：初始化音频处理（只执行一次）
    const initializeAudioProcessing = useCallback(async () => {
        if (isInitializingRef.current || isInitialized || !localParticipant || !room) return;
        isInitializingRef.current = true;
        
        try {
            console.log('🎛️ 开始初始化自定义音频处理系统...');
            // 清理现有轨道...
            const existingAudioPublications = Array.from(localParticipant.audioTrackPublications.values());
            for (const pub of existingAudioPublications) {
                if (pub.track) {
                    await localParticipant.unpublishTrack(pub.track);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200));

            // 🎯 步骤2：初始化 Web Audio API 处理链
            await initializeAudioProcessingChain();

            // 🎯 步骤3：获取原始音频流（使用默认设备，禁用浏览器处理）
            const deviceId = getCurrentAudioDeviceId();
            const constraints: MediaStreamConstraints = {
                audio: {
                    // 🎯 设备选择
                    deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
                    
                    // 🎯 关键：禁用所有浏览器原生音频处理
                    echoCancellation: false,  // 禁用回声抑制
                    noiseSuppression: false,  // 禁用噪声抑制  
                    autoGainControl: false,   // 禁用自动增益
                    
                    // 音频质量设置
                    sampleRate: { ideal: settings.sampleRate },
                    channelCount: { exact: 1 } // 强制单声道
                }
            };

            console.log('🎤 获取原始音频流（已禁用浏览器处理）:', constraints);
            const originalStream = await navigator.mediaDevices.getUserMedia(constraints);
            originalStreamRef.current = originalStream;
            await ensureAudioContextRunning();

            // 🎯 步骤4：连接到 Web Audio API 处理链
            sourceNodeRef.current = audioContextRef.current!.createMediaStreamSource(originalStream);
            connectAudioChain();

            if (settings.vadEnabled) {
                await initializeVAD(originalStream);
            } else {
                // 如果VAD被禁用，则手动打开门
                controlGate('open');
            }
            
            // 发布轨道
            const processedStream = destinationNodeRef.current!.stream;
            const processedAudioTrack = processedStream.getAudioTracks()[0];
            processedTrackRef.current = new LocalAudioTrack(processedAudioTrack, undefined, false);
            await localParticipant.publishTrack(processedTrackRef.current, { name: 'custom-microphone-vad', source: Track.Source.Microphone, stopMicTrackOnMute: false });

            // 更新和启动监控
            updateProcessingChain();
            startAudioMonitoring();

            setIsProcessingActive(true);
            setIsInitialized(true);
            console.log('✅ 自定义音频处理系统初始化完成');
        } catch (error) {
            console.error('❌ 自定义音频处理系统初始化失败:', error);
            setIsProcessingActive(false);
            throw error;
        } finally {
            isInitializingRef.current = false;
        }
    }, [
        localParticipant, 
        room, 
        isInitialized, 
        settings,
        initializeVAD, 
        controlGate,
        initializeAudioProcessingChain,
        getCurrentAudioDeviceId,
        connectAudioChain,
        updateProcessingChain,
        startAudioMonitoring,
        ensureAudioContextRunning
    ]);

    // 🎯 更新单个设置（只更新处理参数，不重建轨道）
    const updateSetting = useCallback(async (key: keyof AudioProcessingSettings, value: boolean | number): Promise<void> => {
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, [key]: value };
            saveSettings(newSettings);
            return newSettings;
        });
    }, []);

    // 使用专门的useEffect来响应设置变化
    useEffect(() => {
        if (!isInitialized) return;

        const handleSettingsChange = async () => {
            // 如果VAD被启用，则根据最新设置重新初始化
            if (settings.vadEnabled) {
                if (originalStreamRef.current) {
                    console.log('VAD settings changed, re-initializing VAD...');
                    await initializeVAD(originalStreamRef.current);
                }
            } else { // 如果VAD被禁用
                if (vadRef.current) {
                    vadRef.current.destroy();
                    vadRef.current = null;
                }
                controlGate('open'); // 手动打开门
                console.log('VAD is disabled, gate opened.');
            }
        };
        
        handleSettingsChange();

    }, [settings, isInitialized, initializeVAD, controlGate]); // 监听整个settings对象的变化

    // 检查是否正在应用设置
    const isApplying = useCallback((key: keyof AudioProcessingSettings) => {
        return applyingSettings.has(key);
    }, [applyingSettings]);

    // 重置为默认设置
    const resetToDefaults = useCallback(async () => {
        console.log('🔄 重置音频处理设置为默认值');
        
        try {
            const defaultWithEcho = { ...DEFAULT_SETTINGS, echoCancellation: false };
            setSettings(defaultWithEcho);
            saveSettings(defaultWithEcho);
            
            if (isInitialized) {
                updateProcessingChain();
                if (DEFAULT_SETTINGS.vadEnabled) {
                    if(originalStreamRef.current) await initializeVAD(originalStreamRef.current);
                } else {
                    if(vadRef.current) vadRef.current.destroy();
                    controlGate('open');
                }
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
            
            if (vadRef.current) {
                vadRef.current.destroy(); // destroy 会处理暂停和资源释放
                vadRef.current = null;
            }
            
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
        audioLevel,
        isVADActive
    };
}