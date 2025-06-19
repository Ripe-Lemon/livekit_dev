'use client';

import { useState, useCallback, useEffect } from 'react';
import { Track } from 'livekit-client';

export interface TrackAnalysisResult {
    participantId: string;
    trackSid: string;
    trackName: string;
    source: string;
    kind: string;
    isMuted: boolean;
    isSubscribed: boolean;
    isEnabled: boolean;
    track?: any;
    mediaTrackInfo?: {
        label: string;
        id: string;
        readyState: string;
        enabled: boolean;
        muted: boolean;
        settings: any;
        constraints?: any;
        capabilities?: any;
    };
    vadAnalysis?: {
        是否VAD处理: boolean;
        回声消除: boolean | undefined;
        噪声抑制: boolean | undefined;
        自动增益: boolean | undefined;
        采样率: number | undefined;
        声道数: number | undefined;
        设备ID: string | undefined;
    };
    timestamp: string;
}

export interface VolumeMonitorData {
    participantId: string;
    timestamp: number;
    rmsVolume: number;
    peakVolume: number;
    trackState: string;
    trackEnabled: boolean;
    publicationMuted: boolean;
    subscriptionState: boolean;
}

export function useTrackDebugger(room: any) {
    const [trackAnalysis, setTrackAnalysis] = useState<TrackAnalysisResult[]>([]);
    const [volumeMonitors, setVolumeMonitors] = useState<Map<string, any>>(new Map());
    const [isAutoMonitoring, setIsAutoMonitoring] = useState(false);

    // 分析单个音频轨道
    const analyzeAudioTrack = useCallback((track: any, participant: any, publication?: any): TrackAnalysisResult | null => {
        if (!track || track.kind !== 'audio') return null;

        const mediaStreamTrack = track.mediaStreamTrack;
        if (!mediaStreamTrack) return null;

        const trackInfo: TrackAnalysisResult = {
            participantId: participant.identity,
            trackSid: publication?.trackSid || track.sid || track.id,
            trackName: publication?.trackName || track.name || 'unnamed',
            source: publication?.source || track.source || 'unknown',
            kind: track.kind,
            isMuted: publication?.isMuted || false,
            isSubscribed: publication?.isSubscribed || false,
            isEnabled: publication?.isEnabled || true,
            track: track,
            timestamp: new Date().toISOString()
        };

        // 媒体轨道信息
        trackInfo.mediaTrackInfo = {
            label: mediaStreamTrack.label,
            id: mediaStreamTrack.id,
            readyState: mediaStreamTrack.readyState,
            enabled: mediaStreamTrack.enabled,
            muted: mediaStreamTrack.muted,
            settings: mediaStreamTrack.getSettings()
        };

        // 获取约束信息
        try {
            trackInfo.mediaTrackInfo.constraints = mediaStreamTrack.getConstraints();
        } catch (error) {
            console.warn('无法获取音频约束:', error);
        }

        // 获取能力信息
        try {
            trackInfo.mediaTrackInfo.capabilities = mediaStreamTrack.getCapabilities();
        } catch (error) {
            console.warn('无法获取音频能力:', error);
        }

        // VAD分析
        if (trackInfo.mediaTrackInfo.settings) {
            const settings = trackInfo.mediaTrackInfo.settings;
            trackInfo.vadAnalysis = {
                是否VAD处理: trackInfo.trackName === 'microphone' && 
                           (settings.echoCancellation === false ||
                            settings.noiseSuppression === false ||
                            settings.autoGainControl === false),
                回声消除: settings.echoCancellation,
                噪声抑制: settings.noiseSuppression,
                自动增益: settings.autoGainControl,
                采样率: settings.sampleRate,
                声道数: settings.channelCount,
                设备ID: settings.deviceId
            };
        }

        return trackInfo;
    }, []);

    // 获取所有远程参与者的音轨信息
    const analyzeAllRemoteTracks = useCallback(() => {
        if (!room) return [];

        const analysis: TrackAnalysisResult[] = [];
        
        console.group('🔍 分析所有远程音轨');
        
        room.remoteParticipants.forEach((participant: any) => {
            console.group(`👤 参与者: ${participant.identity}`);
            
            participant.audioTrackPublications.forEach((publication: any) => {
                const trackInfo = analyzeAudioTrack(publication.track, participant, publication);
                
                if (trackInfo) {
                    analysis.push(trackInfo);
                    
                    console.log('🎤 音轨详细信息:', {
                        基础信息: {
                            参与者: trackInfo.participantId,
                            轨道ID: trackInfo.trackSid,
                            轨道名称: trackInfo.trackName,
                            音频源: trackInfo.source,
                            是否静音: trackInfo.isMuted,
                            订阅状态: trackInfo.isSubscribed
                        },
                        轨道详情: trackInfo.mediaTrackInfo,
                        VAD分析: trackInfo.vadAnalysis
                    });

                    // 判断轨道类型
                    if (trackInfo.vadAnalysis?.是否VAD处理) {
                        console.log('✅ 这是VAD处理后的音轨（音频处理已关闭）');
                    } else {
                        console.log('📢 这是标准音轨（启用了音频处理）');
                    }
                }
            });
            
            console.groupEnd();
        });

        console.groupEnd();
        
        setTrackAnalysis(analysis);
        return analysis;
    }, [room, analyzeAudioTrack]);

    // 监控单个远程音轨音量
    const monitorRemoteTrackVolume = useCallback((
        participantId: string, 
        duration: number = 10000,
        onVolumeUpdate?: (data: VolumeMonitorData) => void
    ) => {
        if (!room) {
            console.warn('房间不存在');
            return null;
        }

        const participant = Array.from(room.remoteParticipants.values())
            .find((p: any) => p.identity === participantId) as { audioTrackPublications: Map<string, any>; identity: string };

        if (!participant) {
            console.warn(`找不到参与者: ${participantId}`);
            return null;
        }

        const audioPublication = Array.from(participant.audioTrackPublications.values())[0];
        if (!audioPublication || !audioPublication.track) {
            console.warn(`参与者 ${participantId} 没有音频轨道`);
            return null;
        }

        const track = audioPublication.track.mediaStreamTrack;
        const stream = new MediaStream([track]);
        
        let audioContext: AudioContext;
        let source: MediaStreamAudioSourceNode;
        let analyser: AnalyserNode;
        
        try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.3;
            analyser.minDecibels = -100;
            analyser.maxDecibels = -10;
            
            source.connect(analyser);
        } catch (error) {
            console.error('创建音频分析器失败:', error);
            return null;
        }
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        console.log(`🎧 开始监控 ${participantId} 的音频轨道 ${duration/1000} 秒`);
        console.log('🔍 音频分析器设置:', {
            fftSize: analyser.fftSize,
            frequencyBinCount: analyser.frequencyBinCount,
            minDecibels: analyser.minDecibels,
            maxDecibels: analyser.maxDecibels,
            smoothingTimeConstant: analyser.smoothingTimeConstant,
            audioContextSampleRate: audioContext.sampleRate,
            audioContextState: audioContext.state
        });
        
        let sampleCount = 0;
        const startTime = Date.now();
        
        const monitor = () => {
            analyser.getByteTimeDomainData(dataArray);
            
            // 计算多种音量指标
            let sum = 0;
            let peak = 0;
            let nonZeroCount = 0;
            
            for (let i = 0; i < dataArray.length; i++) {
                const amplitude = Math.abs(dataArray[i] - 128) / 128;
                sum += amplitude * amplitude;
                peak = Math.max(peak, amplitude);
                if (dataArray[i] !== 128) nonZeroCount++;
            }
            
            const rmsVolume = Math.sqrt(sum / dataArray.length);
            const dataPercent = (nonZeroCount / dataArray.length) * 100;
            
            sampleCount++;
            const elapsed = Date.now() - startTime;
            
            const volumeData: VolumeMonitorData = {
                participantId,
                timestamp: Date.now(),
                rmsVolume,
                peakVolume: peak,
                trackState: track.readyState,
                trackEnabled: track.enabled,
                publicationMuted: audioPublication.isMuted,
                subscriptionState: audioPublication.isSubscribed
            };
            
            // 调用回调函数
            if (onVolumeUpdate) {
                onVolumeUpdate(volumeData);
            }
            
            if (rmsVolume > 0.005 || sampleCount % 5 === 0) {
                console.log(`🎵 ${participantId} 音量监控 [${sampleCount}] - ${(elapsed/1000).toFixed(1)}s:`, {
                    RMS音量: rmsVolume.toFixed(6),
                    峰值音量: peak.toFixed(6),
                    数据覆盖率: `${dataPercent.toFixed(1)}%`,
                    轨道状态: track.readyState,
                    轨道启用: track.enabled,
                    发布静音: audioPublication.isMuted,
                    订阅状态: audioPublication.isSubscribed,
                    音频上下文状态: audioContext.state,
                    样本数据: Array.from(dataArray.slice(0, 8))
                });
            }
        };
        
        const interval = setInterval(monitor, 1000);
        
        // 存储监控器引用
        const monitorRef = {
            interval,
            audioContext,
            participantId,
            startTime
        };
        
        volumeMonitors.set(participantId, monitorRef);
        setVolumeMonitors(new Map(volumeMonitors));
        
        // 定时清理
        const timeout = setTimeout(() => {
            clearInterval(interval);
            audioContext.close();
            volumeMonitors.delete(participantId);
            setVolumeMonitors(new Map(volumeMonitors));
            console.log(`🔚 停止监控 ${participantId} 的音频轨道`);
        }, duration);
        
        return {
            stop: () => {
                clearInterval(interval);
                clearTimeout(timeout);
                audioContext.close();
                volumeMonitors.delete(participantId);
                setVolumeMonitors(new Map(volumeMonitors));
                console.log(`⏹️ 手动停止监控 ${participantId} 的音频轨道`);
            }
        };
        
    }, [room, volumeMonitors]);

    // 停止所有音量监控
    const stopAllVolumeMonitors = useCallback(() => {
        volumeMonitors.forEach((monitor, participantId) => {
            clearInterval(monitor.interval);
            if (monitor.audioContext && monitor.audioContext.state !== 'closed') {
                monitor.audioContext.close();
            }
            console.log(`🛑 停止监控 ${participantId}`);
        });
        
        volumeMonitors.clear();
        setVolumeMonitors(new Map());
        setIsAutoMonitoring(false);
        
        console.log('🔚 所有音量监控已停止');
    }, [volumeMonitors]);

    // 自动监控所有活跃的远程音轨
    const startAutoMonitoring = useCallback((duration: number = 30000) => {
        if (isAutoMonitoring) {
            console.warn('自动监控已在运行中');
            return;
        }

        console.log('🚀 开始自动监控所有远程音轨...');
        setIsAutoMonitoring(true);
        
        const analysis = analyzeAllRemoteTracks();
        
        analysis.forEach((trackInfo, index) => {
            if (trackInfo.track && !trackInfo.isMuted && trackInfo.isSubscribed) {
                console.log(`🎧 自动开始监控: ${trackInfo.participantId}`);
                
                // 错开启动时间避免冲突
                setTimeout(() => {
                    monitorRemoteTrackVolume(trackInfo.participantId, duration);
                }, index * 500);
            }
        });
        
        // 自动停止
        setTimeout(() => {
            setIsAutoMonitoring(false);
            console.log('🔚 自动监控时间结束');
        }, duration + 5000); // 多等5秒确保所有监控都结束
        
    }, [isAutoMonitoring, analyzeAllRemoteTracks, monitorRemoteTrackVolume]);

    // 获取监控状态
    const getMonitoringStatus = useCallback(() => {
        return {
            activeMonitors: Array.from(volumeMonitors.keys()),
            isAutoMonitoring,
            totalActiveMonitors: volumeMonitors.size
        };
    }, [volumeMonitors, isAutoMonitoring]);

    // 清理函数
    useEffect(() => {
        return () => {
            stopAllVolumeMonitors();
        };
    }, [stopAllVolumeMonitors]);

    return {
        // 状态
        trackAnalysis,
        volumeMonitors,
        isAutoMonitoring,
        
        // 分析功能
        analyzeAudioTrack,
        analyzeAllRemoteTracks,
        
        // 监控功能
        monitorRemoteTrackVolume,
        stopAllVolumeMonitors,
        startAutoMonitoring,
        getMonitoringStatus
    };
}