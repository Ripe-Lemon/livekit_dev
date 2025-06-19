'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
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
            
            // 1. 首先彻底清理现有的LiveKit音频轨道
            await cleanupExistingTracks();
            
            // 2. 等待清理完成
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 3. 创建双轨道音频流
            const streams = await createDualAudioStreams();
            if (!streams) {
                throw new Error('无法创建双轨道音频流');
            }

            const { analysisStream, publishStream } = streams;

            // 4. 验证流状态
            const analysisTrack = analysisStream.getAudioTracks()[0];
            if (!analysisTrack || analysisTrack.readyState !== 'live') {
                throw new Error(`分析音频轨道状态无效: ${analysisTrack?.readyState}`);
            }

            const publishTrack = publishStream.getAudioTracks()[0];
            if (!publishTrack || publishTrack.readyState !== 'live') {
                throw new Error(`发布音频轨道状态无效: ${publishTrack?.readyState}`);
            }

            console.log('🔍 音频轨道详情:', {
                analysis: {
                    label: analysisTrack.label,
                    readyState: analysisTrack.readyState,
                    enabled: analysisTrack.enabled,
                    settings: analysisTrack.getSettings()
                },
                publish: {
                    label: publishTrack.label,
                    readyState: publishTrack.readyState,
                    enabled: publishTrack.enabled,
                    settings: publishTrack.getSettings()
                }
            });

            // 5. 连接VAD到分析流
            await vadProcessorRef.current.connectToMicrophone(analysisStream);
            analysisStreamRef.current = analysisStream;

            // 6. 发布处理后的音频轨道到LiveKit - 使用更长的超时时间
            console.log('📤 发布VAD处理后的音频轨道...');
            
            // 添加发布超时保护
            const publishPromise = localParticipant.publishTrack(publishTrack, {
                source: Track.Source.Microphone,
                name: 'microphone'
            });

            // 使用Promise.race来处理超时
            const publishResult = await Promise.race([
                publishPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('音频轨道发布超时（10秒）')), 10000)
                )
            ]);

            publishStreamRef.current = publishStream;
            setIsActive(true);
            setIsGatewayControlling(true);
            
            console.log('✅ VAD双轨道系统已启动并连接');
            console.log('🎯 分析轨道用于VAD检测，发布轨道用于服务器传输');

        } catch (error) {
            console.error('❌ 启动VAD双轨道系统失败:', error);
            
            // 如果是发布超时错误，尝试重新连接
            if (error.message.includes('timed out') || error.message.includes('超时')) {
                console.log('🔄 检测到发布超时，尝试重新连接...');
                await handlePublishTimeout();
            } else {
                // 其他错误，直接清理
                await cleanupOnError();
            }
            
            throw error;
        }
    }, [isActive, createDualAudioStreams, localParticipant]);

    // 新增：清理现有轨道的函数
    const cleanupExistingTracks = useCallback(async () => {
        try {
            console.log('🧹 清理现有LiveKit音频轨道...');
            
            // 获取所有音频发布
            const audioPublications = Array.from(localParticipant.audioTrackPublications.values());
            
            for (const publication of audioPublications) {
                if (publication.source === Track.Source.Microphone && publication.track) {
                    console.log(`🛑 停止并取消发布音频轨道: ${publication.trackSid}`);
                    
                    // 先停止轨道
                    publication.track.stop();
                    
                    // 然后取消发布
                    await localParticipant.unpublishTrack(publication.track);
                }
            }
            
            console.log('✅ 现有音频轨道清理完成');
        } catch (error) {
            console.warn('⚠️ 清理现有轨道时出错:', error);
            // 不抛出错误，继续流程
        }
    }, [localParticipant]);

    // 新增：处理发布超时的函数
    const handlePublishTimeout = useCallback(async () => {
        try {
            console.log('🔄 尝试恢复音频轨道发布...');
            
            // 清理失败的流
            if (publishStreamRef.current) {
                publishStreamRef.current.getTracks().forEach(track => track.stop());
                publishStreamRef.current = null;
            }
            
            // 重置状态
            setIsActive(false);
            setIsGatewayControlling(false);
            
            // 等待一段时间后尝试重新创建标准音频轨道
            setTimeout(async () => {
                try {
                    console.log('🎤 创建标准音频轨道作为备用...');
                    const fallbackStream = await navigator.mediaDevices.getUserMedia({
                        audio: {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        }
                    });
                    
                    const fallbackTrack = fallbackStream.getAudioTracks()[0];
                    if (fallbackTrack) {
                        await localParticipant.publishTrack(fallbackTrack, {
                            source: Track.Source.Microphone,
                            name: 'microphone'
                        });
                        console.log('✅ 标准音频轨道发布成功');
                    }
                } catch (fallbackError) {
                    console.error('❌ 创建备用音频轨道失败:', fallbackError);
                }
            }, 2000);
            
        } catch (error) {
            console.error('❌ 处理发布超时失败:', error);
        }
    }, [localParticipant]);

    // 新增：错误清理函数
    const cleanupOnError = useCallback(async () => {
        setIsActive(false);
        setIsGatewayControlling(false);
        setVADResult(null);
        setGatewayState(null);
        
        // 清理分析音频流
        if (analysisStreamRef.current) {
            analysisStreamRef.current.getTracks().forEach(track => track.stop());
            analysisStreamRef.current = null;
        }
        
        // 清理发布音频流
        if (publishStreamRef.current) {
            publishStreamRef.current.getTracks().forEach(track => track.stop());
            publishStreamRef.current = null;
        }
        
        console.log('🧹 错误清理完成');
    }, []);

    // 停止VAD和音频网关
    const stopVAD = useCallback(async () => {
        if (!isActive) return;

        console.log('⏹️ 停止VAD双轨道系统...');
        
        try {
            // 1. 停止VAD分析
            if (vadProcessorRef.current) {
                vadProcessorRef.current.stopAnalysis();
            }

            // 2. 清理分析音频流
            if (analysisStreamRef.current) {
                analysisStreamRef.current.getTracks().forEach(track => {
                    console.log(`🛑 停止分析音频轨道: ${track.label}`);
                    track.stop();
                });
                analysisStreamRef.current = null;
            }

            // 3. 处理发布流 - 不立即停止，而是标记为即将清理
            if (publishStreamRef.current) {
                console.log('📤 标记发布流为待清理状态');
                publishStreamRef.current = null;
            }

            // 4. 重置状态
            setIsActive(false);
            setIsGatewayControlling(false);
            setVADResult(null);
            setGatewayState(null);
            
            console.log('✅ VAD双轨道系统已停止');
            
            // 5. 延迟清理LiveKit轨道，避免立即重启时的冲突
            setTimeout(async () => {
                try {
                    console.log('🧹 延迟清理LiveKit音频轨道...');
                    await cleanupExistingTracks();
                } catch (error) {
                    console.warn('⚠️ 延迟清理时出错:', error);
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ 停止VAD时出错:', error);
            // 强制清理
            await cleanupOnError();
        }
    }, [isActive, cleanupExistingTracks, cleanupOnError]);

    // 新增：监听LiveKit连接状态
    useEffect(() => {
        const handleConnectionStateChange = () => {
            if (localParticipant?.room?.state === 'disconnected') {
                console.log('🔌 检测到房间断开连接，清理VAD状态');
                setIsActive(false);
                setIsGatewayControlling(false);
                setVADResult(null);
                setGatewayState(null);
            }
        };

        if (localParticipant?.room) {
            localParticipant.room.on('connectionStateChanged', handleConnectionStateChange);
            
            return () => {
                localParticipant.room?.off('connectionStateChanged', handleConnectionStateChange);
            };
        }
    }, [localParticipant]);

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