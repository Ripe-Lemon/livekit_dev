// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, createLocalAudioTrack, LocalAudioTrack, AudioCaptureOptions } from 'livekit-client';

export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    voiceIsolation: boolean;  // 新增：语音隔离
    microphoneThreshold: number; // 0-1 范围，麦克风收音门限
    sampleRate: number;
    channelCount: number;
    latency: number;
}

export interface AudioProcessingControls {
    settings: AudioProcessingSettings;
    updateSetting: (key: keyof AudioProcessingSettings, value: boolean | number) => Promise<void>;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    resetToDefaults: () => Promise<void>;
    isProcessingActive: boolean;
}

const DEFAULT_SETTINGS: AudioProcessingSettings = {
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: false,
    voiceIsolation: false,
    microphoneThreshold: 0.3,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0.01
};

// 本地存储键
const STORAGE_KEY = 'livekit_audio_processing_settings';

export function useAudioProcessing(): AudioProcessingControls {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
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
    const [isProcessingActive, setIsProcessingActive] = useState(false);
    
    // 音频轨道引用
    const currentTrackRef = useRef<LocalAudioTrack | null>(null);
    const initializationRef = useRef<boolean>(false);

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

    // 创建音频轨道配置（基于官方 AudioCaptureOptions）
    const createAudioCaptureOptions = useCallback((settings: AudioProcessingSettings): AudioCaptureOptions => {
        const options: AudioCaptureOptions = {
            // 使用 LiveKit 官方音频处理选项
            autoGainControl: settings.autoGainControl,
            noiseSuppression: settings.noiseSuppression,
            echoCancellation: settings.echoCancellation,
            voiceIsolation: settings.voiceIsolation,
            
            // 音频质量设置
            sampleRate: { ideal: settings.sampleRate },
            channelCount: { ideal: settings.channelCount },
            latency: { ideal: settings.latency },
            
            // 设备选择（后续可以扩展）
            deviceId: 'default'
        };

        console.log('🎛️ 创建音频捕获选项:', options);
        return options;
    }, []);

    // 应用音频处理设置（使用官方API，不重建轨道）
    const applyAudioProcessing = useCallback(async (newSettings: AudioProcessingSettings) => {
        if (!localParticipant || !room) {
            console.warn('本地参与者或房间不存在，无法应用音频设置');
            return false;
        }

        try {
            console.log('🎛️ 开始应用音频处理设置（官方API）:', newSettings);

            // 获取当前音频发布状态
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            const wasEnabled = audioPublication ? !audioPublication.isMuted : false;

            console.log(`🎤 当前麦克风状态: ${wasEnabled ? '启用' : '禁用'}`);

            // 创建音频捕获选项
            const captureOptions = createAudioCaptureOptions(newSettings);

            // 停止当前轨道
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

            // 等待轨道完全停止
            await new Promise(resolve => setTimeout(resolve, 200));

            // 使用 LiveKit 官方 API 创建新轨道
            console.log('🔧 使用 LiveKit 官方 AudioCaptureOptions 创建音频轨道');
            const newAudioTrack = await createLocalAudioTrack(captureOptions);

            console.log('✅ 新音频轨道已创建（官方API）');

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

            setIsProcessingActive(true);

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

            return true;

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
            
            setIsProcessingActive(false);
            throw error;
        }
    }, [localParticipant, room, createAudioCaptureOptions]);

    // 初始化音频处理（在房间连接后自动应用）
    const initializeAudioProcessing = useCallback(async () => {
        if (initializationRef.current || !localParticipant || !room) {
            return;
        }

        try {
            console.log('🎛️ 自动初始化音频处理...');
            initializationRef.current = true;
            
            // 等待房间完全连接
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 应用当前设置
            await applyAudioProcessing(settings);
            
            console.log('✅ 音频处理自动初始化完成');
        } catch (error) {
            console.error('❌ 音频处理自动初始化失败:', error);
            initializationRef.current = false;
        }
    }, [localParticipant, room, settings, applyAudioProcessing]);

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

            // 对于音频处理相关设置，立即重新应用
            if (key === 'autoGainControl' || 
                key === 'noiseSuppression' || 
                key === 'echoCancellation' || 
                key === 'voiceIsolation' ||
                key === 'sampleRate' ||
                key === 'channelCount' ||
                key === 'latency') {
                console.log(`🔄 开始应用 ${key} 设置: ${value}`);
                await applyAudioProcessing(newSettings);
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
    }, [settings, applyingSettings, saveSettings, applyAudioProcessing]);

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
            await applyAudioProcessing(DEFAULT_SETTINGS);
            console.log('✅ 已重置为默认设置');
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, applyAudioProcessing]);

    // 监听房间连接状态，自动初始化
    useEffect(() => {
        if (localParticipant && room?.state === 'connected' && !initializationRef.current) {
            console.log('🎤 检测到房间已连接，准备自动初始化音频处理');
            
            // 延迟一点初始化，确保 LiveKit 完全准备就绪
            const timer = setTimeout(() => {
                initializeAudioProcessing();
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [localParticipant, room?.state, initializeAudioProcessing]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            if (currentTrackRef.current) {
                currentTrackRef.current = null;
            }
            initializationRef.current = false;
            setIsProcessingActive(false);
        };
    }, []);

    return {
        settings,
        updateSetting,
        isApplying,
        resetToDefaults,
        isProcessingActive
    };
}