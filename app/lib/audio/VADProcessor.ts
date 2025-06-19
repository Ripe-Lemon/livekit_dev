'use client';

export interface VADResult {
    probability: number; // 0-1 范围，语音检测概率
    isSpeaking: boolean; // 是否正在说话
    volume: number; // 音量级别 0-1
}

export interface VADConfig {
    threshold: number; // 语音检测阈值 0-1
    smoothingFactor: number; // 平滑因子 0-1
    minSpeechFrames: number; // 最小语音帧数
    minSilenceFrames: number; // 最小静音帧数
    analyzeWindow: number; // 分析窗口大小(毫秒)
}

const DEFAULT_VAD_CONFIG: VADConfig = {
    threshold: 0.3,
    smoothingFactor: 0.8,
    minSpeechFrames: 3,
    minSilenceFrames: 10,
    analyzeWindow: 30 // 30ms
};

export class VADProcessor {
    private audioContext: AudioContext | null = null;
    private analyserNode: AnalyserNode | null = null;
    private microphoneSource: MediaStreamAudioSourceNode | null = null;
    private isActive = false;
    private config: VADConfig;
    private dataArray: Uint8Array | null = null;
    private freqDataArray: Uint8Array | null = null;
    private audioGateway: VADAudioGateway | null = null;
    private onSpeechStateChange: ((isSpeaking: boolean) => void) | null = null;
    
    // VAD 状态
    private currentVolume = 0;
    private smoothedVolume = 0;
    private speechFrameCount = 0;
    private silenceFrameCount = 0;
    private isSpeaking = false;
    private lastAnalysisTime = 0;
    
    // 频谱分析相关
    private speechFreqBands = {
        low: { min: 85, max: 255 },      // 85-255 Hz (基频)
        mid: { min: 255, max: 2000 },    // 255-2000 Hz (主要语音频段)
        high: { min: 2000, max: 4000 }   // 2000-4000 Hz (语音清晰度)
    };

    // 历史数据用于更智能的检测
    private volumeHistory: number[] = [];
    private readonly historySize = 10;

    // 回调函数
    private onVADUpdate: ((result: VADResult) => void) | null = null;

    // 添加调试状态
    private debugMode = process.env.NODE_ENV === 'development';
    private analysisCount = 0;
    private lastVolumeUpdate = 0;

    constructor(config: Partial<VADConfig> = {}) {
        this.config = { ...DEFAULT_VAD_CONFIG, ...config };
        this.initializeAudioContext();
    }

