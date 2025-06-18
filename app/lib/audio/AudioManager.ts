import { SoundEvent } from '../../types/audio';
import { 
    SOUND_PATHS, 
    DEFAULT_SOUND_CONFIG,
    AUDIO_STATES,
    AUDIO_ERROR_CODES,
    AUDIO_MONITORING
} from '../../constants/audio';
import { ParticipantVolumeSettings, LiveKitAudioSettings } from '../../types/audio';

// 音效配置接口（从constants导入的类型）
interface SoundConfig {
    enabled: boolean;
    volume: number;
    url?: string;
    loop?: boolean;
    fadeIn?: number;
    fadeOut?: number;
    delay?: number;
}

// 音频管理器配置
interface AudioManagerConfig {
    globalVolume: number;
    enabled: boolean;
    preloadAll: boolean;
    maxRetries: number;
    retryDelay: number;
}

// 音效状态枚举 - 使用constants中的状态
type SoundState = typeof AUDIO_STATES[keyof typeof AUDIO_STATES];

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

    private participantVolumes: ParticipantVolumeSettings = {};
    private liveKitSettings: LiveKitAudioSettings = {
        noiseSuppression: false,      // 默认关闭噪声抑制
        echoCancellation: false,      // 默认关闭回声消除
        autoGainControl: true,       // 默认开启自动增益控制
        voiceDetectionThreshold: 0.3
    };

    private constructor(config: Partial<AudioManagerConfig> = {}) {
        this.config = {
            globalVolume: 0.7,
            enabled: true,
            preloadAll: true,
            maxRetries: 3,
            retryDelay: 1000,
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

    // 初始化音频管理器 - 合并重复的实现
    async initialize(): Promise<void> {
        if (this.initialized) {
            console.log('AudioManager 已初始化');
            return;
        }

        try {
            console.log('🎵 正在初始化 AudioManager...');

            // 加载设置
            this.loadParticipantVolumes();
            this.loadLiveKitSettings();

            // 检查音频文件路径配置
            console.log('📁 音频文件配置:', SOUND_PATHS);
            console.log('⚙️ 默认音效配置:', DEFAULT_SOUND_CONFIG);

            // 初始化 Web Audio API
            await this.initializeAudioContext();

            // 设置事件监听器
            this.setupEventListeners();

            // 预加载音效（即使失败也不阻塞初始化）
            if (this.config.preloadAll) {
                try {
                    await this.preloadAllSounds();
                } catch (preloadError) {
                    console.warn('音效预加载失败，但初始化继续:', preloadError);
                }
            }

            this.initialized = true;
            console.log('✅ AudioManager 初始化完成');

        } catch (error) {
            console.error('❌ AudioManager 初始化失败:', error);
            // 即使初始化失败，也标记为已初始化，避免无限重试
            this.initialized = true;
            throw error;
        }
    }

    // 初始化 Web Audio API
    private async initializeAudioContext(): Promise<void> {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = this.config.globalVolume;
            
            console.log('🎵 Web Audio API 初始化成功');
        } catch (error) {
            console.warn('Web Audio API 初始化失败，将使用基础音频功能:', error);
        }
    }

    private async preloadAllSounds(): Promise<void> {
        console.log('🔄 开始预加载音效文件...');
        
        const soundEntries = Object.entries(DEFAULT_SOUND_CONFIG);
        console.log(`📦 需要加载 ${soundEntries.length} 个音效文件`);

        const loadPromises = soundEntries.map(async ([name, config]) => {
            if (config.enabled) {
                try {
                    await this.preloadSound(name as SoundEvent, config);
                    return { name, success: true };
                } catch (error) {
                    console.warn(`预加载音效失败: ${name}`, error);
                    return { name, success: false, error };
                }
            }
            return { name, success: false, reason: 'disabled' };
        });

        const results = await Promise.allSettled(loadPromises);
        
        let successCount = 0;
        let failedCount = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    successCount++;
                } else {
                    failedCount++;
                }
            } else {
                failedCount++;
                console.warn(`音效加载 Promise 失败:`, result.reason);
            }
        });
        
        console.log(`📊 音效预加载完成: ${successCount} 成功, ${failedCount} 失败`);
    }

    // 设置事件监听器
    private setupEventListeners(): void {
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        document.addEventListener('click', this.handleUserInteraction, { once: true });
        document.addEventListener('keydown', this.handleUserInteraction, { once: true });
        document.addEventListener('touchstart', this.handleUserInteraction, { once: true });
    }

    // 处理页面可见性变化
    private handleVisibilityChange(): void {
        if (document.hidden) {
            this.audioContext?.suspend();
        } else {
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

    // 预加载单个音效
    private async preloadSound(name: SoundEvent, config: SoundConfig): Promise<void> {
        return new Promise((resolve) => {
            const audio = new Audio();
            const soundInstance: SoundInstance = {
                audio,
                config,
                state: AUDIO_STATES.INITIALIZING,
                retryCount: 0
            };

            this.sounds.set(name, soundInstance);

            // 设置音频属性
            audio.preload = 'auto';
            audio.volume = config.volume * this.config.globalVolume;
            audio.loop = config.loop ?? false;

            // 监听加载事件
            const handleCanPlayThrough = () => {
                soundInstance.state = AUDIO_STATES.ACTIVE;
                console.log(`✅ 音效加载成功: ${name}`);
                cleanup();
                resolve();
            };

            const handleError = () => {
                console.warn(`❌ 音效加载失败: ${name}`, audio.error);
                soundInstance.state = AUDIO_STATES.ERROR;
                soundInstance.lastError = audio.error?.message || '未知错误';
                
                // 尝试重试
                if (soundInstance.retryCount < this.config.maxRetries) {
                    soundInstance.retryCount++;
                    console.log(`🔄 重试加载音效: ${name} (${soundInstance.retryCount}/${this.config.maxRetries})`);
                    
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

            // 开始加载 - 使用 constants 中的路径
            audio.src = SOUND_PATHS[name] || config.url;
            audio.load();
        });
    }

    // 播放音效
    playSound(name: SoundEvent, options: { volume?: number; delay?: number } = {}): void {
        if (!this.config.enabled || !this.initialized) {
            console.log('音效已禁用或未初始化');
            return;
        }

        const playWithDelay = () => {
            const soundInstance = this.sounds.get(name);
            
            if (!soundInstance) {
                // 如果音效未加载，尝试动态加载
                this.loadAndPlaySound(name);
                return;
            }

            if (soundInstance.state === AUDIO_STATES.ERROR) {
                console.warn(`音效 ${name} 处于错误状态，跳过播放`);
                return;
            }

            if (soundInstance.state !== AUDIO_STATES.ACTIVE) {
                console.warn(`音效 ${name} 尚未加载完成，状态: ${soundInstance.state}`);
                return;
            }

            try {
                const { audio, config } = soundInstance;
                
                // 重置播放位置
                audio.currentTime = 0;
                
                // 设置音量
                const volume = options.volume ?? config.volume;
                audio.volume = volume * this.config.globalVolume;

                // 播放音效
                const playPromise = audio.play();
                
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log(`🎵 音效播放成功: ${name}`);
                        })
                        .catch(error => {
                            console.warn(`🔇 播放音效失败: ${name}`, error);
                            
                            if (error.name === 'NotAllowedError') {
                                console.log('需要用户交互才能播放音频，请先点击页面上的任意位置');
                            }
                        });
                }
            } catch (error) {
                console.warn(`播放音效出错: ${name}`, error);
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
        const config = DEFAULT_SOUND_CONFIG[name];
        if (!config) {
            console.warn(`未知音效: ${name}`);
            return;
        }

        try {
            console.log(`动态加载音效: ${name}`);
            await this.preloadSound(name, config);
            
            // 短暂延迟后播放，确保加载完成
            setTimeout(() => {
                this.playSound(name);
            }, 100);
        } catch (error) {
            console.error(`动态加载音效失败: ${name}`, error);
        }
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
            }
        });
    }

    // 获取音效状态
    getSoundState(name: SoundEvent): SoundState | null {
        const soundInstance = this.sounds.get(name);
        return soundInstance ? soundInstance.state : null;
    }

    // 获取所有音效状态
    getAllSoundStates(): Record<string, SoundState | null> {
        const states: Record<string, SoundState | null> = {};
        
        Object.keys(DEFAULT_SOUND_CONFIG).forEach(name => {
            states[name] = this.getSoundState(name as SoundEvent);
        });
        
        return states;
    }

    // 重新加载音效
    async reloadSound(name: SoundEvent): Promise<void> {
        const config = DEFAULT_SOUND_CONFIG[name];
        if (!config) {
            throw new Error(`未知音效: ${name}`);
        }

        // 移除旧的音效实例
        const oldInstance = this.sounds.get(name);
        if (oldInstance) {
            oldInstance.audio.pause();
            this.sounds.delete(name);
        }
        
        // 重新加载
        await this.preloadSound(name, config);
    }

    // 测试音效文件是否存在
    async testSound(name: SoundEvent): Promise<boolean> {
        try {
            const soundPath = SOUND_PATHS[name];
            if (!soundPath) {
                console.error(`❌ 未配置音效路径: ${name}`);
                return false;
            }

            const response = await fetch(soundPath);
            
            if (!response.ok) {
                console.error(`❌ 音频文件不存在: ${name} -> ${soundPath} (HTTP ${response.status})`);
                return false;
            }
            
            console.log(`✅ 音频文件存在: ${name} -> ${soundPath}`);
            return true;
        } catch (error) {
            console.error(`❌ 测试音频文件失败: ${name}`, error);
            return false;
        }
    }

    // 测试所有音频文件
    async testAllSounds(): Promise<void> {
        console.log('🔍 开始测试所有音频文件...');
        
        const testPromises = Object.keys(SOUND_PATHS).map(async (soundName) => {
            const result = await this.testSound(soundName as SoundEvent);
            return { soundName, result };
        });
        
        const results = await Promise.all(testPromises);
        
        const successCount = results.filter(({ result }) => result).length;
        const totalCount = results.length;
        
        console.log(`📊 音频文件测试完成: ${successCount}/${totalCount} 个文件可用`);
        
        // 显示失败的文件
        const failedSounds = results.filter(({ result }) => !result);
        if (failedSounds.length > 0) {
            console.warn('❌ 以下音频文件无法加载:');
            failedSounds.forEach(({ soundName }) => {
                console.warn(`  - ${soundName}: ${SOUND_PATHS[soundName as SoundEvent]}`);
            });
        }
    }

    // 播放测试音效
    testPlaySound(name: SoundEvent): void {
        console.log(`🎵 测试播放音效: ${name}`);
        this.playSound(name, { volume: 0.5 });
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

    // 获取音频统计信息 - 合并重复的实现
    getStats(): any {
        const loadedCount = Array.from(this.sounds.values())
            .filter(instance => instance.state === AUDIO_STATES.ACTIVE).length;
        
        return {
            initialized: this.initialized,
            enabled: this.config.enabled,
            globalVolume: this.config.globalVolume,
            loadedSounds: loadedCount,
            totalSounds: Object.keys(DEFAULT_SOUND_CONFIG).length,
            audioContextState: this.audioContext?.state || 'not-initialized',
            soundStates: this.getAllSoundStates(),
            participantVolumes: this.participantVolumes,
            liveKitSettings: this.liveKitSettings,
            participantCount: Object.keys(this.participantVolumes).length
        };
    }

    // 获取详细的调试信息
    getDebugInfo(): any {
        return {
            config: this.config,
            audioContextState: this.audioContext?.state,
            masterGainValue: this.masterGainNode?.gain.value,
            soundInstances: Array.from(this.sounds.entries()).map(([name, instance]) => ({
                name,
                state: instance.state,
                retryCount: instance.retryCount,
                lastError: instance.lastError,
                audioSrc: instance.audio.src,
                audioDuration: instance.audio.duration,
                audioReadyState: instance.audio.readyState
            })),
            availablePaths: SOUND_PATHS
        };
    }

    // 参与者音量控制方法
    setParticipantVolume(participantId: string, volume: number): void {
        const clampedVolume = Math.max(0, Math.min(200, volume));
        this.participantVolumes[participantId] = clampedVolume;
        
        try {
            console.log(`🎯 设置参与者 ${participantId} 音量为 ${clampedVolume}%`);
            
            // 改进的音频元素查找策略
            const findAndSetVolume = () => {
                let foundElements: HTMLAudioElement[] = [];
                const volumeValue = clampedVolume / 100;

                // 策略1: 通过 data 属性直接查找
                const dataSelectors = [
                    `audio[data-lk-participant="${participantId}"]`,
                    `audio[data-participant-id="${participantId}"]`,
                    `audio[data-participant="${participantId}"]`,
                    `audio[data-participant-identity="${participantId}"]`,
                ];

                dataSelectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (element instanceof HTMLAudioElement) {
                            foundElements.push(element);
                        }
                    });
                });

                console.log(`📍 通过data属性找到 ${foundElements.length} 个音频元素`);

                // 策略2: 通过父容器查找
                if (foundElements.length === 0) {
                    const containerSelectors = [
                        `[data-lk-participant-id="${participantId}"]`,
                        `[data-participant-identity="${participantId}"]`,
                        `[data-testid="participant-${participantId}"]`,
                    ];

                    containerSelectors.forEach(selector => {
                        const containers = document.querySelectorAll(selector);
                        containers.forEach(container => {
                            const audioElements = container.querySelectorAll('audio');
                            audioElements.forEach(audio => {
                                if (audio instanceof HTMLAudioElement) {
                                    foundElements.push(audio);
                                }
                            });
                        });
                    });

                    console.log(`📍 通过容器查找到 ${foundElements.length} 个音频元素`);
                }

                // 策略3: 智能分析所有音频元素
                if (foundElements.length === 0) {
                    console.log('🔍 开始智能分析所有音频元素...');
                    
                    const allAudioElements = document.querySelectorAll('audio');
                    console.log(`找到 ${allAudioElements.length} 个音频元素`);
                    
                    // 如果只有少数几个音频元素，可以尝试通过索引匹配
                    if (allAudioElements.length <= 3) {
                        allAudioElements.forEach((audio, index) => {
                            const htmlElement = audio as HTMLElement;
                            const audioElement = audio as HTMLAudioElement;
                            
                            console.log(`音频元素 ${index}:`, {
                                src: audioElement.src,
                                volume: audioElement.volume,
                                dataset: { ...htmlElement.dataset },
                                className: htmlElement.className,
                                id: htmlElement.id,
                                parentElement: htmlElement.parentElement?.tagName,
                                parentClass: htmlElement.parentElement?.className,
                                parentDataset: htmlElement.parentElement ? { ...(htmlElement.parentElement as HTMLElement).dataset } : null
                            });

                            // 尝试通过父元素或祖先元素的数据属性关联
                            let currentElement: HTMLElement | null = htmlElement.parentElement as HTMLElement;
                            let depth = 0;
                            
                            while (currentElement && depth < 5) {
                                const dataset = currentElement.dataset;
                                const possibleIds = [
                                    dataset.lkParticipantId,
                                    dataset.participantId,
                                    dataset.participant,
                                    dataset.participantIdentity,
                                    dataset.testid?.replace('participant-', '')
                                ].filter(Boolean);

                                if (possibleIds.includes(participantId)) {
                                    console.log(`✅ 通过${depth === 0 ? '父' : '祖先'}元素找到匹配的音频元素 ${index} (深度: ${depth})`);
                                    foundElements.push(audioElement);
                                    break;
                                }

                                currentElement = currentElement.parentElement as HTMLElement;
                                depth++;
                            }
                        });
                    }

                    // 如果还是没找到，且只有一个远程音频元素，可能就是目标
                    if (foundElements.length === 0 && allAudioElements.length === 1) {
                        const singleAudio = allAudioElements[0] as HTMLAudioElement;
                        // 检查是否不是本地音频（没有静音控制或特定类名）
                        if (!singleAudio.muted && !singleAudio.className.includes('local')) {
                            console.log('🎯 只有一个音频元素，假设为目标参与者');
                            foundElements.push(singleAudio);
                        }
                    }
                }

                // 应用音量设置
                if (foundElements.length > 0) {
                    console.log(`🔊 找到 ${foundElements.length} 个匹配的音频元素，开始设置音量`);
                    
                    foundElements.forEach((audioElement, index) => {
                        try {
                            if (volumeValue <= 1) {
                                audioElement.volume = volumeValue;
                                console.log(`✅ 设置音频元素 ${index} 音量: ${clampedVolume}%`);
                            } else {
                                // 超过 100% 使用 Web Audio API
                                audioElement.volume = 1;
                                this.enhanceAudioVolume(audioElement, volumeValue, participantId);
                                console.log(`✅ 使用增益设置音频元素 ${index} 音量: ${clampedVolume}%`);
                            }

                            // 添加标识以便后续识别
                            audioElement.setAttribute('data-volume-controlled', 'true');
                            audioElement.setAttribute('data-participant-volume', participantId);
                            
                            // 验证设置是否生效
                            setTimeout(() => {
                                console.log(`🔍 验证音频元素 ${index} 音量: ${Math.round(audioElement.volume * 100)}%`);
                            }, 100);

                        } catch (error) {
                            console.error(`❌ 设置音频元素 ${index} 音量失败:`, error);
                        }
                    });

                    return true;
                } else {
                    console.warn(`❌ 未找到参与者 ${participantId} 的音频元素`);
                    
                    // 提供调试建议
                    console.log('💡 调试建议:');
                    console.log('1. 确认参与者已连接并发布音频轨道');
                    console.log('2. 检查 LiveKit 组件的 DOM 结构');
                    console.log('3. 参与者 ID 可能与预期不符');
                    
                    return false;
                }
            };

            // 立即尝试
            const found = findAndSetVolume();
            
            // 如果没找到，延迟重试（DOM 可能还在更新）
            if (!found) {
                setTimeout(() => {
                    console.log(`🔄 重试设置参与者 ${participantId} 音量... (500ms后)`);
                    const retryFound = findAndSetVolume();
                    
                    if (!retryFound) {
                        setTimeout(() => {
                            console.log(`🔄 最后重试设置参与者 ${participantId} 音量... (1500ms后)`);
                            findAndSetVolume();
                        }, 1000);
                    }
                }, 500);
            }

            // 保存到本地存储
            this.saveParticipantVolumes();
            
        } catch (error) {
            console.error('❌ 设置参与者音量失败:', error);
        }
    }

    // 使用 Web Audio API 增强音量
    private enhanceAudioVolume(audioElement: HTMLAudioElement, gain: number, participantId: string): void {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            // 检查是否已经有增益节点
            const existingNodeId = `gain-${participantId}`;
            let gainNode = (this as any)[existingNodeId];

            if (!gainNode) {
                // 创建新的增益节点
                const source = this.audioContext.createMediaElementSource(audioElement);
                gainNode = this.audioContext.createGain();
                
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // 存储引用
                (this as any)[existingNodeId] = gainNode;
            }

            // 设置增益值
            gainNode.gain.value = gain;
            audioElement.volume = 1; // 设置为最大，通过增益节点控制
        } catch (error) {
            console.error('❌ 创建音频增益节点失败:', error);
            // 降级到普通音量控制
            audioElement.volume = Math.min(gain, 1);
        }
    }

    // 获取 LiveKit 连接时的音频捕获选项
    getAudioCaptureOptions(): any {
        return {
            echoCancellation: this.liveKitSettings.echoCancellation,
            noiseSuppression: this.liveKitSettings.noiseSuppression,
            autoGainControl: this.liveKitSettings.autoGainControl,
            sampleRate: 48000,
            channelCount: 1,
        };
    }

    // 获取参与者音量
    getParticipantVolume(identity: string): number {
        return this.participantVolumes[identity] || 100;
    }

    getParticipantVolumeUseName(participantName: string): number {
        return this.participantVolumes[participantName] || 100;
    }

    // 初始化参与者音量
    initializeParticipantVolume(identity: string): number {
        if (!(identity in this.participantVolumes)) {
            this.participantVolumes[identity] = 100;
            this.saveParticipantVolumes();
        }
        return this.participantVolumes[identity];
    }

    // 获取所有参与者音量设置
    getParticipantVolumes(): ParticipantVolumeSettings {
        return { ...this.participantVolumes };
    }

    // LiveKit 音频设置相关方法
    updateLiveKitAudioSettings(settings: Partial<LiveKitAudioSettings>): void {
        this.liveKitSettings = { ...this.liveKitSettings, ...settings };
        this.saveLiveKitSettings();
        console.log('📻 LiveKit 音频设置已更新:', this.liveKitSettings);
    }

    getLiveKitAudioSettings(): LiveKitAudioSettings {
        return { ...this.liveKitSettings };
    }

    // 保存方法
    private saveParticipantVolumes(): void {
        try {
            localStorage.setItem('participantVolumes', JSON.stringify(this.participantVolumes));
        } catch (error) {
            console.error('❌ 保存参与者音量设置失败:', error);
        }
    }

    private saveLiveKitSettings(): void {
        try {
            localStorage.setItem('liveKitAudioSettings', JSON.stringify(this.liveKitSettings));
        } catch (error) {
            console.error('❌ 保存 LiveKit 音频设置失败:', error);
        }
    }

    // 加载方法
    private loadParticipantVolumes(): void {
        try {
            const saved = localStorage.getItem('participantVolumes');
            if (saved) {
                this.participantVolumes = JSON.parse(saved);
            }
        } catch (error) {
            console.error('❌ 加载参与者音量设置失败:', error);
        }
    }

    private loadLiveKitSettings(): void {
        try {
            const saved = localStorage.getItem('liveKitAudioSettings');
            if (saved) {
                this.liveKitSettings = { ...this.liveKitSettings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.error('❌ 加载 LiveKit 音频设置失败:', error);
        }
    }
}

// 其余导出函数保持不变...
export async function checkAudioPermissions(): Promise<boolean> {
    try {
        // 检查是否需要用户交互
        const audio = new Audio();
        audio.volume = 0.1;
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            await playPromise;
            audio.pause();
            console.log('✅ 音频权限正常');
            return true;
        }
        
        return true;
    } catch (error) {
        if (error instanceof Error && error.name === 'NotAllowedError') {
            console.warn('❌ 需要用户交互才能播放音频');
            return false;
        }
        console.warn('音频权限检测失败:', error);
        return false;
    }
}

export function requestAudioInteraction(): Promise<boolean> {
    return new Promise((resolve) => {
        const button = document.createElement('button');
        button.textContent = '点击启用音效';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        `;
        
        button.onclick = async () => {
            try {
                const audio = new Audio('/sounds/user-join.mp3');
                audio.volume = 0.1;
                await audio.play();
                audio.pause();
                
                button.remove();
                resolve(true);
            } catch (error) {
                console.error('用户交互后仍无法播放音频:', error);
                button.remove();
                resolve(false);
            }
        };
        
        document.body.appendChild(button);
    });
}