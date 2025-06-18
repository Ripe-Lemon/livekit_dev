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
            // 恢复 AudioContext（如果被暂停）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
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
                sampleRate: this.audioContext.sampleRate
            });

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

            // 获取音频数据
            this.analyserNode.getByteTimeDomainData(this.dataArray);
            this.analyserNode.getByteFrequencyData(this.freqDataArray);

            // 分析音频
            const result = this.analyzeAudio();
            
            // 触发回调
            if (this.onVADUpdate) {
                this.onVADUpdate(result);
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

        // 4. 语音概率计算
        const probability = this.calculateSpeechProbability(this.smoothedVolume, spectralFeatures);

        // 5. 状态机逻辑
        const wasSpeaking = this.isSpeaking;
        this.updateSpeechState(probability);

        // 6. 更新历史数据
        this.updateHistory(volume);

        // 7. 调试日志（限制频率）
        if (Math.random() < 0.01) { // 1% 概率输出调试信息
            console.log('🔍 VAD 分析结果:', {
                volume: volume.toFixed(3),
                smoothed: this.smoothedVolume.toFixed(3),
                probability: probability.toFixed(3),
                isSpeaking: this.isSpeaking,
                speechFrames: this.speechFrameCount,
                silenceFrames: this.silenceFrameCount,
                spectral: spectralFeatures
            });
        }

        return {
            probability,
            isSpeaking: this.isSpeaking,
            volume: this.smoothedVolume
        };
    }

    private calculateVolume(): number {
        if (!this.dataArray) return 0;

        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            const amplitude = (this.dataArray[i] - 128) / 128;
            sum += amplitude * amplitude;
        }
        
        const rms = Math.sqrt(sum / this.dataArray.length);
        return Math.min(rms * 2, 1); // 放大并限制在0-1范围
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

    private updateSpeechState(probability: number) {
        if (probability > this.config.threshold) {
            this.speechFrameCount++;
            this.silenceFrameCount = 0;
            
            if (!this.isSpeaking && this.speechFrameCount >= this.config.minSpeechFrames) {
                this.isSpeaking = true;
                console.log('🗣️ 检测到语音开始');
            }
        } else {
            this.silenceFrameCount++;
            this.speechFrameCount = 0;
            
            if (this.isSpeaking && this.silenceFrameCount >= this.config.minSilenceFrames) {
                this.isSpeaking = false;
                console.log('🤫 检测到语音结束');
            }
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
            audioContextState: this.audioContext?.state
        };
    }
}