    private initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log('🎤 VAD AudioContext 已初始化');
        } catch (error) {
            console.error('❌ VAD AudioContext 初始化失败:', error);
        }
    }

    async connectToMicrophone(stream: MediaStream): Promise<void> {
        if (!this.audioContext) {
            throw new Error('AudioContext 未初始化');
        }

        try {
            // 验证输入流
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('输入流中没有音频轨道');
            }

            const audioTrack = audioTracks[0];
            console.log('🔍 VAD连接音频轨道:', {
                label: audioTrack.label,
                readyState: audioTrack.readyState,
                enabled: audioTrack.enabled,
                muted: audioTrack.muted,
                settings: audioTrack.getSettings()
            });

            // 恢复 AudioContext（如果被暂停）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('🔄 AudioContext 已恢复');
            }

            // 创建音频分析节点
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 2048;
            this.analyserNode.smoothingTimeConstant = 0.8;
            this.analyserNode.minDecibels = -90;
            this.analyserNode.maxDecibels = -10;

            // 连接麦克风输入
            this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
            this.microphoneSource.connect(this.analyserNode);

            // 初始化数据数组
            const bufferLength = this.analyserNode.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.freqDataArray = new Uint8Array(bufferLength);

            console.log('✅ VAD 已连接到麦克风', {
                fftSize: this.analyserNode.fftSize,
                bufferLength,
                sampleRate: this.audioContext.sampleRate,
                audioContextState: this.audioContext.state
            });

            // 重置计数器
            this.analysisCount = 0;
            this.lastVolumeUpdate = Date.now();

            this.startAnalysis();
        } catch (error) {
            console.error('❌ VAD 连接麦克风失败:', error);
            throw error;
        }
    }

    private startAnalysis() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log('🔍 VAD 分析已开始');
        
        const analyze = () => {
            if (!this.isActive || !this.analyserNode || !this.dataArray || !this.freqDataArray) {
                return;
            }

            const now = Date.now();
            if (now - this.lastAnalysisTime < this.config.analyzeWindow) {
                requestAnimationFrame(analyze);
                return;
            }
            this.lastAnalysisTime = now;

            try {
                // 获取音频数据
                this.analyserNode.getByteTimeDomainData(this.dataArray);
                this.analyserNode.getByteFrequencyData(this.freqDataArray);

                // 验证数据有效性
                const hasData = this.dataArray.some(value => value !== 128) || 
                               this.freqDataArray.some(value => value > 0);

                if (!hasData) {
                    if (this.debugMode && this.analysisCount % 100 === 0) {
                        console.warn('⚠️ VAD未检测到音频数据，检查麦克风连接');
                    }
                } else {
                    // 分析音频
                    const result = this.analyzeAudio();
                    
                    // 触发回调
                    if (this.onVADUpdate) {
                        this.onVADUpdate(result);
                    }

                    // 调试输出（降低频率）
                    if (this.debugMode && this.analysisCount % 50 === 0) {
                        console.log('🔍 VAD数据采样:', {
                            analysisCount: this.analysisCount,
                            volume: result.volume.toFixed(3),
                            probability: result.probability.toFixed(3),
                            isSpeaking: result.isSpeaking,
                            dataArraySample: Array.from(this.dataArray.slice(0, 10)),
                            freqArraySample: Array.from(this.freqDataArray.slice(0, 10)),
                            audioContextState: this.audioContext?.state
                        });
                    }
                }

                this.analysisCount++;
            } catch (error) {
                console.error('❌ VAD分析错误:', error);
            }

            requestAnimationFrame(analyze);
        };

        requestAnimationFrame(analyze);
    }

    private analyzeAudio(): VADResult {
        if (!this.dataArray || !this.freqDataArray) {
            return { probability: 0, isSpeaking: false, volume: 0 };
        }

        // 1. 计算音量 (RMS)
        const volume = this.calculateVolume();
        this.currentVolume = volume;

        // 2. 平滑音量
        this.smoothedVolume = this.smoothedVolume * this.config.smoothingFactor + 
                             volume * (1 - this.config.smoothingFactor);

        // 3. 频谱分析
        const spectralFeatures = this.analyzeSpectrum();

        // 4. 修复：使用显示的音量值（smoothedVolume）直接与阈值比较
        // 确保阈值判断与显示的电平条一致
        const volumeBasedProbability = this.smoothedVolume >= this.config.threshold ? 1.0 : 0.0;
        
        // 5. 频谱增强（可选，增加准确性）
        const spectralBonus = this.calculateSpectralBonus(spectralFeatures);
        
        // 6. 最终概率：主要基于音量阈值，频谱作为辅助
        const probability = Math.min(volumeBasedProbability + spectralBonus * 0.2, 1.0);

        // 7. 状态机逻辑 - 使用严格的阈值判断
        this.updateSpeechState(probability);

        // 8. 更新历史数据
        this.updateHistory(volume);

        // 9. 调试日志
        const now = Date.now();
        if (this.debugMode && volume > 0.01 && now - this.lastVolumeUpdate > 1000) {
            console.log('🔍 VAD 阈值对比:', {
                smoothedVolume: this.smoothedVolume.toFixed(3),
                threshold: this.config.threshold.toFixed(3),
                volumeExceedsThreshold: this.smoothedVolume >= this.config.threshold,
                probability: probability.toFixed(3),
                isSpeaking: this.isSpeaking,
                spectralBonus: spectralBonus.toFixed(3)
            });
            this.lastVolumeUpdate = now;
        }

        return {
            probability,
            isSpeaking: this.isSpeaking,
            volume: this.smoothedVolume // 确保返回与显示一致的音量值
        };
    }

    // 新增：计算频谱加成
    private calculateSpectralBonus(spectral: any): number {
        if (spectral.totalEnergy === 0) return 0;
        
        // 语音频段能量比例
        const speechRatio = spectral.speechEnergy / spectral.totalEnergy;
        
        // 频谱重心在语音范围内的加成
        const centroidBonus = spectral.spectralCentroid > 300 && spectral.spectralCentroid < 3000 ? 0.1 : 0;
        
        return Math.min(speechRatio * 0.3 + centroidBonus, 0.3); // 最大30%加成
    }

    private calculateVolume(): number {
        if (!this.dataArray) return 0;

        let sum = 0;
        let nonZeroCount = 0;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            const amplitude = (this.dataArray[i] - 128) / 128;
            sum += amplitude * amplitude;
            if (this.dataArray[i] !== 128) nonZeroCount++;
        }
        
        // 如果所有数据都是128（静音），返回0
        if (nonZeroCount === 0) {
            return 0;
        }
        
        const rms = Math.sqrt(sum / this.dataArray.length);
        const volume = Math.min(rms * 3, 1); // 增加放大倍数以提高敏感度
        
        return volume;
    }

    private analyzeSpectrum(): { speechEnergy: number; totalEnergy: number; spectralCentroid: number } {
        if (!this.freqDataArray || !this.audioContext) {
            return { speechEnergy: 0, totalEnergy: 0, spectralCentroid: 0 };
        }

        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / this.freqDataArray.length;

        let totalEnergy = 0;
        let speechEnergy = 0;
        let weightedFreqSum = 0;
        let magnitudeSum = 0;

        for (let i = 0; i < this.freqDataArray.length; i++) {
            const frequency = i * binWidth;
            const magnitude = this.freqDataArray[i] / 255; // 归一化到0-1
            
            totalEnergy += magnitude;
            magnitudeSum += magnitude;
            weightedFreqSum += frequency * magnitude;

            // 语音频段能量 (85Hz - 4000Hz)
            if (frequency >= 85 && frequency <= 4000) {
                speechEnergy += magnitude;
            }
        }

        const spectralCentroid = magnitudeSum > 0 ? weightedFreqSum / magnitudeSum : 0;

        return {
            speechEnergy: speechEnergy / this.freqDataArray.length,
            totalEnergy: totalEnergy / this.freqDataArray.length,
            spectralCentroid
        };
    }

    private calculateSpeechProbability(volume: number, spectral: any): number {
        // 多维度语音概率计算
        
        // 1. 音量概率 (S型曲线)
        const volumeProb = 1 / (1 + Math.exp(-10 * (volume - this.config.threshold)));

        // 2. 频谱概率 (语音频段能量比例)
        const spectralProb = spectral.totalEnergy > 0 ? 
            Math.min(spectral.speechEnergy / spectral.totalEnergy * 2, 1) : 0;

        // 3. 频谱重心概率 (语音通常在500-2000Hz)
        const centroidProb = spectral.spectralCentroid > 500 && spectral.spectralCentroid < 2000 ? 
            1 - Math.abs(spectral.spectralCentroid - 1250) / 1250 : 0;

        // 4. 历史趋势概率
        const trendProb = this.calculateTrendProbability();

        // 加权组合
        const probability = 
            volumeProb * 0.4 +      // 音量权重最高
            spectralProb * 0.3 +    // 频谱能量次之
            centroidProb * 0.2 +    // 频谱重心
            trendProb * 0.1;        // 历史趋势

        return Math.max(0, Math.min(1, probability));
    }

    private calculateTrendProbability(): number {
        if (this.volumeHistory.length < 3) return 0.5;

        const recent = this.volumeHistory.slice(-3);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const current = this.currentVolume;

        // 如果当前音量显著高于最近平均值，增加语音概率
        if (current > avg * 1.2) {
            return 0.8;
        } else if (current < avg * 0.8) {
            return 0.2;
        }
        return 0.5;
    }

    // 新增：设置语音状态变化回调
    setSpeechStateChangeCallback(callback: (isSpeaking: boolean) => void) {
        this.onSpeechStateChange = callback;
    }

    private updateSpeechState(probability: number) {
        const wasSpeeking = this.isSpeaking;
        
        // 使用更严格的阈值判断，确保与电平条显示一致
        const isAboveThreshold = this.smoothedVolume >= this.config.threshold;
        
        if (isAboveThreshold) {
            this.speechFrameCount++;
            this.silenceFrameCount = 0;
            
            if (!this.isSpeaking && this.speechFrameCount >= this.config.minSpeechFrames) {
                this.isSpeaking = true;
                console.log(`🗣️ 检测到语音开始 (音量: ${this.smoothedVolume.toFixed(3)}, 阈值: ${this.config.threshold.toFixed(3)})`);
            }
        } else {
            this.silenceFrameCount++;
            this.speechFrameCount = 0;
            
            if (this.isSpeaking && this.silenceFrameCount >= this.config.minSilenceFrames) {
                this.isSpeaking = false;
                console.log(`🤫 检测到语音结束 (音量: ${this.smoothedVolume.toFixed(3)}, 阈值: ${this.config.threshold.toFixed(3)})`);
            }
        }

        // 新增：如果语音状态发生变化，触发回调
        if (wasSpeeking !== this.isSpeaking && this.onSpeechStateChange) {
            this.onSpeechStateChange(this.isSpeaking);
        }
    }

    private updateHistory(volume: number) {
        this.volumeHistory.push(volume);
        if (this.volumeHistory.length > this.historySize) {
            this.volumeHistory.shift();
        }
    }

    updateConfig(newConfig: Partial<VADConfig>) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ VAD 配置已更新:', this.config);
    }

    setVADCallback(callback: (result: VADResult) => void) {
        this.onVADUpdate = callback;
    }

    stopAnalysis() {
        this.isActive = false;
        console.log('⏹️ VAD 分析已停止');
    }

    disconnect() {
        this.stopAnalysis();
        
        if (this.microphoneSource) {
            this.microphoneSource.disconnect();
            this.microphoneSource = null;
        }
        
        if (this.analyserNode) {
            this.analyserNode.disconnect();
            this.analyserNode = null;
        }
        
        this.dataArray = null;
        this.freqDataArray = null;
        this.onVADUpdate = null;
        
        console.log('🔌 VAD 已断开连接');
    }

    dispose() {
        this.disconnect();
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('🗑️ VAD 已销毁');
    }

    // 添加强制测试方法
    testAudioInput(): void {
        console.log('🧪 开始VAD音频输入测试，当前状态检查...');
        console.log('📊 VAD初始化状态:', {
            hasAnalyser: !!this.analyserNode,
            hasDataArrays: !!(this.dataArray && this.freqDataArray),
            isActive: this.isActive,
            audioContextState: this.audioContext?.state
        });

        if (!this.analyserNode || !this.dataArray || !this.freqDataArray) {
            console.error('❌ VAD未正确初始化，详细状态:', {
                analyserNode: !!this.analyserNode,
                dataArray: !!this.dataArray,
                freqDataArray: !!this.freqDataArray,
                audioContext: !!this.audioContext
            });
            return;
        }

        console.log('🧪 VAD已正确初始化，开始音频输入测试...');
        
        const testInterval = setInterval(() => {
            if (!this.analyserNode || !this.dataArray || !this.freqDataArray) {
                console.error('❌ 测试期间VAD被销毁');
                clearInterval(testInterval);
                return;
            }

            this.analyserNode.getByteTimeDomainData(this.dataArray);
            this.analyserNode.getByteFrequencyData(this.freqDataArray);
            
            const volume = this.calculateVolume();
            const hasTimeData = this.dataArray.some(v => v !== 128);
            const hasFreqData = this.freqDataArray.some(v => v > 0);
            
            console.log('🧪 测试结果:', {
                volume: volume.toFixed(4),
                hasTimeData,
                hasFreqData,
                timeDataSample: Array.from(this.dataArray.slice(0, 5)),
                freqDataSample: Array.from(this.freqDataArray.slice(0, 5)),
                audioContextState: this.audioContext?.state
            });
            
            if (volume > 0.01) {
                console.log('✅ 检测到音频输入！');
                clearInterval(testInterval);
            }
        }, 500);
        
        // 10秒后停止测试
        setTimeout(() => {
            clearInterval(testInterval);
            console.log('🧪 VAD音频测试结束');
        }, 10000);
    }

    // 获取当前状态用于调试
    getDebugInfo() {
        return {
            isActive: this.isActive,
            config: this.config,
            currentVolume: this.currentVolume,
            smoothedVolume: this.smoothedVolume,
            isSpeaking: this.isSpeaking,
            speechFrameCount: this.speechFrameCount,
            silenceFrameCount: this.silenceFrameCount,
            volumeHistory: [...this.volumeHistory],
            audioContextState: this.audioContext?.state,
            analysisCount: this.analysisCount,
            hasAnalyser: !!this.analyserNode,
            hasDataArrays: !!(this.dataArray && this.freqDataArray),
            dataArrayLength: this.dataArray?.length || 0,
            lastAnalysisTime: this.lastAnalysisTime
        };
    }
}

