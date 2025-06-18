'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useParticipants, useRoomContext } from '@livekit/components-react';
import { Track, createLocalAudioTrack } from 'livekit-client';
import { AudioManager } from '../lib/audio/AudioManager';
import { LiveKitAudioSettings, ParticipantVolumeSettings } from '../types/audio';

// 定义 AudioCaptureOptions 接口
interface AudioCaptureOptions {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    sampleRate?: number;
    channelCount?: number;
    deviceId?: string;
}

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

    // 添加正在应用设置的跟踪
    const applyingSettingsRef = useRef<Set<string>>(new Set());

    // 初始化参与者音量
    useEffect(() => {
        participants.forEach(participant => {
            if (!participant.isLocal) {
                audioManager.initializeParticipantVolume(participant.identity);
            }
        });
        setParticipantVolumes(audioManager.getParticipantVolumes());
    }, [participants, audioManager]);

    // 添加 DOM 变化监听器来跟踪音频元素
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                // 检查是否有新的音频元素添加
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as Element;
                        
                        // 检查是否是音频元素
                        if (element.tagName === 'AUDIO') {
                            console.log('🔊 检测到新的音频元素:', {
                                src: (element as HTMLAudioElement).src,
                                className: element.className,
                                dataset: { ...(element as HTMLElement).dataset }
                            });
                        }
                        
                        // 检查子元素中是否有音频元素
                        const audioElements = element.querySelectorAll('audio');
                        if (audioElements.length > 0) {
                            console.log(`🔊 检测到包含 ${audioElements.length} 个音频元素的容器:`, {
                                tagName: element.tagName,
                                className: element.className,
                                dataset: { ...(element as HTMLElement).dataset }
                            });
                            
                            // 应用已保存的音量设置
                            setTimeout(() => {
                                participants.forEach(participant => {
                                    if (!participant.isLocal) {
                                        const savedVolume = audioManager.getParticipantVolume(participant.identity);
                                        if (savedVolume !== 100) {
                                            console.log(`🔄 重新应用参与者 ${participant.identity} 的音量设置: ${savedVolume}%`);
                                            audioManager.setParticipantVolume(participant.identity, savedVolume);
                                        }
                                    }
                                });
                            }, 100);
                        }
                    }
                });
            });
        });

        // 开始观察 DOM 变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        return () => {
            observer.disconnect();
        };
    }, [participants, audioManager]);

    // 当参与者列表变化时，重新应用音量设置
    useEffect(() => {
        // 延迟一下，确保 DOM 已更新
        const timeoutId = setTimeout(() => {
            participants.forEach(participant => {
                if (!participant.isLocal) {
                    const savedVolume = audioManager.getParticipantVolume(participant.identity);
                    if (savedVolume !== 100) {
                        console.log(`🔄 参与者变化，重新应用音量设置: ${participant.identity} -> ${savedVolume}%`);
                        audioManager.setParticipantVolume(participant.identity, savedVolume);
                    }
                }
            });
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [participants, audioManager]);

    // 更新 LiveKit 音频设置（实际应用到轨道）
    const updateLiveKitSetting = useCallback(async (key: keyof LiveKitAudioSettings, value: boolean | number) => {
        // 检查是否已经在应用这个设置
        if (applyingSettingsRef.current.has(key)) {
            console.log(`⏳ ${key} 设置正在应用中，跳过重复请求`);
            return;
        }

        // 标记为正在应用
        applyingSettingsRef.current.add(key);

        try {
            const newSettings = { [key]: value };
            
            // 立即更新本地状态
            setLiveKitSettings(prev => ({ ...prev, ...newSettings }));
            
            // 保存到 AudioManager
            audioManager.updateLiveKitAudioSettings(newSettings);

            // 只对音频处理设置应用到 LiveKit 轨道
            if (localParticipant && (key === 'noiseSuppression' || key === 'echoCancellation' || key === 'autoGainControl')) {
                console.log(`🔄 开始应用 ${key} 设置: ${value}`);
                
                // 构建新的音频捕获选项 - 使用更新后的设置
                const updatedSettings = { ...liveKitSettings, [key]: value };
                
                // 使用 LiveKit 的 AudioCaptureOptions
                const audioCaptureOptions: AudioCaptureOptions = {
                    echoCancellation: updatedSettings.echoCancellation,
                    noiseSuppression: updatedSettings.noiseSuppression,
                    autoGainControl: updatedSettings.autoGainControl,
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
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                // 使用正确的 LiveKit 方法重新启用麦克风
                console.log('🎤 使用新设置重新启用麦克风');
                await localParticipant.setMicrophoneEnabled(true, audioCaptureOptions);
                
                console.log(`✅ ${key} 设置已通过 AudioCaptureOptions 应用: ${value}`);

                // 验证设置是否真正应用（延迟验证，给轨道时间稳定）
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
            } else {
                // 对于非音频处理设置，立即完成
                console.log(`✅ ${key} 设置已保存: ${value}`);
            }

        } catch (error) {
            console.error(`❌ 应用 ${key} 设置失败:`, error);
            
            // 如果应用失败，尝试恢复麦克风
            if (localParticipant && (key === 'noiseSuppression' || key === 'echoCancellation' || key === 'autoGainControl')) {
                try {
                    console.log('🔄 尝试恢复麦克风...');
                    await localParticipant.setMicrophoneEnabled(true);
                    console.log('🔄 已恢复麦克风');
                } catch (recoveryError) {
                    console.error('❌ 恢复麦克风失败:', recoveryError);
                }
            }
            
            throw error; // 重新抛出错误让调用者处理
        } finally {
            // 移除正在应用的标记
            applyingSettingsRef.current.delete(key);
        }
    }, [localParticipant, liveKitSettings, audioManager]);

    // 检查设置是否正在应用
    const isApplyingSetting = useCallback((key: keyof LiveKitAudioSettings) => {
        return applyingSettingsRef.current.has(key);
    }, []);

    // 更新参与者音量
    const updateParticipantVolume = useCallback((participantId: string, volume: number) => {
        audioManager.setParticipantVolume(participantId, volume);
        setParticipantVolumes(audioManager.getParticipantVolumes());
    }, [audioManager]);

    // 获取参与者音量用用户名
    const getParticipantVolume = useCallback((participantId: string) => {
        return audioManager.getParticipantVolumeUseName(participantId);
    }, [audioManager]);

    return {
        liveKitSettings,
        participantVolumes,
        updateLiveKitSetting,
        updateParticipantVolume,
        getParticipantVolume,
        isApplyingSetting  // 新增：检查是否正在应用设置
    };
}