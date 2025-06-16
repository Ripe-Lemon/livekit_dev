import { useEffect } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';
import { Track } from 'livekit-client';

const audioManager = AudioManager.getInstance();

export function useAudioNotifications(room: any, options: {
    enableUserJoinLeave?: boolean;
    enableMessageNotification?: boolean;
    enableMediaControls?: boolean;
    enableScreenShare?: boolean;
    enableConnection?: boolean;
    messageVolume?: number;
    controlVolume?: number;
} = {}) {
    const {
        enableUserJoinLeave = true,
        enableMessageNotification = true,
        enableMediaControls = true,
        enableScreenShare = true,
        enableConnection = true,
        messageVolume = 0.5,
        controlVolume = 0.6
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

        // 消息通知
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            if (!enableMessageNotification) return;

            try {
                const decoder = new TextDecoder();
                const message = JSON.parse(decoder.decode(payload));
                
                if (message.type === 'chat') {
                    if (participant && participant.identity !== room.localParticipant?.identity) {
                        console.log(`收到消息来自: ${participant.identity}`);
                        audioManager.playSound('message-notification', { 
                            volume: messageVolume 
                        });
                    }
                }
            } catch (error) {
                console.debug('收到非JSON数据，跳过音效播放');
            }
        };

        // 音频轨道变化（静音/取消静音）
        const handleTrackMuted = (track: any, participant: any) => {
            if (!enableMediaControls) return;
            
            if (track.kind === Track.Kind.Audio) {
                if (participant.identity === room.localParticipant?.identity) {
                    console.log('本地音频静音');
                    audioManager.playSound('mute', { volume: controlVolume });
                }
            }
        };

        const handleTrackUnmuted = (track: any, participant: any) => {
            if (!enableMediaControls) return;
            
            if (track.kind === Track.Kind.Audio) {
                if (participant.identity === room.localParticipant?.identity) {
                    console.log('本地音频取消静音');
                    audioManager.playSound('unmute', { volume: controlVolume });
                }
            }
        };

        // 视频轨道变化（摄像头开关）
        const handleTrackSubscribed = (track: any, publication: any, participant: any) => {
            if (!enableMediaControls) return;
            
            if (track.kind === Track.Kind.Video && participant.identity === room.localParticipant?.identity) {
                if (track.source === Track.Source.Camera) {
                    console.log('摄像头开启');
                    audioManager.playSound('camera-on', { volume: controlVolume });
                } else if (track.source === Track.Source.ScreenShare) {
                    if (enableScreenShare) {
                        console.log('屏幕共享开始');
                        audioManager.playSound('screen-share-start', { volume: controlVolume });
                    }
                }
            }
        };

        const handleTrackUnsubscribed = (track: any, publication: any, participant: any) => {
            if (!enableMediaControls) return;
            
            if (track.kind === Track.Kind.Video && participant.identity === room.localParticipant?.identity) {
                if (track.source === Track.Source.Camera) {
                    console.log('摄像头关闭');
                    audioManager.playSound('camera-off', { volume: controlVolume });
                } else if (track.source === Track.Source.ScreenShare) {
                    if (enableScreenShare) {
                        console.log('屏幕共享结束');
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

        // 绑定所有事件监听器
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        room.on('dataReceived', handleDataReceived);
        room.on('trackMuted', handleTrackMuted);
        room.on('trackUnmuted', handleTrackUnmuted);
        room.on('trackSubscribed', handleTrackSubscribed);
        room.on('trackUnsubscribed', handleTrackUnsubscribed);
        room.on('connectionStateChanged', handleConnectionStateChanged);

        // 监听本地轨道变化
        const localParticipant = room.localParticipant;
        if (localParticipant) {
            localParticipant.on('trackMuted', handleTrackMuted);
            localParticipant.on('trackUnmuted', handleTrackUnmuted);
            localParticipant.on('trackPublished', (publication: any) => {
                const track = publication.track;
                if (track) {
                    handleTrackSubscribed(track, publication, localParticipant);
                }
            });
            localParticipant.on('trackUnpublished', (publication: any) => {
                const track = publication.track;
                if (track) {
                    handleTrackUnsubscribed(track, publication, localParticipant);
                }
            });
        }

        return () => {
            // 清理所有事件监听器
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
            room.off('dataReceived', handleDataReceived);
            room.off('trackMuted', handleTrackMuted);
            room.off('trackUnmuted', handleTrackUnmuted);
            room.off('trackSubscribed', handleTrackSubscribed);
            room.off('trackUnsubscribed', handleTrackUnsubscribed);
            room.off('connectionStateChanged', handleConnectionStateChanged);

            if (localParticipant) {
                localParticipant.off('trackMuted', handleTrackMuted);
                localParticipant.off('trackUnmuted', handleTrackUnmuted);
                localParticipant.off('trackPublished', () => {});
                localParticipant.off('trackUnpublished', () => {});
            }
        };
    }, [room, enableUserJoinLeave, enableMessageNotification, enableMediaControls, enableScreenShare, enableConnection, messageVolume, controlVolume]);
}