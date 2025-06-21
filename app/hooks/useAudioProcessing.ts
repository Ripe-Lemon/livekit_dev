// app/hooks/useAudioProcessing.ts

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, createLocalAudioTrack, LocalAudioTrack } from 'livekit-client';
import { AudioManager } from '../lib/audio/AudioManager';

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
    isProcessingActive: boolean;
}

const DEFAULT_SETTINGS: AudioProcessingSettings = {
    autoGainControl: true,
    noiseSuppression: true,
    echoCancellation: false,
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
    const [isProcessingActive, setIsProcessingActive] = useState(false);
    
    // 音频管理器和初始化状态
    const audioManagerRef = useRef<AudioManager | null>(null);
    const initializationRef = useRef<boolean>(false);
    const originalStreamRef = useRef<MediaStream | null>(null);

    // 获取音频管理器实例
    const getAudioManager = useCallback(() => {
        if (!audioManagerRef.current) {
            audioManagerRef.current = AudioManager.getInstance();
        }
        return audioManagerRef.current;
    }, []);

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

    // 初始化音频处理链（一次性初始化）
    const initializeAudioProcessing = useCallback(async () => {
        if (initializationRef.current || !localParticipant) {
            return;
        }

        try {
            console.log('🎛️ 初始化音频处理链系统...');
            
            // 获取原始音频流（只设置必要的约束）
            const originalStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: settings.echoCancellation, // 这个需要在获取流时设置
                    sampleRate: { ideal: 48000 },
                    channelCount: { ideal: 1 },
                    deviceId: 'default'
                }
            });

            console.log('🎤 原始音频流已获取');
            originalStreamRef.current = originalStream;

            // 启动音频管理器的音频处理链
            const audioManager = getAudioManager();
            await audioManager.initializeAudioProcessing();
            
            const processedStream = await audioManager.startAudioProcessing(originalStream);
            
            if (!processedStream) {
                throw new Error('无法创建处理后的音频流');
            }

            // 获取当前音频发布并替换
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            const wasEnabled = audioPublication ? !audioPublication.isMuted : true;

            // 停止现有轨道
            if (audioPublication?.track) {
                console.log('🛑 停止现有音频轨道');
                audioPublication.track.stop();
                await localParticipant.unpublishTrack(audioPublication.track);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // 发布处理后的音频流
            const processedTrack = processedStream.getAudioTracks()[0];
            if (processedTrack) {
                await localParticipant.publishTrack(processedTrack, {
                    name: 'microphone',
                    source: Track.Source.Microphone
                });

                console.log('📤 处理后的音频轨道已发布');

                // 恢复麦克风状态
                if (wasEnabled) {
                    await localParticipant.setMicrophoneEnabled(true);
                }

                setIsProcessingActive(true);
                initializationRef.current = true;
                
                // 应用当前设置到处理链
                audioManager.updateAudioProcessingSettings(settings);
                
                console.log('✅ 音频处理链初始化完成');
            }

        } catch (error) {
            console.error('❌ 初始化音频处理链失败:', error);
            
            // 清理失败的流
            if (originalStreamRef.current) {
                originalStreamRef.current.getTracks().forEach(track => track.stop());
                originalStreamRef.current = null;
            }
        }
    }, [localParticipant, settings.echoCancellation, getAudioManager, settings]);

    // 更新单个设置（不重建轨道）
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
            saveSettings(newSettings);

            // 特殊处理：echoCancellation 需要重新获取音频流
            if (key === 'echoCancellation') {
                console.log('🔄 回声消除设置变更，需要重新初始化...');
                
                // 重置初始化状态
                initializationRef.current = false;
                setIsProcessingActive(false);
                
                // 停止当前处理
                const audioManager = getAudioManager();
                audioManager.stopAudioProcessing();
                
                // 重新初始化（会使用新的 echoCancellation 设置）
                await initializeAudioProcessing();
                
            } else {
                // 其他设置直接更新处理链参数
                console.log(`🔧 更新音频处理参数: ${key} = ${value}`);
                
                const audioManager = getAudioManager();
                if (audioManager.isAudioProcessingActive()) {
                    audioManager.updateAudioProcessingSettings(newSettings);
                    console.log(`✅ ${key} 设置已实时应用`);
                } else {
                    console.log(`⚠️ 音频处理未激活，设置已保存但未应用`);
                }
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
    }, [settings, applyingSettings, saveSettings, getAudioManager, initializeAudioProcessing]);

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
            
            const audioManager = getAudioManager();
            if (audioManager.isAudioProcessingActive()) {
                audioManager.updateAudioProcessingSettings(DEFAULT_SETTINGS);
            }
            
            console.log('✅ 已重置为默认设置');
        } catch (error) {
            console.error('❌ 重置设置失败:', error);
            throw error;
        }
    }, [saveSettings, getAudioManager]);

    // 组件挂载时初始化
    useEffect(() => {
        if (localParticipant && !initializationRef.current) {
            console.log('🎤 检测到本地参与者，准备初始化音频处理');
            
            // 延迟一点初始化，确保 LiveKit 准备就绪
            const timer = setTimeout(() => {
                initializeAudioProcessing();
            }, 1000);
            
            return () => clearTimeout(timer);
        }
    }, [localParticipant, initializeAudioProcessing]);

    // 清理函数
    useEffect(() => {
        return () => {
            console.log('🧹 清理音频处理模块');
            
            const audioManager = getAudioManager();
            audioManager.stopAudioProcessing();
            
            if (originalStreamRef.current) {
                originalStreamRef.current.getTracks().forEach(track => track.stop());
                originalStreamRef.current = null;
            }
            
            initializationRef.current = false;
            setIsProcessingActive(false);
        };
    }, [getAudioManager]);

    return {
        settings,
        updateSetting,
        isApplying,
        resetToDefaults,
        isProcessingActive
    };
}