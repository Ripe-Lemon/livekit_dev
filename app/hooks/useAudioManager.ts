'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';
import { SoundEvent } from '../types/audio';

interface AudioStats {
    initialized: boolean;
    enabled: boolean;
    globalVolume: number;
    loadedSounds: number;
    totalSounds: number;
    audioContextState: string;
}

interface UseAudioManagerOptions {
    autoInitialize?: boolean;
    globalVolume?: number;
    enabled?: boolean;
}

interface UseAudioManagerReturn {
    audioManager: AudioManager | null;
    isInitialized: boolean;
    isEnabled: boolean;
    globalVolume: number;
    stats: AudioStats | null;
    initialize: () => Promise<void>;
    playSound: (sound: SoundEvent, options?: { volume?: number; delay?: number }) => void;
    setEnabled: (enabled: boolean) => void;
    setGlobalVolume: (volume: number) => void;
    stopAllSounds: () => void;
    reloadSound: (sound: SoundEvent) => Promise<void>;
    destroy: () => void;
}

export function useAudioManager(options: UseAudioManagerOptions = {}): UseAudioManagerReturn {
    const {
        autoInitialize = true,
        globalVolume: initialGlobalVolume = 0.7,
        enabled: initialEnabled = true
    } = options;

    // 状态
    const [isInitialized, setIsInitialized] = useState(false);
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [globalVolume, setGlobalVolumeState] = useState(initialGlobalVolume);
    const [stats, setStats] = useState<AudioStats | null>(null);

    // Refs
    const audioManagerRef = useRef<AudioManager | null>(null);
    const isMountedRef = useRef(true);
    const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // 获取 AudioManager 实例
    const getAudioManager = useCallback(() => {
        if (!audioManagerRef.current) {
            audioManagerRef.current = AudioManager.getInstance({
                globalVolume: initialGlobalVolume,
                enabled: initialEnabled
            });
        }
        return audioManagerRef.current;
    }, [initialGlobalVolume, initialEnabled]);

    // 初始化音频管理器
    const initialize = useCallback(async () => {
        if (isInitialized) return;

        try {
            const manager = getAudioManager();
            await manager.initialize();
            
            if (isMountedRef.current) {
                setIsInitialized(true);
                setIsEnabled(manager.isAudioEnabled());
                
                // 开始定期更新统计信息
                startStatsUpdate();
                
                console.log('音频管理器初始化成功');
            }
        } catch (error) {
            console.error('音频管理器初始化失败:', error);
            if (isMountedRef.current) {
                setIsInitialized(false);
            }
        }
    }, [isInitialized, getAudioManager]);

    // 开始统计信息更新
    const startStatsUpdate = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
        }

        statsIntervalRef.current = setInterval(() => {
            if (audioManagerRef.current && isMountedRef.current) {
                const newStats = audioManagerRef.current.getStats();
                setStats(newStats);
            }
        }, 5000); // 每5秒更新一次统计信息
    }, []);

    // 停止统计信息更新
    const stopStatsUpdate = useCallback(() => {
        if (statsIntervalRef.current) {
            clearInterval(statsIntervalRef.current);
            statsIntervalRef.current = null;
        }
    }, []);

    // 播放音效
    const playSound = useCallback((
        sound: SoundEvent, 
        options: { volume?: number; delay?: number } = {}
    ) => {
        if (!isInitialized || !audioManagerRef.current) {
            console.warn('音频管理器未初始化，无法播放音效');
            return;
        }

        try {
            audioManagerRef.current.playSound(sound, options);
        } catch (error) {
            console.error(`播放音效失败: ${sound}`, error);
        }
    }, [isInitialized]);

    // 设置启用状态
    const setEnabled = useCallback((enabled: boolean) => {
        if (!audioManagerRef.current) {
            console.warn('音频管理器未初始化');
            return;
        }

        try {
            audioManagerRef.current.setEnabled(enabled);
            setIsEnabled(enabled);
            
            // 保存到本地存储
            localStorage.setItem('audioEnabled', JSON.stringify(enabled));
        } catch (error) {
            console.error('设置音频启用状态失败:', error);
        }
    }, []);

    // 设置全局音量
    const setGlobalVolume = useCallback((volume: number) => {
        if (!audioManagerRef.current) {
            console.warn('音频管理器未初始化');
            return;
        }

        try {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            audioManagerRef.current.setGlobalVolume(clampedVolume);
            setGlobalVolumeState(clampedVolume);
            
            // 保存到本地存储
            localStorage.setItem('audioVolume', JSON.stringify(clampedVolume));
        } catch (error) {
            console.error('设置全局音量失败:', error);
        }
    }, []);

    // 停止所有音效
    const stopAllSounds = useCallback(() => {
        if (!audioManagerRef.current) {
            console.warn('音频管理器未初始化');
            return;
        }

        try {
            audioManagerRef.current.stopAllSounds();
        } catch (error) {
            console.error('停止所有音效失败:', error);
        }
    }, []);

    // 重新加载音效
    const reloadSound = useCallback(async (sound: SoundEvent) => {
        if (!audioManagerRef.current) {
            console.warn('音频管理器未初始化');
            return;
        }

        try {
            await audioManagerRef.current.reloadSound(sound);
            console.log(`音效重新加载成功: ${sound}`);
        } catch (error) {
            console.error(`重新加载音效失败: ${sound}`, error);
            throw error;
        }
    }, []);

    // 销毁音频管理器
    const destroy = useCallback(() => {
        stopStatsUpdate();
        
        if (audioManagerRef.current) {
            audioManagerRef.current.destroy();
            audioManagerRef.current = null;
        }
        
        setIsInitialized(false);
        setStats(null);
    }, [stopStatsUpdate]);

    // 从本地存储恢复设置
    useEffect(() => {
        try {
            const savedEnabled = localStorage.getItem('audioEnabled');
            if (savedEnabled !== null) {
                const enabled = JSON.parse(savedEnabled);
                setIsEnabled(enabled);
            }

            const savedVolume = localStorage.getItem('audioVolume');
            if (savedVolume !== null) {
                const volume = JSON.parse(savedVolume);
                setGlobalVolumeState(volume);
            }
        } catch (error) {
            console.warn('恢复音频设置失败:', error);
        }
    }, []);

    // 自动初始化
    useEffect(() => {
        if (autoInitialize) {
            initialize();
        }
    }, [autoInitialize, initialize]);

    // 应用恢复的设置
    useEffect(() => {
        if (isInitialized && audioManagerRef.current) {
            audioManagerRef.current.setEnabled(isEnabled);
            audioManagerRef.current.setGlobalVolume(globalVolume);
        }
    }, [isInitialized, isEnabled, globalVolume]);

    // 清理
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            stopStatsUpdate();
        };
    }, [stopStatsUpdate]);

    return {
        audioManager: audioManagerRef.current,
        isInitialized,
        isEnabled,
        globalVolume,
        stats,
        initialize,
        playSound,
        setEnabled,
        setGlobalVolume,
        stopAllSounds,
        reloadSound,
        destroy
    };
}

// 便捷的音效播放 Hook
export function usePlaySound() {
    const { playSound, isInitialized } = useAudioManager();

    return useCallback((sound: SoundEvent, options?: { volume?: number; delay?: number }) => {
        if (isInitialized) {
            playSound(sound, options);
        }
    }, [playSound, isInitialized]);
}

// 音频设置 Hook
export function useAudioSettings() {
    const { 
        isEnabled, 
        globalVolume, 
        setEnabled, 
        setGlobalVolume,
        stats 
    } = useAudioManager();

    const toggleEnabled = useCallback(() => {
        setEnabled(!isEnabled);
    }, [isEnabled, setEnabled]);

    return {
        isEnabled,
        globalVolume,
        stats,
        setEnabled,
        setGlobalVolume,
        toggleEnabled
    };
}