export class VADAudioGateway {
    private audioContext: AudioContext | null = null;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private gainNode: GainNode | null = null;
    private destinationNode: MediaStreamAudioDestinationNode | null = null;
    
    private isTransmitting = true;
    private targetGain = 1.0;
    private currentGain = 1.0;
    private fadeInterval: number | null = null;
    
    private onStateChange: ((result: any) => void) | null = null;

    constructor() {
        this.initializeAudioContext();
    }

    private async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            this.destinationNode = this.audioContext.createMediaStreamDestination();
            this.gainNode.connect(this.destinationNode);
            console.log('🎛️ VAD音频网关已初始化');
        } catch (error) {
            console.error('❌ VAD音频网关初始化失败:', error);
        }
    }

    async connectToStream(inputStream: MediaStream): Promise<MediaStream | null> {
        if (!this.audioContext || !this.gainNode || !this.destinationNode) {
            console.error('VAD音频网关未正确初始化');
            return null;
        }

        try {
            this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
            this.sourceNode.connect(this.gainNode);
            console.log('🔗 VAD音频网关已连接到输入流');
            return this.destinationNode.stream;
        } catch (error) {
            console.error('❌ 连接音频流失败:', error);
            return null;
        }
    }

    setTransmitting(transmitting: boolean, fadeTime: number = 50) {
        if (this.isTransmitting === transmitting) return;
        
        this.isTransmitting = transmitting;
        this.targetGain = transmitting ? 1.0 : 0.0;
        
        console.log(`🎛️ VAD音频网关切换传输状态: ${transmitting ? '开启' : '关闭'}`);
        
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }
        
        const steps = Math.max(1, fadeTime / 10);
        const fadeStep = Math.abs(this.targetGain - this.currentGain) / steps;
        
        this.fadeInterval = window.setInterval(() => {
            if (Math.abs(this.currentGain - this.targetGain) < fadeStep) {
                this.currentGain = this.targetGain;
                if (this.gainNode) {
                    this.gainNode.gain.value = this.currentGain;
                }
                
                if (this.fadeInterval) {
                    clearInterval(this.fadeInterval);
                    this.fadeInterval = null;
                }
                
                this.notifyStateChange();
            } else {
                if (this.currentGain < this.targetGain) {
                    this.currentGain = Math.min(this.targetGain, this.currentGain + fadeStep);
                } else {
                    this.currentGain = Math.max(this.targetGain, this.currentGain - fadeStep);
                }
                
                if (this.gainNode) {
                    this.gainNode.gain.value = this.currentGain;
                }
            }
        }, 10);
    }

    getState() {
        return {
            isControlling: true,
            isTransmitting: this.isTransmitting,
            outputVolume: this.currentGain
        };
    }

    setStateChangeCallback(callback: (result: any) => void) {
        this.onStateChange = callback;
    }

    private notifyStateChange() {
        if (this.onStateChange) {
            this.onStateChange(this.getState());
        }
    }

    disconnect() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        
        console.log('🔌 VAD音频网关已断开连接');
    }

    dispose() {
        this.disconnect();
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.destinationNode = null;
        this.onStateChange = null;
        
        console.log('🗑️ VAD音频网关已销毁');
    }
}