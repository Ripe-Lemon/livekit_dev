import { useEffect } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';

const audioManager = AudioManager.getInstance();

export function useAudioNotifications(room: any, options: {
    enableUserJoinLeave?: boolean;
    enableMessageNotification?: boolean;
    messageVolume?: number;
} = {}) {
    const {
        enableUserJoinLeave = true,
        enableMessageNotification = true,
        messageVolume = 0.5
    } = options;

    useEffect(() => {
        if (!room) return;

        const handleParticipantConnected = (participant: any) => {
            if (enableUserJoinLeave) {
                audioManager.playSound('user-join');
            }
        };

        const handleParticipantDisconnected = (participant: any) => {
            if (enableUserJoinLeave) {
                audioManager.playSound('user-leave');
            }
        };

        // 添加消息音效处理
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            if (!enableMessageNotification) return;

            try {
                const decoder = new TextDecoder();
                const message = JSON.parse(decoder.decode(payload));
                
                // 检查是否为聊天消息
                if (message.type === 'chat') {
                    // 不为自己发送的消息播放音效
                    if (participant && participant.identity !== room.localParticipant?.identity) {
                        audioManager.playSound('message-notification', { 
                            volume: messageVolume 
                        });
                    }
                }
            } catch (error) {
                // 忽略非JSON数据
                console.debug('收到非JSON数据，跳过音效播放');
            }
        };

        // 绑定事件监听器
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        room.on('dataReceived', handleDataReceived);

        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
            room.off('dataReceived', handleDataReceived);
        };
    }, [room, enableUserJoinLeave, enableMessageNotification, messageVolume]);
}