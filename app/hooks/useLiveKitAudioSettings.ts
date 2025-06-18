'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import { Track, createLocalAudioTrack, AudioCaptureOptions } from 'livekit-client';
import { AudioManager } from '../lib/audio/AudioManager';
import { LiveKitAudioSettings, ParticipantVolumeSettings } from '../types/audio';

export function useLiveKitAudioSettings() {
    const { localParticipant } = useLocalParticipant();
    const participants = useParticipants();
    const room = useRoomContext();
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

        // 只对音频处理设置应用到 LiveKit 轨道
        if (localParticipant && (key === 'noiseSuppression' || key === 'echoCancellation' || key === 'autoGainControl')) {
            try {
                console.log(`🔄 正在应用 ${key} 设置: ${value}`);
                
                // 构建新的音频捕获选项 - 使用更新后的设置
                const updatedSettings = { ...liveKitSettings, [key]: value };
                
                // 使用 LiveKit 的 AudioCaptureOptions
                const audioCaptureOptions: AudioCaptureOptions = {
                    echoCancellation: updatedSettings.echoCancellation,
                    noiseSuppression: updatedSettings.noiseSuppression,
                    autoGainControl: updatedSettings.autoGainControl,
                    // 添加其他音频选项
                    sampleRate: 48000,
                    channelCount: 1,
                };

                console.log('🎛️ 应用音频捕获选项:', audioCaptureOptions);

                // 获取当前的音频轨道发布
                const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
                
                if (audioPublication && audioPublication.track) {
                    // 停止当前轨道
                    console.log('🛑 停止当前音频轨道');
                    audioPublication.track.stop();
                    
                    // 取消发布当前轨道
                    await localParticipant.unpublishTrack(audioPublication.track);
                    console.log('📤 已取消发布当前音频轨道');
                    
                    // 等待一下确保轨道完全停止
                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // 使用正确的 LiveKit 方法重新启用麦克风
                console.log('🎤 使用新设置重新启用麦克风');
                await localParticipant.setMicrophoneEnabled(true, audioCaptureOptions);
                
                console.log(`✅ ${key} 设置已通过 AudioCaptureOptions 应用: ${value}`);

                // 验证设置是否真正应用
                setTimeout(() => {
                    const currentPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
                    if (currentPublication?.track) {
                        const actualSettings = currentPublication.track.mediaStreamTrack.getSettings();
                        console.log('🔍 验证音频设置:', {
                            noiseSuppression: actualSettings.noiseSuppression,
                            echoCancellation: actualSettings.echoCancellation,
                            autoGainControl: actualSettings.autoGainControl,
                            expected: updatedSettings
                        });
                        
                        // 检查设置是否正确应用
                        const isCorrect = 
                            actualSettings.noiseSuppression === updatedSettings.noiseSuppression &&
                            actualSettings.echoCancellation === updatedSettings.echoCancellation &&
                            actualSettings.autoGainControl === updatedSettings.autoGainControl;
                            
                        if (isCorrect) {
                            console.log('✅ 音频设置验证成功');
                        } else {
                            console.warn('⚠️ 音频设置可能未完全应用，但这在某些浏览器中是正常的');
                        }
                    }
                }, 1000);

            } catch (error) {
                console.error(`❌ 应用 ${key} 设置失败:`, error);
                
                // 如果应用失败，尝试恢复麦克风
                try {
                    console.log('🔄 尝试恢复麦克风...');
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
        
        // 立即应用音量设置到实际的音频元素
        const applyVolumeToElements = () => {
            // 查找多种可能的音频元素选择器
            const selectors = [
                `audio[data-lk-participant="${participantId}"]`,
                `audio[data-participant-id="${participantId}"]`,
                `audio[data-participant="${participantId}"]`,
                `[data-lk-participant-id="${participantId}"] audio`,
                `[data-participant-identity="${participantId}"] audio`,
                `[data-testid="participant-${participantId}"] audio`,
                // LiveKit 组件的常见选择器
                `.lk-participant-tile[data-lk-participant-id="${participantId}"] audio`,
                `.lk-audio-track[data-lk-participant="${participantId}"]`
            ];

            let foundElements = 0;
            
            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element instanceof HTMLAudioElement) {
                        const volumeValue = Math.min(volume / 100, 1); // HTML5 audio 最大为 1
                        element.volume = volumeValue;
                        foundElements++;
                        console.log(`🔊 已设置音频元素音量: ${selector} -> ${volume}%`);
                    }
                });
            });

            // 如果没找到特定的元素，尝试查找所有音频元素
            if (foundElements === 0) {
                const allAudioElements = document.querySelectorAll('audio');
                console.log(`🔍 未找到特定参与者音频元素，尝试查找所有音频元素 (${allAudioElements.length} 个):`);
                
                allAudioElements.forEach((element, index) => {
                    console.log(`音频元素 ${index}:`, {
                        src: element.src,
                        dataset: (element as HTMLElement).dataset,
                        attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`)
                    });
                });
            }

            return foundElements;
        };

        const foundElements = applyVolumeToElements();
        
        // 如果立即没找到，稍后重试（DOM 可能还在更新）
        if (foundElements === 0) {
            setTimeout(applyVolumeToElements, 500);
            setTimeout(applyVolumeToElements, 1000);
        }
        
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