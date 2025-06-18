'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, createLocalAudioTrack, LocalAudioTrack } from 'livekit-client';

export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    microphoneThreshold: number; // 0-1 范围，麦克风收音门限
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => Promise<void>;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
}

const DEFAULT_SETTINGS: AudioProcessingSettings = {
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    microphoneThreshold: 0.3
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

    // 应用音频约束到轨道
    const applyAudioConstraints = useCallback(async (newSettings: AudioProcessingSettings) => {
        if (!localParticipant) {
            console.warn('本地参与者不存在，无法应用音频设置');
            return;
        }

        console.log('🎛️ 开始应用音频处理设置:', newSettings);

        try {
            // 获取当前音频发布
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            const wasEnabled = audioPublication ? !audioPublication.isMuted : false;

            console.log(`🎤 当前麦克风状态: ${wasEnabled ? '启用' : '禁用'}`);

            // 如果存在当前轨道，先停止并取消发布
            if (audioPublication?.track) {
                console.log('🛑 停止当前音频轨道');
                audioPublication.track.stop();
                await localParticipant.unpublishTrack(audioPublication.track);
                console.log('📤 已取消发布当前音频轨道');
                
                // 清理引用
                if (currentTrackRef.current === audioPublication.track) {
                    currentTrackRef.current = null;
                }
            }

            // 等待一下确保轨道完全停止
            await new Promise(resolve => setTimeout(resolve, 300));

            // 创建新的音频轨道配置
            const audioConstraints: MediaTrackConstraints = {
                echoCancellation: newSettings.echoCancellation,
                noiseSuppression: newSettings.noiseSuppression,
                autoGainControl: newSettings.autoGainControl,
                sampleRate: { ideal: 48000 },
                channelCount: { ideal: 1 },
            };

            console.log('🎛️ 应用音频约束:', audioConstraints);

            // 创建新的音频轨道
            const newAudioTrack = await createLocalAudioTrack({
                ...audioConstraints,
                deviceId: 'default'
            });

            console.log('✅ 新音频轨道已创建');

            // 保存轨道引用
            currentTrackRef.current = newAudioTrack;

            // 发布新轨道
            await localParticipant.publishTrack(newAudioTrack, {
                name: 'microphone',
                source: Track.Source.Microphone
            });

            console.log('📤 新音频轨道已发布');

            // 恢复麦克风状态
            if (wasEnabled) {
                await localParticipant.setMicrophoneEnabled(true);
                console.log('🎤 麦克风已重新启用');
            }

            // 验证设置
            setTimeout(() => {
                const finalPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
                if (finalPublication?.track) {
                    const actualSettings = finalPublication.track.mediaStreamTrack.getSettings();
                    console.log('🔍 验证音频设置:', {
                        applied: actualSettings,
                        expected: newSettings,
                        microphoneEnabled: localParticipant.isMicrophoneEnabled
                    });
                }
            }, 1000);

        } catch (error) {
            console.error('❌ 应用音频处理设置失败:', error);
            
            // 尝试恢复基础音频功能
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
        value: boolean | number
    ) => {
        // 防止重复应用
        if (applyingSettings.has(key)) {
            console.log(`⏳ ${key} 设置正在应用中，跳过`);
            return;
        }

        const settingKey = key;
        setApplyingSettings(prev => new Set(prev).add(settingKey));

        try {
            const newSettings = { ...settings, [key]: value };
            
            // 立即更新本地状态
            setSettings(newSettings);
            
            // 保存到本地存储
            saveSettings(newSettings);

            // 对于音频处理相关设置，需要重新创建轨道
            if (key === 'autoGainControl' || key === 'noiseSuppression' || key === 'echoCancellation') {
                console.log(`🔄 开始应用 ${key} 设置: ${value}`);
                await applyAudioConstraints(newSettings);
                console.log(`✅ ${key} 设置已应用: ${value}`);
            } else if (key === 'microphoneThreshold') {
                // 麦克风门限设置不需要重新创建轨道，只需保存
                console.log(`✅ 麦克风门限已设置为: ${value}`);
            }

        } catch (error) {
            console.error(`❌ 更新 ${key} 设置失败:`, error);
            
            // 回滚状态
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

    // 检查是否正在应用设置
    const isApplying = useCallback((key: keyof AudioProcessingSettings) => {
        return applyingSettings.has(key);
    }, [applyingSettings]);

    // 重置为默认设置
    const resetToDefaults = useCallback(async () => {
        console.log('🔄 重置音频处理设置为默认值');
        
        try {
            setSettings(DEFAULT_SETTINGS);
            saveSettings(DEFAULT_SETTINGS);
            await applyAudioConstraints(DEFAULT_SETTINGS);
            console.log('✅ 已重置为默认设置');
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, applyAudioConstraints]);

    // 组件挂载时初始化
    useEffect(() => {
        if (localParticipant) {
            console.log('🎤 初始化音频处理模块');
            
            // 获取当前轨道引用
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                currentTrackRef.current = audioPublication.track as LocalAudioTrack;
            }
        }
    }, [localParticipant]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            if (currentTrackRef.current) {
                currentTrackRef.current = null;
            }
        };
    }, []);

    return {
        settings,
        updateSetting,
        isApplying,
        resetToDefaults
    };
}