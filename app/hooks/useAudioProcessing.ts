// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, LocalAudioTrack } from 'livekit-client';
import { MicVAD } from '@ricky0123/vad-web';

export interface AudioProcessingSettings {
    preamp: number; // 前置增益
    postamp: number;
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    vadEnabled: boolean;
    vadPositiveSpeechThreshold: number; 
    vadNegativeSpeechThreshold: number;
    vadRedemptionFrames: number;
    sampleRate: number;
    channels: number;
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => void;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
    isProcessingActive: boolean;
    isInitialized: boolean;
    audioLevel: number;
    isVADActive: boolean;
}

const DEFAULT_SETTINGS: Omit<AudioProcessingSettings, 'echoCancellation'> = {
    preamp: 1.0,
    postamp: 7.0,
    autoGainControl: false,
    noiseSuppression: false,
    vadEnabled: true,
    vadPositiveSpeechThreshold: 0.8,
    vadNegativeSpeechThreshold: 0.65,
    vadRedemptionFrames: 1,
    sampleRate: 48000,
    channels: 1,
};

const STORAGE_KEY = 'livekit_audio_processing_settings_V3';
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
    const gateNodeRef = useRef<GainNode | null>(null);
    const vadRef = useRef<MicVAD | null>(null); // 引用类型更新为 MicVAD
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
        setIsVADActive(action === 'open');
        if (gateNodeRef.current && audioContextRef.current?.state === 'running') {
            const gateNode = gateNodeRef.current;
            const audioContext = audioContextRef.current;
            const now = audioContext.currentTime;
            gateNode.gain.cancelScheduledValues(now);
            const targetGain = action === 'open' ? 1.0 : 0.0001;
            const delay = action === 'open' ? 0.01 : 0.05;
            gateNode.gain.setValueAtTime(gateNode.gain.value, now);
            if (action === 'open') {
            // 🎯 核心修复：将开门的延迟从 0.1 大幅缩短到 0.015
            // 这样音频门会几乎瞬间打开，让 preSpeechPadFrames 缓存的音头通过
            gateNode.gain.exponentialRampToValueAtTime(1.0, now + 0.01);
        } else {
            // 关门时可以保留一个较长的延迟，让语音结束得更自然
            gateNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
        }
        }
    }, []);

    // 🎯 2. 修正：更新 VAD 初始化和启动逻辑
    const initializeVAD = useCallback(async (stream: MediaStream, gateNode: GainNode, audioContext: AudioContext) => {
        if (vadRef.current) {
            // 先暂停并销毁旧实例
            vadRef.current.destroy();
        }

        try {
            console.log('🎤 正在加载 VAD 模型并应用设置:', {
                positiveSpeechThreshold: settings.vadPositiveSpeechThreshold,
                negativeSpeechThreshold: settings.vadNegativeSpeechThreshold,
                redemptionFrames: settings.vadRedemptionFrames,
            });
            
            // 使用 MicVAD.new() 并直接在构造函数中传入 stream
            const vad = await MicVAD.new({
                // 关键：在这里传入我们自己创建的音频流
                stream: stream,
                //model: "v5",
                positiveSpeechThreshold: settings.vadPositiveSpeechThreshold,
                negativeSpeechThreshold: settings.vadNegativeSpeechThreshold,
                redemptionFrames: settings.vadRedemptionFrames,
                minSpeechFrames: 3,
                preSpeechPadFrames: 12,
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
            gateNodeRef.current = audioContext.createGain();
            analyserNodeRef.current = audioContext.createAnalyser();
            destinationNodeRef.current = audioContext.createMediaStreamDestination();
            postampNodeRef.current = audioContext.createGain();
            postampNodeRef.current.gain.value = settings.postamp || 1.0;

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
        const gate = gateNodeRef.current!;
        const postamp = postampNodeRef.current!;
        const analyser = analyserNodeRef.current!;
        const destination = destinationNodeRef.current!;

        // 断开所有旧连接，以防万一
        source.disconnect();
        gate.disconnect();
        postamp.disconnect();
        analyser.disconnect();

        // 新的连接顺序
        source.connect(gate);
        source.connect(gate);
        gate.connect(postamp);      // VAD门后的干净语音进入后置放大
        postamp.connect(analyser);  // 分析器现在监听最终放大后的音量
        analyser.connect(destination);

        console.log('✅ 优化后的音频处理链已连接');
    }, []);

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

            if (settings.vadEnabled) {
                // 🎯 修改：让VAD也分析经过前置处理的流，以便更准确地检测
                await initializeVAD(
                    boostedAndMonoStream,
                    gateNodeRef.current!,
                    audioContextRef.current!
                );
            } else {
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
        initializeVAD, 
        controlGate,
        initializeAudioProcessingChain,
        getCurrentAudioDeviceId,
        connectAudioChain,
        startAudioMonitoring,
        ensureAudioContextRunning
    ]);

    // 🎯 更新单个设置（只更新处理参数，不重建轨道）
    const updateSetting = useCallback((key: keyof AudioProcessingSettings, value: boolean | number): void => {
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, [key]: value };
            saveSettings(newSettings);
            return newSettings;
        });
    }, []);

    // 使用专门的useEffect来响应设置变化
    useEffect(() => {
        if (!isInitialized) return;

        const handleVadSettingsChange = async () => {
            if (settings.vadEnabled) {
                if (originalStreamRef.current && vadAudioContextRef.current && gateNodeRef.current) {
                    await initializeVAD(originalStreamRef.current, gateNodeRef.current, vadAudioContextRef.current);
                }
            } else { 
                if (vadRef.current) {
                    vadRef.current.destroy();
                    vadRef.current = null;
                }
                controlGate('open');
            }
        };
        handleVadSettingsChange();

    }, [settings, isInitialized, initializeVAD, controlGate]);

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

    // 重置为默认设置
    const resetToDefaults = useCallback(async () => {
        console.log('🔄 重置音频处理设置为默认值');
        
        try {
            const defaultWithEcho = { ...DEFAULT_SETTINGS, echoCancellation: false };
            setSettings(defaultWithEcho);
            saveSettings(defaultWithEcho);
                    if(originalStreamRef.current && gateNodeRef.current && audioContextRef.current) {
                        await initializeVAD(
                            originalStreamRef.current,
                            gateNodeRef.current,
                            audioContextRef.current
                        );
                    }
            if (isInitialized) {
                if (DEFAULT_SETTINGS.vadEnabled) {
                    if(originalStreamRef.current && gateNodeRef.current && audioContextRef.current) {
                        await initializeVAD(
                            originalStreamRef.current,
                            gateNodeRef.current,
                            audioContextRef.current
                        );
                    }
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
    }, [saveSettings, isInitialized]);

    // 🎯 核心修复：新增一个专门的useEffect来监听VAD相关设置的变化
    useEffect(() => {
        // 确保只在初始化完成、VAD启用、且有音频流时才执行
        if (!isInitialized || !settings.vadEnabled || !originalStreamRef.current) {
            return;
        }

        console.log('VAD settings changed, re-initializing VAD instance...');
        
        // 当VAD相关参数变化时，使用当前的音频流重新初始化VAD实例
        // initializeVAD函数会从最新的`settings`状态中读取参数
        initializeVAD(
            originalStreamRef.current,
            gateNodeRef.current!, // 此时这些Ref必定已存在
            vadAudioContextRef.current!
        );

    // 依赖项数组中只包含VAD相关的设置，确保只在需要时运行
    }, [
        settings.vadEnabled, 
        settings.vadPositiveSpeechThreshold, 
        settings.vadNegativeSpeechThreshold, 
        settings.vadRedemptionFrames,
        isInitialized,
        initializeVAD // 包含initializeVAD以遵循hook依赖规则
    ]);
    
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