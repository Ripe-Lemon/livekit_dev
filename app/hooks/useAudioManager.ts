'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundEvent } from '../types/audio';
import { AudioManager } from '../lib/audio/AudioManager';

// 导出 SoundEvent 类型
export type { SoundEvent } from '../types/audio';

// Hook 选项接口
interface UseAudioManagerOptions {
    autoInitialize?: boolean;
    globalVolume?: number;
    enabled?: boolean;
}

// Hook 返回值接口
interface UseAudioManagerReturn {
    audioManager: AudioManager | null;
    isInitialized: boolean;
    isEnabled: boolean;
    globalVolume: number;
    stats: any;
    initialize: () => Promise<void>;
    playSound: (sound: SoundEvent, options?: { volume?: number; delay?: number }) => void;
    setEnabled: (enabled: boolean) => void;
    setGlobalVolume: (volume: number) => void;
    stopAllSounds: () => void;
    reloadSound: (sound: SoundEvent) => Promise<void>;
    destroy: () => void;
    testAllSounds: () => Promise<void>;
    testSound: (sound: SoundEvent) => Promise<boolean>;
    testPlaySound: (sound: SoundEvent) => void;
    getStats: () => any;
    getDebugInfo: () => any;
}

// 主要的音频管理 Hook
export function useAudioManager(options: UseAudioManagerOptions = {}): UseAudioManagerReturn {
    const {
        autoInitialize = true,
        globalVolume: initialGlobalVolume = 0.7,
        enabled: initialEnabled = true
    } = options;

    const [isInitialized, setIsInitialized] = useState(false);
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [globalVolume, setGlobalVolumeState] = useState(initialGlobalVolume);
    const [stats, setStats] = useState<any>(null);

    const audioManagerRef = useRef<AudioManager | null>(null);
    const isMountedRef = useRef(true);

    // 获取 AudioManager 实例
    const getAudioManager = useCallback(() => {
        if (!audioManagerRef.current) {
            audioManagerRef.current = AudioManager.getInstance();
        }
        return audioManagerRef.current;
    }, []);

    // 初始化音频管理器
    const initialize = useCallback(async () => {
        if (isInitialized) return;

        try {
            console.log('开始初始化音频管理器...');
            const manager = getAudioManager();
            await manager.initialize();
            
            if (isMountedRef.current) {
                setIsInitialized(true);
                setIsEnabled(manager.isAudioEnabled());
                setStats(manager.getStats());
                
                console.log('✅ 音频管理器初始化成功');
            }
        } catch (error) {
            console.error('❌ 音频管理器初始化失败:', error);
            if (isMountedRef.current) {
                setIsInitialized(false);
            }
        }
    }, [isInitialized, getAudioManager]);

    // 播放音效
    const playSound = useCallback((
        sound: SoundEvent, 
        options: { volume?: number; delay?: number } = {}
    ) => {
        if (!isInitialized || !audioManagerRef.current) {
            console.warn('音频管理器未初始化，无法播放音效:', sound);
            return;
        }

        try {
            console.log(`🎵 播放音效: ${sound}`, options);
            audioManagerRef.current.playSound(sound, options);
        } catch (error) {
            console.error(`播放音效失败: ${sound}`, error);
        }
    }, [isInitialized]);

    // 设置音频启用状态
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
            console.log(`音频${enabled ? '已启用' : '已禁用'}`);
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
            console.log(`全局音量设置为: ${Math.round(clampedVolume * 100)}%`);
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
            console.log('已停止所有音效');
        } catch (error) {
            console.error('停止所有音效失败:', error);
        }
    }, []);

    // 重新加载单个音效
    const reloadSound = useCallback(async (sound: SoundEvent) => {
        if (!audioManagerRef.current) {
            console.warn('音频管理器未初始化');
            return;
        }

        try {
            console.log(`🔄 重新加载音效: ${sound}`);
            await audioManagerRef.current.reloadSound(sound);
            console.log(`✅ 音效重新加载成功: ${sound}`);
        } catch (error) {
            console.error(`❌ 重新加载音效失败: ${sound}`, error);
            throw error;
        }
    }, []);

    // 销毁音频管理器
    const destroy = useCallback(() => {
        if (audioManagerRef.current) {
            audioManagerRef.current.destroy();
            audioManagerRef.current = null;
        }
        
        setIsInitialized(false);
        setStats(null);
        console.log('音频管理器已销毁');
    }, []);

    // 测试所有音频文件
    const testAllSounds = useCallback(async () => {
        const manager = getAudioManager();
        await manager.testAllSounds();
    }, [getAudioManager]);

    // 测试单个音效文件
    const testSound = useCallback(async (sound: SoundEvent): Promise<boolean> => {
        const manager = getAudioManager();
        return await manager.testSound(sound);
    }, [getAudioManager]);

    // 播放测试音效
    const testPlaySound = useCallback((sound: SoundEvent) => {
        const manager = getAudioManager();
        manager.testPlaySound(sound);
    }, [getAudioManager]);

    // 获取统计信息
    const getStats = useCallback(() => {
        if (!audioManagerRef.current) {
            return null;
        }
        return audioManagerRef.current.getStats();
    }, []);

    // 获取调试信息
    const getDebugInfo = useCallback(() => {
        if (!audioManagerRef.current) {
            return null;
        }
        return audioManagerRef.current.getDebugInfo();
    }, []);

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
                setGlobalVolumeState(Math.max(0, Math.min(1, volume)));
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
            
            // 更新统计信息
            setStats(audioManagerRef.current.getStats());
        }
    }, [isInitialized, isEnabled, globalVolume]);

    // 定期更新统计信息
    useEffect(() => {
        if (!isInitialized) return;

        const interval = setInterval(() => {
            if (audioManagerRef.current) {
                setStats(audioManagerRef.current.getStats());
            }
        }, 5000); // 每5秒更新一次

        return () => clearInterval(interval);
    }, [isInitialized]);

    // 清理
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

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
        destroy,
        testAllSounds,
        testSound,
        testPlaySound,
        getStats,
        getDebugInfo
    };
}

// 便捷的音效播放 Hook
export function usePlaySound() {
    const { playSound, isInitialized } = useAudioManager();

    return useCallback((sound: SoundEvent, options?: { volume?: number; delay?: number }) => {
        if (isInitialized) {
            playSound(sound, options);
        } else {
            console.warn('音频管理器未初始化，无法播放音效:', sound);
        }
    }, [playSound, isInitialized]);
}

// 音频状态监听 Hook
export function useAudioStatus() {
    const { isInitialized, isEnabled, globalVolume, stats } = useAudioManager({ autoInitialize: false });

    return {
        isInitialized,
        isEnabled,
        globalVolume,
        stats
    };
}

// 音频测试 Hook（仅用于开发环境）
export function useAudioTesting() {
    const { testAllSounds, testSound, testPlaySound, getDebugInfo } = useAudioManager();

    const runFullTest = useCallback(async () => {
        console.log('🔍 开始完整音频测试...');
        
        // 测试所有文件
        await testAllSounds();
        
        // 获取详细信息
        const debugInfo = getDebugInfo();
        console.log('📊 音频系统详细信息:', debugInfo);
        
        return debugInfo;
    }, [testAllSounds, getDebugInfo]);

    return {
        testAllSounds,
        testSound,
        testPlaySound,
        getDebugInfo,
        runFullTest
    };
}