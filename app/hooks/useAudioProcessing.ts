'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, createLocalAudioTrack, LocalAudioTrack } from 'livekit-client';
import { AudioProcessingSettings, VADPresetConfig } from '../types/audio';

// 导出 AudioProcessingSettings 类型
export type { AudioProcessingSettings } from '../types/audio';

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number | string) => Promise<void>;
    updateMultipleSettings: (updates: Partial<AudioProcessingSettings>) => Promise<void>;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
    applyPreset: (preset: VADPresetConfig) => Promise<void>;
    getPresets: () => VADPresetConfig[];
    applyingSettings: Set<string>; // 添加这个导出
}

// VAD预设配置
const VAD_PRESETS: VADPresetConfig[] = [
    {
        name: 'quiet',
        description: '安静环境 - 高敏感度',
        settings: {
            threshold: 0.1,
            smoothingFactor: 0.9,
            minSpeechFrames: 2,
            minSilenceFrames: 15,
            analyzeWindow: 20
        }
    },
    {
        name: 'normal',
        description: '正常环境 - 平衡设置',
        settings: {
            threshold: 0.3,
            smoothingFactor: 0.8,
            minSpeechFrames: 3,
            minSilenceFrames: 10,
            analyzeWindow: 30
        }
    },
    {
        name: 'noisy',
        description: '嘈杂环境 - 低敏感度',
        settings: {
            threshold: 0.5,
            smoothingFactor: 0.7,
            minSpeechFrames: 5,
            minSilenceFrames: 8,
            analyzeWindow: 40
        }
    },
    {
        name: 'conference',
        description: '会议模式 - 优化多人对话',
        settings: {
            threshold: 0.25,
            smoothingFactor: 0.85,
            minSpeechFrames: 2,
            minSilenceFrames: 12,
            analyzeWindow: 25
        }
    }
];

const DEFAULT_SETTINGS: AudioProcessingSettings = {
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: false,
    microphoneThreshold: 0.3,
    
    // VAD设置
    vadEnabled: false,
    vadThreshold: 0.3,
    vadSmoothingFactor: 0.8,
    vadMinSpeechFrames: 3,
    vadMinSilenceFrames: 10,
    vadAnalyzeWindow: 30,
    
    // 高级VAD设置 - 修复默认值类型
    vadSensitivity: 'medium' as const, // 使用 'medium' 而不是 'normal'
    vadNoiseGate: true,
    vadHoldTime: 100,
    vadAttackTime: 50,
    vadReleaseTime: 200
};

// 本地存储键
const STORAGE_KEY = 'livekit_audio_processing_settings';

