'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { AudioManager } from '../lib/audio/AudioManager';
import { LiveKitAudioSettings, ParticipantVolumeSettings } from '../types/audio';

export function useLiveKitAudioSettings() {
    const { localParticipant } = useLocalParticipant();
    const participants = useParticipants();
    const [audioManager] = useState(() => AudioManager.getInstance());

    const [liveKitSettings, setLiveKitSettings] = useState<LiveKitAudioSettings>(
        audioManager.getLiveKitAudioSettings()
    );
    
    const [participantVolumes, setParticipantVolumes] = useState<ParticipantVolumeSettings>(
        audioManager.getParticipantVolumes()
    );

    // 初始化参与者音量
    useEffect(() => {
        participants.forEach(participant => {
            if (!participant.isLocal) {
                audioManager.initializeParticipantVolume(participant.identity);
            }
        });
        setParticipantVolumes(audioManager.getParticipantVolumes());
    }, [participants, audioManager]);

    // 更新 LiveKit 音频设置（实际应用到轨道）
    const updateLiveKitSetting = useCallback(async (key: keyof LiveKitAudioSettings, value: boolean | number) => {
        const newSettings = { [key]: value };
        
        // 立即更新本地状态
        setLiveKitSettings(prev => ({ ...prev, ...newSettings }));
        
        // 保存到 AudioManager
        audioManager.updateLiveKitAudioSettings(newSettings);

        // 应用到 LiveKit 轨道
        if (localParticipant && (key === 'noiseSuppression' || key === 'echoCancellation' || key === 'autoGainControl')) {
            try {
                // 使用正确的 LiveKit API 获取音频轨道
                const audioTrackPublications = Array.from(localParticipant.trackPublications.values());
                const microphonePublication = audioTrackPublications.find(
                    pub => pub.source === Track.Source.Microphone && pub.track
                );
                
                if (microphonePublication?.track) {
                    console.log(`🔄 正在应用 ${key} 设置...`);
                    
                    // 重新启用麦克风轨道以应用新的音频约束
                    await localParticipant.setMicrophoneEnabled(false);
                    
                    // 短暂延迟确保轨道完全停用
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // 获取新的音频约束
                    const audioConstraints: MediaTrackConstraints = {
                        noiseSuppression: key === 'noiseSuppression' ? value as boolean : liveKitSettings.noiseSuppression,
                        echoCancellation: key === 'echoCancellation' ? value as boolean : liveKitSettings.echoCancellation,
                        autoGainControl: key === 'autoGainControl' ? value as boolean : liveKitSettings.autoGainControl,
                        sampleRate: 48000,
                        channelCount: 1
                    };

                    // 重新启用麦克风 - 使用正确的 LiveKit API
                    await localParticipant.setMicrophoneEnabled(true, audioConstraints);
                    
                    console.log(`✅ ${key} 设置已应用:`, value);
                } else {
                    console.warn('❌ 未找到麦克风轨道，无法应用音频设置');
                }
            } catch (error) {
                console.error(`❌ 应用 ${key} 设置失败:`, error);
                
                // 如果应用失败，尝试恢复麦克风
                try {
                    await localParticipant.setMicrophoneEnabled(true);
                    console.log('🔄 已恢复麦克风');
                } catch (recoveryError) {
                    console.error('❌ 恢复麦克风失败:', recoveryError);
                }
            }
        }
    }, [localParticipant, liveKitSettings, audioManager]);

    // 更新参与者音量
    const updateParticipantVolume = useCallback((participantId: string, volume: number) => {
        audioManager.setParticipantVolume(participantId, volume);
        setParticipantVolumes(audioManager.getParticipantVolumes());
    }, [audioManager]);

    // 获取参与者音量
    const getParticipantVolume = useCallback((participantId: string) => {
        return audioManager.getParticipantVolume(participantId);
    }, [audioManager]);

    return {
        liveKitSettings,
        participantVolumes,
        updateLiveKitSetting,
        updateParticipantVolume,
        getParticipantVolume
    };
}