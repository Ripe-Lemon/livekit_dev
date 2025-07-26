// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';

export interface AudioProcessingSettings {
    preamp: number; // 前置增益
    postamp: number;
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    vadEnabled: boolean;
    vadAttackTime: number;      // 语音持续超过此时长才开门 (ms)
    vadReleaseTime: number;     // 语音低于阈值超过此时长才关门 (ms)
    vadActivationThreshold: number;   // 激活VAD的音量阈值 (上门限)
    vadDeactivationThreshold: number; // 停止VAD的音量阈值 (下门限)
    sampleRate: number;
    channels: number;
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => void;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    isProcessingActive: boolean;
    isInitialized: boolean;
    audioLevel: number;
    isVADActive: boolean;
}

const DEFAULT_SETTINGS: Omit<AudioProcessingSettings, 'echoCancellation'> = {
    preamp: 1.0,
    postamp: 3.5,
    autoGainControl: false,
    noiseSuppression: false,
    vadEnabled: true,
    vadAttackTime: 40, // 默认40ms
    vadReleaseTime: 300, // 默认300ms
    vadActivationThreshold: 0.35,
    vadDeactivationThreshold: 0.25,
    sampleRate: 48000,
    channels: 1,
};

const STORAGE_KEY = 'livekit_audio_processing_settings_custom_vad_V3';
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

    const settingsRef = useRef(settings);

    // Web Audio API 节点引用
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const destinationNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    
    // 音频处理节点
    const gateNodeRef = useRef<GainNode | null>(null);
    const delayNodeRef = useRef<DelayNode | null>(null);
    const vadStateRef = useRef({
        isSpeaking: false,
        attackTimeout: null as NodeJS.Timeout | null,
        releaseTimeout: null as NodeJS.Timeout | null,
    });
    const analyserNodeRef = useRef<AnalyserNode | null>(null);
    const preampNodeRef = useRef<GainNode | null>(null);
    const postampNodeRef = useRef<GainNode | null>(null);
    const vadAudioContextRef = useRef<AudioContext | null>(null);

    // 其他引用
    const originalStreamRef = useRef<MediaStream | null>(null);
    const processedTrackRef = useRef<LocalAudioTrack | null>(null);
    const isInitializingRef = useRef<boolean>(false);
    const animationFrameRef = useRef<number | null>(null);
    const audioDataRef = useRef<Uint8Array | null>(null);
    const currentDeviceIdRef = useRef<string | null>(null);

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
        if (gateNodeRef.current && audioContextRef.current?.state === 'running') {
            const gateNode = gateNodeRef.current;
            const audioContext = audioContextRef.current;
            const now = audioContext.currentTime;
            gateNode.gain.cancelScheduledValues(now);
            gateNode.gain.setValueAtTime(gateNode.gain.value, now);
            if (action === 'open') {
                gateNode.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
            } else {
                gateNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2); // 关门速度可以慢一些
            }
        }
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
            gateNodeRef.current = audioContext.createGain();
            analyserNodeRef.current = audioContext.createAnalyser();
            destinationNodeRef.current = audioContext.createMediaStreamDestination();
            postampNodeRef.current = audioContext.createGain();
            postampNodeRef.current.gain.value = settings.postamp || 1.0;
            delayNodeRef.current = audioContext.createDelay(0.5); // 最大延迟0.5秒
            delayNodeRef.current.delayTime.value = 0.1; // 默认延迟100ms

            gateNodeRef.current.gain.value = 0.0;

            // 配置分析器
            analyserNodeRef.current.fftSize = 256;
            analyserNodeRef.current.smoothingTimeConstant = 0.8;
            audioDataRef.current = new Uint8Array(analyserNodeRef.current.frequencyBinCount);
            
            console.log('✅ 音频处理链节点创建完成');
            return true;
        } catch (error) {
            console.error('❌ 音频处理链初始化失败:', error);
            throw error;
        }
    }, [settings.sampleRate, settings.postamp]);

    // 连接音频处理链
    const connectAudioChain = useCallback(() => {
        if (!sourceNodeRef.current || !destinationNodeRef.current) return;

        console.log('🔗 连接音频处理链...');

        // 输入 -> 前置放大/单声道 -> VAD门 -> [分析器 -> 增益 -> 滤波 -> 压缩] -> 输出
        // 这样可以确保只对通过VAD的纯语音进行处理，更高效、效果更好。

        const source = sourceNodeRef.current; // 这是经过前置处理的源
        const analyser = analyserNodeRef.current!; // VAD检测器
        const gate = gateNodeRef.current!;
        const delay = delayNodeRef.current!;
        const postamp = postampNodeRef.current!;
        const destination = destinationNodeRef.current!;

        // 断开所有旧连接，以防万一
        source.disconnect();
        gate.disconnect();
        postamp.disconnect();
        analyser.disconnect();

        // 新的连接顺序
        source.connect(postamp);
        postamp.connect(analyser);
        analyser.connect(delay); 
        delay.connect(gate);
        gate.connect(destination);

        console.log('✅ 自定义VAD处理链已连接');
    }, []);

    // 实时音频监控和噪声门控
    const startAudioMonitoring = useCallback(() => {
        if (!analyserNodeRef.current || !audioDataRef.current) return;
        const analyser = analyserNodeRef.current;
        const audioData = new Uint8Array(analyser.fftSize);
        
        const processFrame = () => {
            if (animationFrameRef.current === null) return; // 检查是否已被清理

            if (analyser) {
                // 🎯 2. 改用 getByteTimeDomainData 获取原始波形数据
                analyser.getByteTimeDomainData(audioData);

                // 🎯 3. 寻找波形中的峰值作为当前音量
                let peak = 0;
                // audioData 中的值范围是 0-255，静音时是 128
                for (let i = 0; i < audioData.length; i++) {
                    const value = Math.abs(audioData[i] - 128); // 计算偏离中心的振幅
                    if (value > peak) {
                        peak = value;
                    }
                }
                
                // 将峰值 (0-128) 归一化到 0-1 的范围
                const volume = peak / 128.0;
                setAudioLevel(volume);

                // --- 带有迟滞功能的自定义VAD状态机 ---
                const currentSettings = settingsRef.current; 
                //if (currentSettings.vadEnabled) {
                    if (volume > currentSettings.vadActivationThreshold) {
                        // --- 音量高于“上门限” (激活) ---
                        // 如果有关闭门的计时器，立即取消它，因为我们还在说话
                        if (vadStateRef.current.releaseTimeout) {
                            clearTimeout(vadStateRef.current.releaseTimeout);
                            vadStateRef.current.releaseTimeout = null;
                        }
                        // 如果当前是“不说话”状态，并且没有正在计时的“开门”任务
                        if (!vadStateRef.current.isSpeaking && !vadStateRef.current.attackTimeout) {
                            // 开始一个“开门”计时
                            vadStateRef.current.attackTimeout = setTimeout(() => {
                                controlGate('open');
                                setIsVADActive(true);
                                vadStateRef.current.isSpeaking = true;
                                vadStateRef.current.attackTimeout = null;
                            }, currentSettings.vadAttackTime);
                        }
                    } else if (volume < currentSettings.vadDeactivationThreshold) {
                        // --- 音量低于“下门限” (准备关闭) ---
                        // 如果有“开门”的计时器，立即取消它，因为声音已经变小了
                        if (vadStateRef.current.attackTimeout) {
                            clearTimeout(vadStateRef.current.attackTimeout);
                            vadStateRef.current.attackTimeout = null;
                        }
                        // 如果当前是“说话”状态，并且没有正在计时的“关门”任务
                        if (vadStateRef.current.isSpeaking && !vadStateRef.current.releaseTimeout) {
                            // 开始一个“关门”计时
                            vadStateRef.current.releaseTimeout = setTimeout(() => {
                                controlGate('close');
                                setIsVADActive(false);
                                vadStateRef.current.isSpeaking = false;
                                vadStateRef.current.releaseTimeout = null;
                            }, currentSettings.vadReleaseTime);
                        }
                    }
                    // 如果音量在上门限和下门限之间，则“维持现状”，不做任何操作
                //}
            }
            animationFrameRef.current = requestAnimationFrame(processFrame);
        };
        processFrame();

        // 返回清理函数
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            if (vadStateRef.current.attackTimeout) clearTimeout(vadStateRef.current.attackTimeout);
            if (vadStateRef.current.releaseTimeout) clearTimeout(vadStateRef.current.releaseTimeout);
        };
    // 移除了对 settings 的依赖，使此函数更稳定
    }, [controlGate]);

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
    const initializeAudioProcessing = useCallback(async (deviceId: string) => {
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

            // 步骤2：初始化 Web Audio API 处理链
            await initializeAudioProcessingChain();

            // 步骤3：获取原始音频流（使用默认设备，禁用浏览器处理）
            const deviceId = getCurrentAudioDeviceId();
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
                    echoCancellation: settings.echoCancellation,
                    noiseSuppression: settings.noiseSuppression,
                    autoGainControl: false,
                    sampleRate: { ideal: settings.sampleRate },
                    channelCount: { exact: 1 }
                }
            };

            console.log('🎤 获取带有浏览器原生处理的音频流:', constraints.audio);
            const originalStream = await navigator.mediaDevices.getUserMedia(constraints);
            originalStreamRef.current = originalStream;
            
            // 🎯 新增步骤 3.5：创建前置处理阶段 (增益 + 单声道)
            console.log('🔊 应用前置增益和单声道转换...');
            const sourceForPreamp = audioContextRef.current!.createMediaStreamSource(originalStream);
            
            const preampNode = audioContextRef.current!.createGain();
            // 使用settings中的增益值，如果不存在则默认为1.0
            preampNodeRef.current = preampNode;
            preampNode.gain.value = settings.preamp || 1.0; 

            // 强制将音频混合为单声道，解决只有左声道的问题
            preampNode.channelCount = 1;
            preampNode.channelCountMode = 'explicit';
            preampNode.channelInterpretation = 'speakers';

            // 创建一个临时的目标节点，以生成包含前置处理效果的新音频流
            const preampDestinationNode = audioContextRef.current!.createMediaStreamDestination();
            sourceForPreamp.connect(preampNode);
            preampNode.connect(preampDestinationNode);

            // 这就是经过前置处理（增益放大+转为单声道）的新音频流
            const boostedAndMonoStream = preampDestinationNode.stream;
            
            await ensureAudioContextRunning();

            // 🎯 修改步骤 4：使用经过前置处理的流来连接主处理链
            sourceNodeRef.current = audioContextRef.current!.createMediaStreamSource(boostedAndMonoStream);
            connectAudioChain();

            if (!settings.vadEnabled) {
                controlGate('open');
            }
            
            // 发布轨道
            const processedStream = destinationNodeRef.current!.stream;
            const processedAudioTrack = processedStream.getAudioTracks()[0];
            processedTrackRef.current = new LocalAudioTrack(processedAudioTrack, undefined, false);
            await localParticipant.publishTrack(processedTrackRef.current, { name: 'custom-microphone-vad', source: Track.Source.Microphone, stopMicTrackOnMute: false });

            // 更新和启动监控
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
        // 依赖项保持不变
        localParticipant, 
        room, 
        isInitialized, 
        settings,
        controlGate,
        initializeAudioProcessingChain,
        getCurrentAudioDeviceId,
        connectAudioChain,
        startAudioMonitoring,
        ensureAudioContextRunning
    ]);

    // 🎯 更新单个设置（只更新处理参数，不重建轨道）
    const updateSetting = useCallback((key: keyof AudioProcessingSettings, value: boolean | number) => {
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, [key]: value };
            saveSettings(newSettings);
            return newSettings;
        });
    }, [saveSettings]);

    // 🎯 2. 创建一个useEffect，在每次settings变化时，都去更新ref的值
    // 这确保了settingsRef.current永远是最新的
    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    // 新增一个useEffect来处理需要重建管线的设置
    useEffect(() => {
        // 这个effect只在isInitialized之后，当echoCancellation变化时触发
        // 它会触发完整的管线重建流程
        if (isInitialized && room && localParticipant) {
            // 重新初始化会读取最新的 settings.echoCancellation 值
            initializeAudioProcessing(currentDeviceIdRef.current || 'default');
        }
    }, [settings.echoCancellation]); // 只依赖这一个会强制重建的参数

    // 检查是否正在应用设置
    const isApplying = useCallback((key: keyof AudioProcessingSettings) => {
        return applyingSettings.has(key);
    }, [applyingSettings, settings.autoGainControl, settings.noiseSuppression]);
    
    // 🎯 3. 新增一个useEffect来实时更新前置增益
    useEffect(() => {
        // 确保音频管线已初始化并且preampNode已存在
        if (isInitialized && preampNodeRef.current && audioContextRef.current) {
            console.log(`🔊 应用新的前置增益值: ${settings.preamp}`);
            // 使用setTargetAtTime可以平滑地改变音量，避免产生爆音
            preampNodeRef.current.gain.setTargetAtTime(
                settings.preamp, 
                audioContextRef.current.currentTime, 
                0.02 // 在0.02秒内平滑过渡到新音量
            );
        }
    }, [settings.preamp, isInitialized]); // 这个effect只在`settings.preamp`或`isInitialized`变化时运行

    useEffect(() => {
        // 确保音频管线已初始化并且postampNode已存在
        if (isInitialized && postampNodeRef.current && audioContextRef.current) {
            console.log(`🔊 应用新的后置增益值: ${settings.postamp}`);
            postampNodeRef.current.gain.setTargetAtTime(
                settings.postamp, 
                audioContextRef.current.currentTime, 
                0.02 // 平滑过渡
            );
        }
    }, [settings.postamp, isInitialized]); // 只在`settings.postamp`变化时运行

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
            initializeAudioProcessing(currentDeviceIdRef.current || 'default').catch(error => {
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
        isProcessingActive,
        isInitialized,
        audioLevel,
        isVADActive
    };
}