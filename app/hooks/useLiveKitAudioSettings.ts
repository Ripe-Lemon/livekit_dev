'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useParticipants } from '@livekit/components-react';
import { Track, createLocalAudioTrack } from 'livekit-client';
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

        // 只对音频处理设置应用到 LiveKit 轨道
        if (localParticipant && (key === 'noiseSuppression' || key === 'echoCancellation' || key === 'autoGainControl')) {
            try {
                console.log(`🔄 正在应用 ${key} 设置: ${value}`);
                
                // 获取当前麦克风设备
                const currentDevices = await navigator.mediaDevices.enumerateDevices();
                const audioInputDevices = currentDevices.filter(device => device.kind === 'audioinput');
                console.log('📱 可用音频输入设备:', audioInputDevices);

                // 构建新的音频约束 - 使用更新后的设置，移除不支持的属性
                const updatedSettings = { ...liveKitSettings, [key]: value };
                const audioConstraints: MediaTrackConstraints = {
                    deviceId: undefined, // 使用默认设备
                    noiseSuppression: updatedSettings.noiseSuppression,
                    echoCancellation: updatedSettings.echoCancellation,
                    autoGainControl: updatedSettings.autoGainControl,
                    sampleRate: 48000,
                    channelCount: 1
                    // 移除 latency 和 volume，这些不是标准 MediaTrackConstraints 属性
                };

                console.log('🎛️ 应用音频约束:', audioConstraints);

                // 方法1: 直接替换轨道
                try {
                    // 创建新的音频轨道 - 修复 audio 选项类型
                    const newAudioTrack = await createLocalAudioTrack({
                        deviceId: audioConstraints.deviceId,
                        noiseSuppression: audioConstraints.noiseSuppression,
                        echoCancellation: audioConstraints.echoCancellation,
                        autoGainControl: audioConstraints.autoGainControl,
                        sampleRate: audioConstraints.sampleRate,
                        channelCount: audioConstraints.channelCount
                    });
                    
                    console.log('🎤 新音频轨道创建成功:', newAudioTrack);
                    console.log('🔧 轨道设置:', {
                        noiseSuppression: newAudioTrack.mediaStreamTrack.getSettings().noiseSuppression,
                        echoCancellation: newAudioTrack.mediaStreamTrack.getSettings().echoCancellation,
                        autoGainControl: newAudioTrack.mediaStreamTrack.getSettings().autoGainControl
                    });

                    // 获取当前的音频轨道发布
                    const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
                    
                    if (audioPublication && audioPublication.track) {
                        // 停止当前轨道
                        audioPublication.track.stop();
                        
                        // 替换为新轨道
                        await localParticipant.publishTrack(newAudioTrack, {
                            source: Track.Source.Microphone,
                            name: 'microphone'
                        });
                        
                        console.log(`✅ ${key} 设置已通过轨道替换应用: ${value}`);
                    } else {
                        // 如果没有现有轨道，直接发布新轨道
                        await localParticipant.publishTrack(newAudioTrack, {
                            source: Track.Source.Microphone,
                            name: 'microphone'
                        });
                        
                        console.log(`✅ ${key} 设置已通过新轨道发布应用: ${value}`);
                    }
                } catch (trackError) {
                    console.warn('轨道替换方法失败，尝试传统方法:', trackError);
                    
                    // 方法2: 传统的禁用/启用方法
                    await localParticipant.setMicrophoneEnabled(false);
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await localParticipant.setMicrophoneEnabled(true, audioConstraints);
                    
                    console.log(`✅ ${key} 设置已通过传统方法应用: ${value}`);
                }

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
                    }
                }, 500);

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