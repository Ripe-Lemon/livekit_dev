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
    const currentStreamRef = useRef<MediaStream | null>(null);

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

    // 获取麦克风音频流
    const getMicrophoneStream = useCallback(async (): Promise<MediaStream | null> => {
        if (!localParticipant) {
            console.warn('本地参与者不存在');
            return null;
        }

        try {
            // 首先尝试从现有轨道获取流
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                const track = audioPublication.track.mediaStreamTrack;
                if (track.readyState === 'live') {
                    const stream = new MediaStream([track]);
                    console.log('✅ 从现有轨道获取音频流');
                    return stream;
                }
            }

            // 如果没有现有轨道，请求新的麦克风权限
            console.log('🎤 请求新的麦克风权限...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false, // VAD需要原始音频
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 48000,
                    channelCount: 1
                }
            });

            console.log('✅ 获取到新的麦克风流');
            return stream;

        } catch (error) {
            console.error('❌ 获取麦克风流失败:', error);
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
            
            const stream = await getMicrophoneStream();
            if (!stream) {
                throw new Error('无法获取麦克风流');
            }

            currentStreamRef.current = stream;
            await vadProcessorRef.current.connectToMicrophone(stream);
            
            setIsActive(true);
            console.log('✅ VAD 已启动');

        } catch (error) {
            console.error('❌ 启动VAD失败:', error);
            setIsActive(false);
            throw error;
        }
    }, [isActive, getMicrophoneStream]);

    // 停止VAD
    const stopVAD = useCallback(() => {
        if (!isActive) return;

        console.log('⏹️ 停止VAD...');
        
        if (vadProcessorRef.current) {
            vadProcessorRef.current.stopAnalysis();
        }

        // 清理音频流（如果是我们创建的）
        if (currentStreamRef.current) {
            const tracks = currentStreamRef.current.getTracks();
            tracks.forEach(track => {
                if (track.label.includes('VAD') || !localParticipant?.getTrackPublication(Track.Source.Microphone)) {
                    track.stop();
                }
            });
            currentStreamRef.current = null;
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

    // 监听本地参与者变化
    useEffect(() => {
        if (localParticipant && !vadProcessorRef.current) {
            initializeVAD();
        }
    }, [localParticipant, initializeVAD]);

    // 监听麦克风状态变化
    useEffect(() => {
        if (!localParticipant || !isActive) return;

        const handleTrackMuted = () => {
            console.log('🔇 麦克风被静音，停止VAD');
            stopVAD();
        };

        const handleTrackUnmuted = () => {
            console.log('🎤 麦克风取消静音，可能需要重启VAD');
            // 可以选择自动重启VAD
        };

        // 监听轨道状态变化
        const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication) {
            audioPublication.on('muted', handleTrackMuted);
            audioPublication.on('unmuted', handleTrackUnmuted);

            return () => {
                audioPublication.off('muted', handleTrackMuted);
                audioPublication.off('unmuted', handleTrackUnmuted);
            };
        }
    }, [localParticipant, isActive, stopVAD]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理VAD Hook');
            stopVAD();
            if (vadProcessorRef.current) {
                vadProcessorRef.current.dispose();
                vadProcessorRef.current = null;
            }
        };
    }, [stopVAD]);

    return {
        vadResult,
        isActive,
        startVAD,
        stopVAD,
        updateThreshold,
        vadProcessor: vadProcessorRef.current
    };
}