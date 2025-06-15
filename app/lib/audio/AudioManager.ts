import { SoundEvent } from '../../types/audio';

// 音效配置接口
interface SoundConfig {
    url: string;
    volume: number;
    preload: boolean;
    loop: boolean;
    description: string;
}

// 音频管理器配置
interface AudioManagerConfig {
    globalVolume: number;        // 全局音量 (0-1)
    enabled: boolean;           // 是否启用音效
    preloadAll: boolean;        // 是否预加载所有音效
    maxRetries: number;         // 加载失败最大重试次数
    retryDelay: number;         // 重试延迟（毫秒）
    fadeInDuration: number;     // 淡入时间（毫秒）
    fadeOutDuration: number;    // 淡出时间（毫秒）
}

// 音效状态枚举
enum SoundState {
    UNLOADED = 'unloaded',
    LOADING = 'loading',
    LOADED = 'loaded',
    ERROR = 'error',
    PLAYING = 'playing'
}

// 音效实例接口
interface SoundInstance {
    audio: HTMLAudioElement;
    config: SoundConfig;
    state: SoundState;
    retryCount: number;
    lastError?: string;
}

export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<SoundEvent, SoundInstance> = new Map();
    private config: AudioManagerConfig;
    private audioContext: AudioContext | null = null;
    private masterGainNode: GainNode | null = null;
    private initialized: boolean = false;

    // 默认音效配置
    private readonly defaultSounds: Record<SoundEvent, SoundConfig> = {
        'user-join': {
            url: '/sounds/user-join.mp3',
            volume: 0.6,
            preload: true,
            loop: false,
            description: '用户加入房间'
        },
        'user-leave': {
            url: '/sounds/user-leave.mp3',
            volume: 0.6,
            preload: true,
            loop: false,
            description: '用户离开房间'
        },
        'message-notification': {
            url: '/sounds/message-notification.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '新消息通知'
        },
        'error': {
            url: '/sounds/error.mp3',
            volume: 0.7,
            preload: true,
            loop: false,
            description: '错误提示'
        },
        'call-start': {
            url: '/sounds/call-start.mp3',
            volume: 0.6,
            preload: true,
            loop: false,
            description: '通话开始'
        },
        'call-end': {
            url: '/sounds/call-end.mp3',
            volume: 0.6,
            preload: true,
            loop: false,
            description: '通话结束'
        },
        'recording-start': {
            url: '/sounds/recording-start.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '开始录制'
        },
        'recording-stop': {
            url: '/sounds/recording-stop.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '停止录制'
        },
        'mute': {
            url: '/sounds/mute.mp3',
            volume: 0.4,
            preload: true,
            loop: false,
            description: '静音'
        },
        'unmute': {
            url: '/sounds/unmute.mp3',
            volume: 0.4,
            preload: true,
            loop: false,
            description: '取消静音'
        },
        'screen-share-start': {
            url: '/sounds/screen-share-start.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '开始屏幕共享'
        },
        'screen-share-stop': {
            url: '/sounds/screen-share-stop.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '停止屏幕共享'
        },
        'camera-on': {
            url: '/sounds/camera-on.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '开启摄像头'
        },
        'camera-off': {
            url: '/sounds/camera-off.mp3',
            volume: 0.5,
            preload: true,
            loop: false,
            description: '关闭摄像头'
        },
        'connection-lost': {
            url: '/sounds/connection-lost.mp3',
            volume: 0.7,
            preload: true,
            loop: false,
            description: '连接丢失'
        },
        'connection-restored': {
            url: '/sounds/connection-restored.mp3',
            volume: 0.6,
            preload: true,
            loop: false,
            description: '连接恢复'
        }
    };

    private constructor(config: Partial<AudioManagerConfig> = {}) {
        this.config = {
            globalVolume: 0.7,
            enabled: true,
            preloadAll: true,
            maxRetries: 3,
            retryDelay: 1000,
            fadeInDuration: 100,
            fadeOutDuration: 200,
            ...config
        };

        // 绑定方法到实例
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleUserInteraction = this.handleUserInteraction.bind(this);
    }

    // 获取单例实例
    static getInstance(config?: Partial<AudioManagerConfig>): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager(config);
        }
        return AudioManager.instance;
    }

    // 初始化音频管理器
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('音效管理器已初始化');
            return;
        }

        try {
            console.log('正在初始化音效管理器...');

            // 初始化 Web Audio API
            await this.initializeAudioContext();

            // 设置事件监听器
            this.setupEventListeners();

            // 预加载音效
            if (this.config.preloadAll) {
                await this.preloadAllSounds();
            }

            this.initialized = true;
            console.log('音效管理器初始化完成');

        } catch (error) {
            console.error('音效管理器初始化失败:', error);
            // 即使初始化失败，也标记为已初始化，使用降级方案
            this.initialized = true;
        }
    }

    // 初始化 Web Audio API
    private async initializeAudioContext(): Promise<void> {
        try {
            // 检查浏览器支持
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                console.warn('浏览器不支持 Web Audio API，使用 HTML5 Audio');
                return;
            }

            this.audioContext = new AudioContextClass();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = this.config.globalVolume;

            // 处理 autoplay 策略
            if (this.audioContext.state === 'suspended') {
                console.log('AudioContext 被暂停，等待用户交互');
            }

        } catch (error) {
            console.warn('Web Audio API 初始化失败，使用降级方案:', error);
        }
    }

    // 设置事件监听器
    private setupEventListeners(): void {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange);

        // 监听用户交互以恢复 AudioContext
        document.addEventListener('click', this.handleUserInteraction, { once: true });
        document.addEventListener('keydown', this.handleUserInteraction, { once: true });
        document.addEventListener('touchstart', this.handleUserInteraction, { once: true });
    }

    // 处理页面可见性变化
    private handleVisibilityChange(): void {
        if (document.hidden) {
            // 页面隐藏时暂停音频上下文
            this.audioContext?.suspend();
        } else {
            // 页面显示时恢复音频上下文
            this.audioContext?.resume();
        }
    }

    // 处理用户交互
    private handleUserInteraction(): void {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log('AudioContext 已恢复');
            });
        }
    }

    // 预加载所有音效
    private async preloadAllSounds(): Promise<void> {
        const loadPromises = Object.entries(this.defaultSounds).map(([name, config]) => {
            if (config.preload) {
                return this.preloadSound(name as SoundEvent, config);
            }
            return Promise.resolve();
        });

        await Promise.allSettled(loadPromises);
    }

    // 预加载单个音效
    private async preloadSound(name: SoundEvent, config: SoundConfig): Promise<void> {
        return new Promise((resolve) => {
            const audio = new Audio();
            const soundInstance: SoundInstance = {
                audio,
                config,
                state: SoundState.LOADING,
                retryCount: 0
            };

            this.sounds.set(name, soundInstance);

            // 设置音频属性
            audio.preload = 'auto';
            audio.volume = config.volume * this.config.globalVolume;
            audio.loop = config.loop;

            // 监听加载事件
            const handleCanPlayThrough = () => {
                soundInstance.state = SoundState.LOADED;
                console.log(`音效加载成功: ${name} (${config.description})`);
                cleanup();
                resolve();
            };

            const handleError = () => {
                console.warn(`音效加载失败: ${name}`, audio.error);
                soundInstance.state = SoundState.ERROR;
                soundInstance.lastError = audio.error?.message || '未知错误';
                
                // 尝试重试
                if (soundInstance.retryCount < this.config.maxRetries) {
                    soundInstance.retryCount++;
                    console.log(`重试加载音效: ${name} (${soundInstance.retryCount}/${this.config.maxRetries})`);
                    
                    setTimeout(() => {
                        audio.load();
                    }, this.config.retryDelay);
                } else {
                    cleanup();
                    resolve(); // 即使失败也要 resolve，避免阻塞
                }
            };

            const cleanup = () => {
                audio.removeEventListener('canplaythrough', handleCanPlayThrough);
                audio.removeEventListener('error', handleError);
            };

            audio.addEventListener('canplaythrough', handleCanPlayThrough);
            audio.addEventListener('error', handleError);

            // 开始加载
            audio.src = config.url;
            audio.load();
        });
    }

    // 播放音效
    playSound(name: SoundEvent, options: { volume?: number; delay?: number } = {}): void {
        if (!this.config.enabled || !this.initialized) {
            return;
        }

        const playWithDelay = () => {
            const soundInstance = this.sounds.get(name);
            
            if (!soundInstance) {
                // 如果音效未加载，尝试动态加载
                this.loadAndPlaySound(name);
                return;
            }

            if (soundInstance.state === SoundState.ERROR) {
                // 如果之前加载失败，使用程序化音效
                this.createProgrammaticSound(name);
                return;
            }

            if (soundInstance.state !== SoundState.LOADED) {
                console.warn(`音效 ${name} 尚未加载完成，状态: ${soundInstance.state}`);
                return;
            }

            try {
                const { audio } = soundInstance;
                
                // 重置播放位置
                audio.currentTime = 0;
                
                // 设置音量
                const volume = options.volume ?? soundInstance.config.volume;
                audio.volume = volume * this.config.globalVolume;

                // 播放音效
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            soundInstance.state = SoundState.PLAYING;
                        })
                        .catch(error => {
                            console.warn(`播放音效失败: ${name}`, error);
                            // 尝试程序化音效作为后备
                            this.createProgrammaticSound(name);
                        })
                        .finally(() => {
                            // 播放结束后重置状态
                            setTimeout(() => {
                                if (soundInstance.state === SoundState.PLAYING) {
                                    soundInstance.state = SoundState.LOADED;
                                }
                            }, 1000);
                        });
                }
            } catch (error) {
                console.warn(`播放音效出错: ${name}`, error);
                this.createProgrammaticSound(name);
            }
        };

        // 支持延迟播放
        if (options.delay && options.delay > 0) {
            setTimeout(playWithDelay, options.delay);
        } else {
            playWithDelay();
        }
    }

    // 动态加载并播放音效
    private async loadAndPlaySound(name: SoundEvent): Promise<void> {
        const config = this.defaultSounds[name];
        if (!config) {
            console.warn(`未知音效: ${name}`);
            return;
        }

        try {
            await this.preloadSound(name, config);
            this.playSound(name);
        } catch (error) {
            console.error(`动态加载音效失败: ${name}`, error);
            this.createProgrammaticSound(name);
        }
    }

    // 创建程序化音效（后备方案）
    private createProgrammaticSound(name: SoundEvent): void {
        if (!this.audioContext || !this.masterGainNode) {
            return;
        }

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.masterGainNode);

            // 根据音效类型设置不同的音调
            switch (name) {
                case 'user-join':
                    this.createJoinSound(oscillator, gainNode);
                    break;
                case 'user-leave':
                    this.createLeaveSound(oscillator, gainNode);
                    break;
                case 'message-notification':
                    this.createNotificationSound(oscillator, gainNode);
                    break;
                case 'error':
                    this.createErrorSound(oscillator, gainNode);
                    break;
                default:
                    this.createDefaultSound(oscillator, gainNode);
            }

        } catch (error) {
            console.warn('创建程序化音效失败:', error);
        }
    }

    // 创建加入音效
    private createJoinSound(oscillator: OscillatorNode, gainNode: GainNode): void {
        const now = this.audioContext!.currentTime;
        
        oscillator.frequency.setValueAtTime(523, now); // C5
        oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
        oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }

    // 创建离开音效
    private createLeaveSound(oscillator: OscillatorNode, gainNode: GainNode): void {
        const now = this.audioContext!.currentTime;
        
        oscillator.frequency.setValueAtTime(784, now); // G5
        oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
        oscillator.frequency.setValueAtTime(523, now + 0.2); // C5
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }

    // 创建通知音效
    private createNotificationSound(oscillator: OscillatorNode, gainNode: GainNode): void {
        const now = this.audioContext!.currentTime;
        
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.setValueAtTime(600, now + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        oscillator.start(now);
        oscillator.stop(now + 0.3);
    }

    // 创建错误音效
    private createErrorSound(oscillator: OscillatorNode, gainNode: GainNode): void {
        const now = this.audioContext!.currentTime;
        
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.setValueAtTime(150, now + 0.15);
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        
        oscillator.start(now);
        oscillator.stop(now + 0.4);
    }

    // 创建默认音效
    private createDefaultSound(oscillator: OscillatorNode, gainNode: GainNode): void {
        const now = this.audioContext!.currentTime;
        
        oscillator.frequency.setValueAtTime(440, now); // A4
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        oscillator.start(now);
        oscillator.stop(now + 0.2);
    }

    // 设置全局音量
    setGlobalVolume(volume: number): void {
        this.config.globalVolume = Math.max(0, Math.min(1, volume));
        
        // 更新主增益节点
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = this.config.globalVolume;
        }
        
        // 更新所有音效的音量
        this.sounds.forEach(soundInstance => {
            soundInstance.audio.volume = soundInstance.config.volume * this.config.globalVolume;
        });
        
        console.log(`全局音量设置为: ${Math.round(this.config.globalVolume * 100)}%`);
    }

    // 启用/禁用音效
    setEnabled(enabled: boolean): void {
        this.config.enabled = enabled;
        
        if (!enabled) {
            // 停止所有正在播放的音效
            this.stopAllSounds();
        }
        
        console.log(`音效${enabled ? '已开启' : '已关闭'}`);
    }

    // 检查音效是否启用
    isAudioEnabled(): boolean {
        return this.config.enabled;
    }

    // 停止所有音效
    stopAllSounds(): void {
        this.sounds.forEach(soundInstance => {
            if (!soundInstance.audio.paused) {
                soundInstance.audio.pause();
                soundInstance.audio.currentTime = 0;
                soundInstance.state = SoundState.LOADED;
            }
        });
    }

    // 获取音效状态
    getSoundState(name: SoundEvent): SoundState | null {
        const soundInstance = this.sounds.get(name);
        return soundInstance ? soundInstance.state : null;
    }

    // 获取所有音效状态
    getAllSoundStates(): Record<SoundEvent, SoundState | null> {
        const states: Record<string, SoundState | null> = {};
        
        Object.keys(this.defaultSounds).forEach(name => {
            states[name] = this.getSoundState(name as SoundEvent);
        });
        
        return states as Record<SoundEvent, SoundState | null>;
    }

    // 重新加载音效
    async reloadSound(name: SoundEvent): Promise<void> {
        const config = this.defaultSounds[name];
        if (!config) {
            throw new Error(`未知音效: ${name}`);
        }

        // 移除旧的音效实例
        this.sounds.delete(name);
        
        // 重新加载
        await this.preloadSound(name, config);
    }

    // 销毁音频管理器
    destroy(): void {
        // 停止所有音效
        this.stopAllSounds();
        
        // 清理音效实例
        this.sounds.clear();
        
        // 关闭音频上下文
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // 移除事件监听器
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        
        this.initialized = false;
        console.log('音频管理器已销毁');
    }

    // 获取音频统计信息
    getStats(): {
        initialized: boolean;
        enabled: boolean;
        globalVolume: number;
        loadedSounds: number;
        totalSounds: number;
        audioContextState: string;
    } {
        const loadedCount = Array.from(this.sounds.values())
            .filter(instance => instance.state === SoundState.LOADED).length;
        
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            globalVolume: this.config.globalVolume,
            loadedSounds: loadedCount,
            totalSounds: Object.keys(this.defaultSounds).length,
            audioContextState: this.audioContext?.state || 'not-initialized'
        };
    }
}