'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SoundEvent } from '../types/audio';

// 简化的音频管理器，不依赖 LiveKit Room Context
class SimpleAudioManager {
    private static instance: SimpleAudioManager;
    private audioContext: AudioContext | null = null;
    private sounds: Map<SoundEvent, AudioBuffer> = new Map();
    private gainNode: GainNode | null = null;
    private enabled: boolean = true;
    private volume: number = 0.7;

    static getInstance(): SimpleAudioManager {
        if (!SimpleAudioManager.instance) {
            SimpleAudioManager.instance = new SimpleAudioManager();
        }
        return SimpleAudioManager.instance;
    }

    async initialize(): Promise<void> {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
            this.gainNode.gain.value = this.volume;
            
            console.log('音频管理器初始化成功');
        } catch (error) {
            console.error('音频管理器初始化失败:', error);
        }
    }

    playSound(sound: SoundEvent, options: { volume?: number; delay?: number } = {}): void {
        if (!this.enabled || !this.audioContext || !this.gainNode) {
            return;
        }

        try {
            // 播放简单的音效
            const oscillator = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            
            oscillator.connect(gain);
            gain.connect(this.gainNode);

            // 根据不同音效设置不同频率
            switch (sound) {
                case 'user-join':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    break;
                case 'user-leave':
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    break;
                case 'message-notification':
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    break;
                case 'error':
                    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                    break;
                default:
                    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
            }

            const volume = (options.volume ?? 1) * this.volume;
            gain.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

            oscillator.start(this.audioContext.currentTime + (options.delay ?? 0));
            oscillator.stop(this.audioContext.currentTime + (options.delay ?? 0) + 0.3);
        } catch (error) {
            console.error('播放音效失败:', error);
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    setGlobalVolume(volume: number): void {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.gainNode) {
            this.gainNode.gain.value = this.volume;
        }
    }

    isAudioEnabled(): boolean {
        return this.enabled;
    }

    getStats(): any {
        return {
            initialized: !!this.audioContext,
            enabled: this.enabled,
            globalVolume: this.volume,
            loadedSounds: this.sounds.size,
            totalSounds: 4,
            audioContextState: this.audioContext?.state || 'suspended'
        };
    }

    stopAllSounds(): void {
        // 简单实现，实际上oscillator会自动停止
    }

    async reloadSound(sound: SoundEvent): Promise<void> {
        // 简单实现，不需要重新加载
    }

    destroy(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.gainNode = null;
        }
        this.sounds.clear();
    }
}

interface UseAudioManagerOptions {
    autoInitialize?: boolean;
    globalVolume?: number;
    enabled?: boolean;
}

interface UseAudioManagerReturn {
    audioManager: SimpleAudioManager | null;
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
}

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

    const audioManagerRef = useRef<SimpleAudioManager | null>(null);
    const isMountedRef = useRef(true);

    // 获取 AudioManager 实例
    const getAudioManager = useCallback(() => {
        if (!audioManagerRef.current) {
            audioManagerRef.current = SimpleAudioManager.getInstance();
        }
        return audioManagerRef.current;
    }, []);

    // 初始化音频管理器
    const initialize = useCallback(async () => {
        if (isInitialized) return;

        try {
            const manager = getAudioManager();
            await manager.initialize();
            
            if (isMountedRef.current) {
                setIsInitialized(true);
                setIsEnabled(manager.isAudioEnabled());
                setStats(manager.getStats());
                
                console.log('音频管理器初始化成功');
            }
        } catch (error) {
            console.error('音频管理器初始化失败:', error);
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
            return;
        }

        try {
            audioManagerRef.current.setEnabled(enabled);
            setIsEnabled(enabled);
            
            localStorage.setItem('audioEnabled', JSON.stringify(enabled));
        } catch (error) {
            console.error('设置音频启用状态失败:', error);
        }
    }, []);

    // 设置全局音量
    const setGlobalVolume = useCallback((volume: number) => {
        if (!audioManagerRef.current) {
            return;
        }

        try {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            audioManagerRef.current.setGlobalVolume(clampedVolume);
            setGlobalVolumeState(clampedVolume);
            
            localStorage.setItem('audioVolume', JSON.stringify(clampedVolume));
        } catch (error) {
            console.error('设置全局音量失败:', error);
        }
    }, []);

    // 停止所有音效
    const stopAllSounds = useCallback(() => {
        if (!audioManagerRef.current) {
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
            return;
        }

        try {
            await audioManagerRef.current.reloadSound(sound);
        } catch (error) {
            console.error(`重新加载音效失败: ${sound}`, error);
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