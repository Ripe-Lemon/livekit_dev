import { useEffect } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';
import { Track } from 'livekit-client';

const audioManager = AudioManager.getInstance();

export function useAudioNotifications(
    room: any, 
    options: {
        enableUserJoinLeave?: boolean;
        enableMessageNotification?: boolean;
        enableMediaControls?: boolean;
        enableScreenShare?: boolean;
        enableConnection?: boolean;
        messageVolume?: number;
        controlVolume?: number;
    } = {},
    chatState?: { isOpen?: boolean } // 添加聊天状态参数
) {
    const {
        enableUserJoinLeave = true,
        enableMessageNotification = true,
        enableMediaControls = true,
        enableScreenShare = true,
        enableConnection = true,
        messageVolume = 0.6,
        controlVolume = 0.7
    } = options;

    useEffect(() => {
        if (!room) return;

        // 用户加入/离开
        const handleParticipantConnected = (participant: any) => {
            if (enableUserJoinLeave) {
                console.log(`用户加入: ${participant.identity}`);
                audioManager.playSound('user-join', { volume: controlVolume });
            }
        };

        const handleParticipantDisconnected = (participant: any) => {
            if (enableUserJoinLeave) {
                console.log(`用户离开: ${participant.identity}`);
                audioManager.playSound('user-leave', { volume: controlVolume });
            }
        };

        // 消息通知 - 修改这部分来检查聊天栏状态
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            if (!enableMessageNotification) return;

            try {
                const decoder = new TextDecoder();
                const message = JSON.parse(decoder.decode(payload));
                
                if (message.type === 'chat') {
                    if (participant && participant.identity !== room.localParticipant?.identity) {
                        console.log(`收到消息来自: ${participant.identity}`);
                        
                        // 只有在聊天栏关闭时才播放音效
                        if (!chatState?.isOpen) {
                            console.log('🔊 播放新消息音效 (聊天栏关闭)');
                            audioManager.playSound('message-notification', { 
                                volume: messageVolume 
                            });
                        } else {
                            console.log('📝 收到新消息 (聊天栏开启，不播放音效)');
                        }
                    }
                }
            } catch (error) {
                console.debug('收到非JSON数据，跳过音效播放');
            }
        };

        // 音频轨道变化（静音/取消静音）
        const handleTrackMuted = (track: any, publication: any) => {
            if (!enableMediaControls || !track) return;
            
            console.log('轨道静音事件:', { 
                trackKind: track.kind, 
                trackSource: track.source,
                isLocal: publication?.participant === room.localParticipant
            });
            
            // 只处理本地参与者的音频轨道
            if (track.kind === Track.Kind.Audio && 
                publication?.participant === room.localParticipant) {
                console.log('🔇 本地音频静音');
                audioManager.playSound('mute', { volume: controlVolume });
            }
        };

        const handleTrackUnmuted = (track: any, publication: any) => {
            if (!enableMediaControls || !track) return;
            
            console.log('轨道取消静音事件:', { 
                trackKind: track.kind, 
                trackSource: track.source,
                isLocal: publication?.participant === room.localParticipant
            });
            
            // 只处理本地参与者的音频轨道
            if (track.kind === Track.Kind.Audio && 
                publication?.participant === room.localParticipant) {
                console.log('🔊 本地音频取消静音');
                audioManager.playSound('unmute', { volume: controlVolume });
            }
        };

        // 视频轨道变化（摄像头开关）
        const handleTrackPublished = (publication: any, participant: any) => {
            if (!enableMediaControls || !publication?.track || !participant) return;
            
            const track = publication.track;
            console.log('轨道发布事件:', { 
                trackKind: track.kind, 
                trackSource: track.source,
                participantIdentity: participant.identity,
                isLocal: participant === room.localParticipant
            });
            
            // 只处理本地参与者的轨道
            if (participant === room.localParticipant) {
                if (track.kind === Track.Kind.Video && track.source === Track.Source.Camera) {
                    console.log('📹 摄像头开启');
                    audioManager.playSound('camera-on', { volume: controlVolume });
                } else if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
                    if (enableScreenShare) {
                        console.log('🖥️ 屏幕共享开始');
                        audioManager.playSound('screen-share-start', { volume: controlVolume });
                    }
                }
            }
        };

        const handleTrackUnpublished = (publication: any, participant: any) => {
            if (!enableMediaControls || !publication?.track || !participant) return;
            
            const track = publication.track;
            console.log('轨道取消发布事件:', { 
                trackKind: track.kind, 
                trackSource: track.source,
                participantIdentity: participant.identity,
                isLocal: participant === room.localParticipant
            });
            
            // 只处理本地参与者的轨道
            if (participant === room.localParticipant) {
                if (track.kind === Track.Kind.Video && track.source === Track.Source.Camera) {
                    console.log('📹❌ 摄像头关闭');
                    audioManager.playSound('camera-off', { volume: controlVolume });
                } else if (track.kind === Track.Kind.Video && track.source === Track.Source.ScreenShare) {
                    if (enableScreenShare) {
                        console.log('🖥️❌ 屏幕共享结束');
                        audioManager.playSound('screen-share-stop', { volume: controlVolume });
                    }
                }
            }
        };

        // 连接状态变化
        const handleConnectionStateChanged = (state: any) => {
            if (!enableConnection) return;
            
            console.log(`连接状态变化: ${state}`);
            
            switch (state) {
                case 'connected':
                    audioManager.playSound('call-start', { volume: controlVolume });
                    break;
                case 'disconnected':
                    audioManager.playSound('call-end', { volume: controlVolume });
                    break;
                case 'reconnecting':
                    audioManager.playSound('connection-lost', { volume: controlVolume });
                    break;
                case 'reconnected':
                    audioManager.playSound('connection-restored', { volume: controlVolume });
                    break;
            }
        };

        // 绑定房间级别的事件监听器
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        room.on('dataReceived', handleDataReceived);
        room.on('connectionStateChanged', handleConnectionStateChanged);

        // 监听轨道事件 - 使用更安全的事件处理
        room.on('trackMuted', handleTrackMuted);
        room.on('trackUnmuted', handleTrackUnmuted);
        room.on('trackPublished', handleTrackPublished);
        room.on('trackUnpublished', handleTrackUnpublished);

        // 监听本地轨道变化
        const localParticipant = room.localParticipant;
        if (localParticipant) {
            console.log('设置本地参与者事件监听:', localParticipant.identity);
            
            // 使用本地参与者的事件，避免 participant 参数问题
            const handleLocalTrackMuted = (publication: any) => {
                if (!enableMediaControls || !publication?.track) return;
                
                const track = publication.track;
                console.log('本地轨道静音:', { trackKind: track.kind, trackSource: track.source });
                
                if (track.kind === Track.Kind.Audio) {
                    console.log('🔇 本地音频静音（本地事件）');
                    audioManager.playSound('mute', { volume: controlVolume });
                }
            };

            const handleLocalTrackUnmuted = (publication: any) => {
                if (!enableMediaControls || !publication?.track) return;
                
                const track = publication.track;
                console.log('本地轨道取消静音:', { trackKind: track.kind, trackSource: track.source });
                
                if (track.kind === Track.Kind.Audio) {
                    console.log('🔊 本地音频取消静音（本地事件）');
                    audioManager.playSound('unmute', { volume: controlVolume });
                }
            };

            localParticipant.on('trackMuted', handleLocalTrackMuted);
            localParticipant.on('trackUnmuted', handleLocalTrackUnmuted);
            localParticipant.on('trackPublished', handleTrackPublished);
            localParticipant.on('trackUnpublished', handleTrackUnpublished);

            // 清理函数也要更新
            return () => {
                console.log('清理音频通知事件监听器');
                
                // 清理房间事件
                room.off('participantConnected', handleParticipantConnected);
                room.off('participantDisconnected', handleParticipantDisconnected);
                room.off('dataReceived', handleDataReceived);
                room.off('trackMuted', handleTrackMuted);
                room.off('trackUnmuted', handleTrackUnmuted);
                room.off('trackPublished', handleTrackPublished);
                room.off('trackUnpublished', handleTrackUnpublished);
                room.off('connectionStateChanged', handleConnectionStateChanged);

                // 清理本地参与者事件
                localParticipant.off('trackMuted', handleLocalTrackMuted);
                localParticipant.off('trackUnmuted', handleLocalTrackUnmuted);
                localParticipant.off('trackPublished', handleTrackPublished);
                localParticipant.off('trackUnpublished', handleTrackUnpublished);
            };
        }

        return () => {
            console.log('清理音频通知事件监听器（无本地参与者）');
            
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
            room.off('dataReceived', handleDataReceived);
            room.off('trackMuted', handleTrackMuted);
            room.off('trackUnmuted', handleTrackUnmuted);
            room.off('trackPublished', handleTrackPublished);
            room.off('trackUnpublished', handleTrackUnpublished);
            room.off('connectionStateChanged', handleConnectionStateChanged);
        };
    }, [room, enableUserJoinLeave, enableMessageNotification, enableMediaControls, enableScreenShare, enableConnection, messageVolume, controlVolume, chatState?.isOpen]); // 添加 chatState?.isOpen 到依赖数组
}