export function useAudioProcessing(): AudioProcessingControls {
    const { localParticipant } = useLocalParticipant();
    
    // 从本地存储加载设置
    const loadSettings = useCallback((): AudioProcessingSettings => {
        if (typeof window === 'undefined') return DEFAULT_SETTINGS;
        
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...DEFAULT_SETTINGS, ...parsed };
            }
        } catch (error) {
            console.warn('加载音频处理设置失败:', error);
        }
        return DEFAULT_SETTINGS;
    }, []);

    const [settings, setSettings] = useState<AudioProcessingSettings>(loadSettings);
    const [applyingSettings, setApplyingSettings] = useState<Set<string>>(new Set());
    const currentTrackRef = useRef<LocalAudioTrack | null>(null);
    const initializedRef = useRef(false);

    // 保存设置到本地存储
    const saveSettings = useCallback((newSettings: AudioProcessingSettings) => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
            } catch (error) {
                console.warn('保存音频处理设置失败:', error);
            }
        }
    }, []);

    // 检测当前轨道的实际音频设置
    const getCurrentTrackSettings = useCallback((): MediaTrackSettings | null => {
        if (!localParticipant) return null;
        
        const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication?.track) {
            return audioPublication.track.mediaStreamTrack.getSettings();
        }
        return null;
    }, [localParticipant]);

    // 同步显示设置与实际设置
    const syncSettingsWithActualTrack = useCallback(() => {
        const actualSettings = getCurrentTrackSettings();
        if (actualSettings && !initializedRef.current) {
            console.log('🔍 检测到实际音频设置:', actualSettings);
            
            const syncedSettings: AudioProcessingSettings = {
                ...settings,
                echoCancellation: actualSettings.echoCancellation ?? false,
                noiseSuppression: actualSettings.noiseSuppression ?? true,
                autoGainControl: actualSettings.autoGainControl ?? true,
            };

            const hasChanges = 
                syncedSettings.echoCancellation !== settings.echoCancellation ||
                syncedSettings.noiseSuppression !== settings.noiseSuppression ||
                syncedSettings.autoGainControl !== settings.autoGainControl;

            if (hasChanges) {
                console.log('🔄 同步音频设置:', {
                    previous: settings,
                    actual: actualSettings,
                    synced: syncedSettings
                });
                
                setSettings(syncedSettings);
                saveSettings(syncedSettings);
            }
            
            initializedRef.current = true;
        }
    }, [settings, getCurrentTrackSettings, saveSettings]);

    // 应用音频约束到轨道
    const applyAudioConstraints = useCallback(async (newSettings: AudioProcessingSettings) => {
        if (!localParticipant) {
            console.warn('本地参与者不存在，无法应用音频设置');
            return;
        }

        console.log('🎛️ 开始应用音频处理设置:', newSettings);

        try {
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            const wasEnabled = audioPublication ? !audioPublication.isMuted : false;

            console.log(`🎤 当前麦克风状态: ${wasEnabled ? '启用' : '禁用'}`);

            if (audioPublication?.track) {
                console.log('🛑 停止当前音频轨道');
                audioPublication.track.stop();
                await localParticipant.unpublishTrack(audioPublication.track);
                console.log('📤 已取消发布当前音频轨道');
                
                if (currentTrackRef.current === audioPublication.track) {
                    currentTrackRef.current = null;
                }
            }

            await new Promise(resolve => setTimeout(resolve, 300));

            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: newSettings.echoCancellation,
                noiseSuppression: newSettings.noiseSuppression,
                autoGainControl: newSettings.autoGainControl,
                sampleRate: { ideal: 48000 },
                channelCount: { ideal: 1 },
            };

            console.log('🎛️ 应用音频约束:', audioConstraints);

            const newAudioTrack = await createLocalAudioTrack({
                ...audioConstraints,
                deviceId: 'default'
            });

            console.log('✅ 新音频轨道已创建');

            const appliedSettings = newAudioTrack.mediaStreamTrack.getSettings();
            console.log('🔍 验证新轨道设置:', {
                requested: audioConstraints,
                applied: appliedSettings
            });

            currentTrackRef.current = newAudioTrack;

            await localParticipant.publishTrack(newAudioTrack, {
                name: 'microphone',
                source: Track.Source.Microphone
            });

            console.log('📤 新音频轨道已发布');

            if (wasEnabled) {
                await localParticipant.setMicrophoneEnabled(true);
                console.log('🎤 麦克风已重新启用');
            }

            setTimeout(() => {
                const finalPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
                if (finalPublication?.track) {
                    const actualSettings = finalPublication.track.mediaStreamTrack.getSettings();
                    console.log('🔍 最终验证音频设置:', {
                        applied: actualSettings,
                        expected: newSettings,
                        microphoneEnabled: localParticipant.isMicrophoneEnabled
                    });

                    const mismatch = {
                        echoCancellation: actualSettings.echoCancellation !== newSettings.echoCancellation,
                        noiseSuppression: actualSettings.noiseSuppression !== newSettings.noiseSuppression,
                        autoGainControl: actualSettings.autoGainControl !== newSettings.autoGainControl
                    };

                    if (mismatch.echoCancellation || mismatch.noiseSuppression || mismatch.autoGainControl) {
                        console.warn('⚠️ 检测到设置不匹配:', mismatch);
                    }
                }
            }, 1000);

        } catch (error) {
            console.error('❌ 应用音频处理设置失败:', error);
            
            try {
                console.log('🔄 尝试恢复基础音频功能...');
                await localParticipant.setMicrophoneEnabled(true);
                console.log('✅ 基础音频功能已恢复');
            } catch (recoveryError) {
                console.error('❌ 音频恢复失败:', recoveryError);
            }
            
            throw error;
        }
    }, [localParticipant]);

    // 更新单个设置
    const updateSetting = useCallback(async (
        key: keyof AudioProcessingSettings, 
        value: boolean | number | string
    ) => {
        const settingKey = String(key); // 转换为字符串
        
        if (applyingSettings.has(settingKey)) {
            console.log(`⏳ ${key} 设置正在应用中，跳过`);
            return;
        }

        setApplyingSettings(prev => new Set(prev).add(settingKey));

        try {
            const newSettings = { ...settings, [key]: value };
            
            setSettings(newSettings);
            saveSettings(newSettings);

            // 对于音频处理相关设置，需要重新创建轨道
            if (key === 'autoGainControl' || key === 'noiseSuppression' || key === 'echoCancellation') {
                console.log(`🔄 开始应用 ${key} 设置: ${value}`);
                await applyAudioConstraints(newSettings);
                console.log(`✅ ${key} 设置已应用: ${value}`);
            } else {
                // VAD和其他设置不需要重新创建轨道
                console.log(`✅ ${key} 设置已更新: ${value}`);
            }

        } catch (error) {
            console.error(`❌ 更新 ${key} 设置失败:`, error);
            setSettings(settings);
            throw error;
        } finally {
            setApplyingSettings(prev => {
                const newSet = new Set(prev);
                newSet.delete(settingKey);
                return newSet;
            });
        }
    }, [settings, applyingSettings, saveSettings, applyAudioConstraints]);

    // 批量更新设置
    const updateMultipleSettings = useCallback(async (updates: Partial<AudioProcessingSettings>) => {
        const settingKeys = Object.keys(updates) as (keyof AudioProcessingSettings)[];
        const applyingKey = 'batch_update';
        
        if (applyingSettings.has(applyingKey)) {
            console.log('⏳ 批量更新正在进行中，跳过');
            return;
        }

        setApplyingSettings(prev => new Set(prev).add(applyingKey));

        try {
            const newSettings = { ...settings, ...updates };
            
            setSettings(newSettings);
            saveSettings(newSettings);

            // 检查是否需要重新创建轨道
            const needsTrackRecreation = settingKeys.some(key => 
                key === 'autoGainControl' || key === 'noiseSuppression' || key === 'echoCancellation'
            );

            if (needsTrackRecreation) {
                console.log('🔄 批量应用音频处理设置');
                await applyAudioConstraints(newSettings);
                console.log('✅ 批量设置已应用');
            } else {
                console.log('✅ 批量设置已更新（无需重新创建轨道）');
            }

        } catch (error) {
            console.error('❌ 批量更新设置失败:', error);
            setSettings(settings);
            throw error;
        } finally {
            setApplyingSettings(prev => {
                const newSet = new Set(prev);
                newSet.delete(applyingKey);
                return newSet;
            });
        }
    }, [settings, applyingSettings, saveSettings, applyAudioConstraints]);

    // 检查是否正在应用设置
    const isApplying = useCallback((key: keyof AudioProcessingSettings) => {
        return applyingSettings.has(String(key)) || applyingSettings.has('batch_update');
    }, [applyingSettings]);

    // 重置为默认设置
    const resetToDefaults = useCallback(async () => {
        console.log('🔄 重置音频处理设置为默认值');
        
        try {
            setSettings(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
            await applyAudioConstraints(DEFAULT_SETTINGS);
            console.log('✅ 已重置为默认设置');
            initializedRef.current = false;
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, applyAudioConstraints]);

    // 应用VAD预设
    const applyPreset = useCallback(async (preset: VADPresetConfig) => {
        console.log(`🎛️ 应用VAD预设: ${preset.name}`);
        
        try {
            await updateMultipleSettings({
                vadThreshold: preset.settings.threshold,
                vadSmoothingFactor: preset.settings.smoothingFactor,
                vadMinSpeechFrames: preset.settings.minSpeechFrames,
                vadMinSilenceFrames: preset.settings.minSilenceFrames,
                vadAnalyzeWindow: preset.settings.analyzeWindow,
                vadSensitivity: 'custom'
            });
            console.log(`✅ VAD预设 ${preset.name} 已应用`);
        } catch (error) {
            console.error(`❌ 应用VAD预设 ${preset.name} 失败:`, error);
            throw error;
        }
    }, [updateMultipleSettings]);

    // 获取预设列表
    const getPresets = useCallback(() => VAD_PRESETS, []);

    // 组件挂载时初始化
    useEffect(() => {
        if (localParticipant && !initializedRef.current) {
            console.log('🎤 初始化音频处理模块');
            
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                currentTrackRef.current = audioPublication.track as LocalAudioTrack;
                setTimeout(() => syncSettingsWithActualTrack(), 1000);
            }
        }
    }, [localParticipant, syncSettingsWithActualTrack]);

    // 监听轨道变化
    useEffect(() => {
        if (localParticipant) {
            const handleTrackSubscribed = () => {
                setTimeout(() => syncSettingsWithActualTrack(), 500);
            };

            localParticipant.on('trackPublished', handleTrackSubscribed);
            
            return () => {
                localParticipant.off('trackPublished', handleTrackSubscribed);
            };
        }
    }, [localParticipant, syncSettingsWithActualTrack]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            if (currentTrackRef.current) {
                currentTrackRef.current = null;
            }
            initializedRef.current = false;
        };
    }, []);

    return {
        settings,
        updateSetting,
        updateMultipleSettings,
        isApplying,
        resetToDefaults,
        applyPreset,
        getPresets,
        applyingSettings // 导出这个属性
    };
}