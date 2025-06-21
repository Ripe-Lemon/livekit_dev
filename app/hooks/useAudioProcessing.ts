// app/hooks/useAudioProcessing.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, createLocalAudioTrack, LocalAudioTrack, AudioCaptureOptions } from 'livekit-client';

export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    voiceIsolation: boolean;
    microphoneThreshold: number;
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
    isInitialized: boolean;
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
    const [isInitialized, setIsInitialized] = useState(false);
    
    // 音频轨道引用
    const currentTrackRef = useRef<LocalAudioTrack | null>(null);
    const isInitializingRef = useRef<boolean>(false);

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

    // 创建音频轨道配置
    const createAudioCaptureOptions = useCallback((settings: AudioProcessingSettings): AudioCaptureOptions => {
        const options: AudioCaptureOptions = {
            autoGainControl: settings.autoGainControl,
            noiseSuppression: settings.noiseSuppression,
            echoCancellation: settings.echoCancellation,
            voiceIsolation: settings.voiceIsolation,
            sampleRate: { ideal: settings.sampleRate },
            channelCount: { ideal: settings.channelCount },
            latency: { ideal: settings.latency },
            deviceId: 'default'
        };

        console.log('🎛️ 创建音频捕获选项:', options);
        return options;
    }, []);

    // 应用音频处理设置
    const applyAudioProcessing = useCallback(async (newSettings: AudioProcessingSettings) => {
        if (!localParticipant || !room) {
            console.warn('本地参与者或房间不存在，无法应用音频设置');
            return false;
        }

        if (isInitializingRef.current) {
            console.log('⏳ 音频处理正在初始化中，跳过重复应用');
            return false;
        }

        try {
            isInitializingRef.current = true;
            console.log('🎛️ 开始应用音频处理设置:', newSettings);

            // 获取当前音频发布状态
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            const wasEnabled = audioPublication ? !audioPublication.isMuted : false;

            // 停止当前轨道
            if (audioPublication?.track) {
                console.log('🛑 停止当前音频轨道');
                audioPublication.track.stop();
                await localParticipant.unpublishTrack(audioPublication.track);
                
                if (currentTrackRef.current === audioPublication.track) {
                    currentTrackRef.current = null;
                }
            }

            // 等待轨道完全停止
            await new Promise(resolve => setTimeout(resolve, 300));

            // 使用 LiveKit 官方 API 创建新轨道
            const captureOptions = createAudioCaptureOptions(newSettings);
            const newAudioTrack = await createLocalAudioTrack(captureOptions);

            currentTrackRef.current = newAudioTrack;

            // 发布新轨道（设置 stopMicTrackOnMute）
            await localParticipant.publishTrack(newAudioTrack, {
                name: 'microphone',
                source: Track.Source.Microphone,
                stopMicTrackOnMute: true  // 🎯 关键设置
            });

            console.log('📤 新音频轨道已发布（stopMicTrackOnMute: true）');

            // 恢复麦克风状态
            if (wasEnabled) {
                await localParticipant.setMicrophoneEnabled(true);
            }

            setIsProcessingActive(true);
            setIsInitialized(true);

            console.log('✅ 音频处理设置应用成功');
            return true;

        } catch (error) {
            console.error('❌ 应用音频处理设置失败:', error);
            setIsProcessingActive(false);
            throw error;
        } finally {
            isInitializingRef.current = false;
        }
    }, [localParticipant, room, createAudioCaptureOptions]);

    // 更新单个设置
    const updateSetting = useCallback(async (
        key: keyof AudioProcessingSettings, 
        value: boolean | number
    ) => {
        if (applyingSettings.has(key)) {
            console.log(`⏳ ${key} 设置正在应用中，跳过`);
            return;
        }

        const settingKey = key;
        setApplyingSettings(prev => new Set(prev).add(settingKey));

        try {
            const newSettings = { ...settings, [key]: value };
            
            // 立即更新本地状态和存储
            setSettings(newSettings);
            saveSettings(newSettings);

            // 如果是音频处理相关设置且已初始化，立即重新应用
            if (isInitialized && (
                key === 'autoGainControl' || 
                key === 'noiseSuppression' || 
                key === 'echoCancellation' || 
                key === 'voiceIsolation' ||
                key === 'sampleRate' ||
                key === 'channelCount' ||
                key === 'latency'
            )) {
                console.log(`🔄 立即应用 ${key} 设置: ${value}`);
                await applyAudioProcessing(newSettings);
                console.log(`✅ ${key} 设置已应用: ${value}`);
            } else if (key === 'microphoneThreshold') {
                // 麦克风门限不需要重新创建轨道
                console.log(`✅ 麦克风门限已设置为: ${value}`);
            } else if (!isInitialized) {
                console.log(`💾 ${key} 设置已保存，将在初始化时生效: ${value}`);
            }

        } catch (error) {
            console.error(`❌ 更新 ${key} 设置失败:`, error);
            setSettings(settings); // 回滚
            throw error;
        } finally {
            setApplyingSettings(prev => {
                const newSet = new Set(prev);
                newSet.delete(settingKey);
                return newSet;
            });
        }
    }, [settings, applyingSettings, saveSettings, applyAudioProcessing, isInitialized]);

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
            
            if (isInitialized) {
                await applyAudioProcessing(DEFAULT_SETTINGS);
            }
            
            console.log('✅ 已重置为默认设置');
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, applyAudioProcessing, isInitialized]);

    // 核心：监听房间连接状态，自动初始化音频处理
    useEffect(() => {
        if (!localParticipant || !room) {
            console.log('🔍 等待房间和本地参与者准备就绪...');
            return;
        }

        if (room.state !== 'connected') {
            console.log(`🔍 等待房间连接完成，当前状态: ${room.state}`);
            return;
        }

        if (isInitialized || isInitializingRef.current) {
            console.log('🔍 音频处理已初始化或正在初始化中，跳过');
            return;
        }

        console.log('🎛️ 房间已连接，开始初始化音频处理');

        // 延迟初始化，确保 LiveKit 完全准备就绪
        const timer = setTimeout(async () => {
            try {
                await applyAudioProcessing(settings);
                console.log('✅ 音频处理自动初始化完成');
            } catch (error) {
                console.error('❌ 音频处理自动初始化失败:', error);
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [localParticipant, room, room?.state, isInitialized, settings, applyAudioProcessing]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            
            if (currentTrackRef.current) {
                currentTrackRef.current.stop();
                currentTrackRef.current = null;
            }
            
            setIsProcessingActive(false);
            setIsInitialized(false);
            isInitializingRef.current = false;
        };
    }, []);

    return {
        settings,
        updateSetting,
        isApplying,
        resetToDefaults,
        isProcessingActive,
        isInitialized
    };
}