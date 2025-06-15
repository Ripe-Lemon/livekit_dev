import { useEffect } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';

const audioManager = AudioManager.getInstance();

export function useAudioNotifications(room: any) {
    useEffect(() => {
        const handleParticipantConnected = (participant: any) => {
            audioManager.playSound('user-join');
        };

        const handleParticipantDisconnected = (participant: any) => {
            audioManager.playSound('user-leave');
        };

        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);

        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
        };
    }, [room]);
}