'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { VADProcessor, VADResult, VADConfig } from '../lib/audio/VADProcessor';

export interface VADHookResult {
    vadResult: VADResult | null;
    isActive: boolean;
    startVAD: () => Promise<void>;
    stopVAD: () => void;
    updateThreshold: (threshold: number) => void;
    vadProcessor: VADProcessor | null;
}

export function useVAD(initialConfig?: Partial<VADConfig>): VADHookResult {
    const { localParticipant } = useLocalParticipant();
    const [vadResult, setVADResult] = useState<VADResult | null>(null);
    const [isActive, setIsActive] = useState(false);
    
    const vadProcessorRef = useRef<VADProcessor | null>(null);
    const monitoringStreamRef = useRef<MediaStream | null>(null);

    // 初始化VAD处理器
    const initializeVAD = useCallback(() => {
        if (vadProcessorRef.current) {
            vadProcessorRef.current.dispose();
        }

        vadProcessorRef.current = new VADProcessor(initialConfig);
        
        // 设置VAD结果回调
        vadProcessorRef.current.setVADCallback((result: VADResult) => {
            setVADResult(result);
        });

        console.log('🎤 VAD 处理器已初始化');
    }, [initialConfig]);

    // 获取LiveKit音频轨道对应的原始音频流
    const getLiveKitAudioStream = useCallback(async (): Promise<MediaStream | null> => {
        if (!localParticipant) {
            console.warn('本地参与者不存在');
            return null;
        }

        try {
            // 首先尝试从现有的LiveKit轨道获取
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                const track = audioPublication.track.mediaStreamTrack;
                if (track.readyState === 'live') {
                    // 直接使用LiveKit的音频轨道
                    const stream = new MediaStream([track]);
                    console.log('✅ 从LiveKit轨道获取音频流用于VAD');
                    console.log('🔍 音频轨道设置:', track.getSettings());
                    return stream;
                }
            }

            // 如果没有LiveKit轨道，创建一个专门用于VAD的原始音频流
            console.log('🎤 为VAD创建独立的原始音频流...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,  // VAD需要原始音频
                    noiseSuppression: false,  // 不要降噪，VAD需要原始信号
                    autoGainControl: false,   // 不要自动增益
                    sampleRate: 48000,
                    channelCount: 1
                }
            });

            console.log('✅ 创建VAD专用音频流成功');
            return stream;

        } catch (error) {
            console.error('❌ 获取VAD音频流失败:', error);
            return null;
        }
    }, [localParticipant]);

    // 启动VAD
    const startVAD = useCallback(async () => {
        if (isActive || !vadProcessorRef.current) {
            console.log('VAD 已经活跃或处理器未初始化');
            return;
        }

        try {
            console.log('🔍 启动VAD...');
            
            const stream = await getLiveKitAudioStream();
            if (!stream) {
                throw new Error('无法获取音频流');
            }

            // 验证音频流状态
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('音频流中没有音频轨道');
            }

            const audioTrack = audioTracks[0];
            console.log('🔍 VAD音频轨道详情:', {
                label: audioTrack.label,
                kind: audioTrack.kind,
                readyState: audioTrack.readyState,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                settings: audioTrack.getSettings(),
                constraints: audioTrack.getConstraints(),
                capabilities: audioTrack.getCapabilities()
            });

            if (audioTrack.readyState !== 'live') {
                throw new Error(`音频轨道状态无效: ${audioTrack.readyState}`);
            }

            monitoringStreamRef.current = stream;
            await vadProcessorRef.current.connectToMicrophone(stream);
            
            setIsActive(true);
            console.log('✅ VAD 已启动并连接到音频流');

        } catch (error) {
            console.error('❌ 启动VAD失败:', error);
            setIsActive(false);
            
            // 清理失败的流
            if (monitoringStreamRef.current) {
                monitoringStreamRef.current.getTracks().forEach(track => track.stop());
                monitoringStreamRef.current = null;
            }
            
            throw error;
        }
    }, [isActive, getLiveKitAudioStream]);

    // 停止VAD
    const stopVAD = useCallback(() => {
        if (!isActive) return;

        console.log('⏹️ 停止VAD...');
        
        if (vadProcessorRef.current) {
            vadProcessorRef.current.stopAnalysis();
        }

        // 清理监控音频流
        if (monitoringStreamRef.current) {
            const tracks = monitoringStreamRef.current.getTracks();
            tracks.forEach(track => {
                console.log(`🛑 停止VAD音频轨道: ${track.label}`);
                // 只停止我们创建的专用VAD流，不影响LiveKit的音频轨道
                const liveKitTrackId = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack?.id;
                const isLiveKitTrack = track.label.includes('LiveKit') || (liveKitTrackId && track.id === liveKitTrackId);
                
                if (!isLiveKitTrack) {
                    track.stop();
                }
            });
            monitoringStreamRef.current = null;
        }

        setIsActive(false);
        setVADResult(null);
        console.log('✅ VAD 已停止');
    }, [isActive, localParticipant]);

    // 更新阈值
    const updateThreshold = useCallback((threshold: number) => {
        if (vadProcessorRef.current) {
            vadProcessorRef.current.updateConfig({ threshold });
            console.log(`⚙️ VAD 阈值已更新为: ${threshold}`);
        }
    }, []);

    // 监听本地参与者变化 - 修复重复初始化问题
    useEffect(() => {
        if (localParticipant && !vadProcessorRef.current) {
            console.log('🎤 本地参与者就绪，初始化VAD');
            initializeVAD();
        }
    }, [localParticipant, initializeVAD]);

    // 监听LiveKit麦克风状态变化
    useEffect(() => {
        if (!localParticipant || !isActive) return;

        const handleTrackMuted = () => {
            console.log('🔇 LiveKit麦克风被静音，但VAD继续监控原始音频');
        };

        const handleTrackUnmuted = () => {
            console.log('🎤 LiveKit麦克风取消静音');
        };

        const handleTrackPublished = () => {
            console.log('📤 LiveKit音频轨道已发布，检查VAD连接');
            // 延迟重连，避免立即清理
            if (!isActive && vadProcessorRef.current) {
                console.log('🔄 尝试重新连接VAD到新的音频轨道');
                setTimeout(() => {
                    if (vadProcessorRef.current && !isActive) { // 双重检查
                        startVAD().catch(console.error);
                    }
                }, 1000); // 增加延迟
            }
        };

        const handleTrackUnpublished = () => {
            console.log('📤 LiveKit音频轨道已取消发布');
        };

        // 监听轨道状态变化
        const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication) {
            audioPublication.on('muted', handleTrackMuted);
            audioPublication.on('unmuted', handleTrackUnmuted);
        }

        // 监听参与者事件
        localParticipant.on('trackPublished', handleTrackPublished);
        localParticipant.on('trackUnpublished', handleTrackUnpublished);

        return () => {
            if (audioPublication) {
                audioPublication.off('muted', handleTrackMuted);
                audioPublication.off('unmuted', handleTrackUnmuted);
            }
            localParticipant.off('trackPublished', handleTrackPublished);
            localParticipant.off('trackUnpublished', handleTrackUnpublished);
            // 不要在这里清理VAD
        };
    }, [localParticipant, isActive]); // 移除startVAD依赖避免循环

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理VAD Hook');
            // 移除立即清理，改为条件清理
            if (!isActive) {
                stopVAD();
                if (vadProcessorRef.current) {
                    vadProcessorRef.current.dispose();
                    vadProcessorRef.current = null;
                }
            }
        };
    }, []); // 空依赖数组，只在组件卸载时清理

    return {
        vadResult,
        isActive,
        startVAD,
        stopVAD,
        updateThreshold,
        vadProcessor: vadProcessorRef.current
    };
}