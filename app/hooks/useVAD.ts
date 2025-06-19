import { VADProcessor, VADAudioGateway, VADResult, VADConfig } from '../lib/audio/VADProcessor';

export interface VADHookResult {
    vadResult: VADResult | null;
    isActive: boolean;
    startVAD: () => Promise<void>;
    stopVAD: () => void;
    updateThreshold: (threshold: number) => void;
    vadProcessor: VADProcessor | null;
    // 新增：网关相关状态
    isGatewayControlling: boolean;
    gatewayState: any;
}

export function useVAD(initialConfig?: Partial<VADConfig>): VADHookResult {
    const { localParticipant } = useLocalParticipant();
    const [vadResult, setVADResult] = useState<VADResult | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [isGatewayControlling, setIsGatewayControlling] = useState(false);
    const [gatewayState, setGatewayState] = useState<any>(null);
    
    const vadProcessorRef = useRef<VADProcessor | null>(null);
    const audioGatewayRef = useRef<VADAudioGateway | null>(null);
    const analysisStreamRef = useRef<MediaStream | null>(null); // 分析用音频流
    const publishStreamRef = useRef<MediaStream | null>(null);  // 发布用音频流

    // 初始化VAD处理器和音频网关
    const initializeVAD = useCallback(() => {
        if (vadProcessorRef.current) {
            vadProcessorRef.current.dispose();
        }
        if (audioGatewayRef.current) {
            audioGatewayRef.current.dispose();
        }

        vadProcessorRef.current = new VADProcessor(initialConfig);
        audioGatewayRef.current = new VADAudioGateway();
        
        // 设置VAD结果回调
        vadProcessorRef.current.setVADCallback((result: VADResult) => {
            setVADResult(result);
        });

        // 设置语音状态变化回调，控制音频网关
        vadProcessorRef.current.setSpeechStateChangeCallback((isSpeaking: boolean) => {
            if (audioGatewayRef.current) {
                audioGatewayRef.current.setTransmitting(isSpeaking);
            }
        });

        // 设置网关状态回调
        audioGatewayRef.current.setStateChangeCallback((state) => {
            setGatewayState(state);
        });

        console.log('🎤 VAD 处理器和音频网关已初始化');
    }, [initialConfig]);

    // 创建原始音频流用于分析和处理
    const createDualAudioStreams = useCallback(async (): Promise<{
        analysisStream: MediaStream;
        publishStream: MediaStream;
    } | null> => {
        if (!localParticipant || !audioGatewayRef.current) {
            console.warn('本地参与者或音频网关不存在');
            return null;
        }

        try {
            // 1. 首先尝试获取原始设备音频流
            console.log('🎤 创建原始音频流用于VAD分析和处理...');
            const originalStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,  // VAD需要原始音频
                    noiseSuppression: false,  // 不要降噪，VAD需要原始信号
                    autoGainControl: false,   // 不要自动增益
                    sampleRate: 48000,
                    channelCount: 1
                }
            });

            // 2. 分析流：直接使用原始流
            const analysisStream = originalStream;

            // 3. 发布流：通过音频网关处理原始流
            const publishStream = await audioGatewayRef.current.connectToStream(originalStream);
            if (!publishStream) {
                throw new Error('无法创建处理后的发布流');
            }

            console.log('✅ 双轨道音频流创建成功');
            console.log('📊 分析流轨道数:', analysisStream.getAudioTracks().length);
            console.log('📊 发布流轨道数:', publishStream.getAudioTracks().length);

            return {
                analysisStream,
                publishStream
            };

        } catch (error) {
            console.error('❌ 创建双轨道音频流失败:', error);
            return null;
        }
    }, [localParticipant]);

    // 启动VAD和音频网关
    const startVAD = useCallback(async () => {
        if (isActive || !vadProcessorRef.current || !audioGatewayRef.current) {
            console.log('VAD 已经活跃或组件未初始化');
            return;
        }

        try {
            console.log('🔍 启动VAD双轨道系统...');
            
            // 创建双轨道音频流
            const streams = await createDualAudioStreams();
            if (!streams) {
                throw new Error('无法创建双轨道音频流');
            }

            const { analysisStream, publishStream } = streams;

            // 验证分析流状态
            const analysisTrack = analysisStream.getAudioTracks()[0];
            if (!analysisTrack || analysisTrack.readyState !== 'live') {
                throw new Error(`分析音频轨道状态无效: ${analysisTrack?.readyState}`);
            }

            // 验证发布流状态
            const publishTrack = publishStream.getAudioTracks()[0];
            if (!publishTrack || publishTrack.readyState !== 'live') {
                throw new Error(`发布音频轨道状态无效: ${publishTrack?.readyState}`);
            }

            console.log('🔍 音频轨道详情:', {
                analysis: {
                    label: analysisTrack.label,
                    readyState: analysisTrack.readyState,
                    settings: analysisTrack.getSettings()
                },
                publish: {
                    label: publishTrack.label,
                    readyState: publishTrack.readyState,
                    settings: publishTrack.getSettings()
                }
            });

            // 连接VAD到分析流
            await vadProcessorRef.current.connectToMicrophone(analysisStream);
            analysisStreamRef.current = analysisStream;

            // 停止并替换LiveKit的现有音频轨道
            const existingAudioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (existingAudioPublication?.track) {
                console.log('🛑 停止现有LiveKit音频轨道');
                existingAudioPublication.track.stop();
                await localParticipant.unpublishTrack(existingAudioPublication.track);
                
                // 等待轨道清理
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // 发布处理后的音频轨道到LiveKit（标记为microphone）
            console.log('📤 发布VAD处理后的音频轨道...');
            await localParticipant.publishTrack(publishTrack, {
                source: Track.Source.Microphone,
                name: 'microphone'
            });

            publishStreamRef.current = publishStream;
            setIsActive(true);
            setIsGatewayControlling(true);
            
            console.log('✅ VAD双轨道系统已启动并连接');
            console.log('🎯 分析轨道用于VAD检测，发布轨道用于服务器传输');

        } catch (error) {
            console.error('❌ 启动VAD双轨道系统失败:', error);
            setIsActive(false);
            setIsGatewayControlling(false);
            
            // 清理失败的流
            if (analysisStreamRef.current) {
                analysisStreamRef.current.getTracks().forEach(track => track.stop());
                analysisStreamRef.current = null;
            }
            if (publishStreamRef.current) {
                publishStreamRef.current.getTracks().forEach(track => track.stop());
                publishStreamRef.current = null;
            }
            
            throw error;
        }
    }, [isActive, createDualAudioStreams, localParticipant]);

    // 停止VAD和音频网关
    const stopVAD = useCallback(() => {
        if (!isActive) return;

        console.log('⏹️ 停止VAD双轨道系统...');
        
        if (vadProcessorRef.current) {
            vadProcessorRef.current.stopAnalysis();
        }

        // 清理分析音频流
        if (analysisStreamRef.current) {
            analysisStreamRef.current.getTracks().forEach(track => {
                console.log(`🛑 停止分析音频轨道: ${track.label}`);
                track.stop();
            });
            analysisStreamRef.current = null;
        }

        // 清理发布音频流（注意：不要停止已发布到LiveKit的轨道）
        if (publishStreamRef.current) {
            console.log('📤 发布流将由LiveKit管理，不手动停止');
            publishStreamRef.current = null;
        }

        setIsActive(false);
        setIsGatewayControlling(false);
        setVADResult(null);
        setGatewayState(null);
        console.log('✅ VAD双轨道系统已停止');
    }, [isActive]);

    // 更新阈值
    const updateThreshold = useCallback((threshold: number) => {
        if (vadProcessorRef.current) {
            vadProcessorRef.current.updateConfig({ threshold });
            console.log(`⚙️ VAD 阈值已更新为: ${threshold}`);
        }
    }, []);

    // 监听本地参与者变化
    useEffect(() => {
        if (localParticipant && !vadProcessorRef.current) {
            console.log('🎤 本地参与者就绪，初始化VAD双轨道系统');
            initializeVAD();
        }
    }, [localParticipant, initializeVAD]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理VAD双轨道系统');
            if (isActive) {
                stopVAD();
            }
            if (vadProcessorRef.current) {
                vadProcessorRef.current.dispose();
                vadProcessorRef.current = null;
            }
            if (audioGatewayRef.current) {
                audioGatewayRef.current.dispose();
                audioGatewayRef.current = null;
            }
        };
    }, []);

    return {
        vadResult,
        isActive,
        startVAD,
        stopVAD,
        updateThreshold,
        vadProcessor: vadProcessorRef.current,
        isGatewayControlling,
        gatewayState
    };
}