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

        // 2. 修复平滑音量算法 - 提高响应性
        // 当音量上升时使用较少的平滑，下降时使用更多平滑
        const smoothingFactor = volume > this.smoothedVolume ? 
            this.config.smoothingFactor * 0.3 :  // 上升时快速响应
            this.config.smoothingFactor;         // 下降时正常平滑
            
        this.smoothedVolume = this.smoothedVolume * smoothingFactor + 
                             volume * (1 - smoothingFactor);

        // 3. 频谱分析
        const spectralFeatures = this.analyzeSpectrum();

        // 4. 使用显示的音量值（smoothedVolume）直接与阈值比较
        const volumeBasedProbability = this.smoothedVolume >= this.config.threshold ? 1.0 : 0.0;
        
        // 5. 频谱增强（可选，增加准确性）
        const spectralBonus = this.calculateSpectralBonus(spectralFeatures);
        
        // 6. 最终概率：主要基于音量阈值，频谱作为辅助
        const probability = Math.min(volumeBasedProbability + spectralBonus * 0.2, 1.0);

        // 7. 状态机逻辑 - 使用严格的阈值判断
        this.updateSpeechState(probability);

        // 8. 更新历史数据
        this.updateHistory(volume);

        // 9. 调试日志 - 增加更详细的音量信息
        const now = Date.now();
        if (this.debugMode && volume > 0.01 && now - this.lastVolumeUpdate > 1000) {
            console.log('🔍 VAD 音量分析:', {
                rawVolume: volume.toFixed(4),
                smoothedVolume: this.smoothedVolume.toFixed(4),
                threshold: this.config.threshold.toFixed(3),
                volumeExceedsThreshold: this.smoothedVolume >= this.config.threshold,
                probability: probability.toFixed(3),
                isSpeaking: this.isSpeaking,
                spectralBonus: spectralBonus.toFixed(3),
                // 新增：原始数据检查
                dataArrayMax: Math.max(...Array.from(this.dataArray)),
                dataArrayMin: Math.min(...Array.from(this.dataArray)),
                dataArrayAvg: Array.from(this.dataArray).reduce((a, b) => a + b, 0) / this.dataArray.length
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
        let max = 0;
        let nonZeroCount = 0;
        let varianceSum = 0;
        
        // 首先计算基本统计
        for (let i = 0; i < this.dataArray.length; i++) {
            const amplitude = Math.abs(this.dataArray[i] - 128) / 128;
            sum += amplitude * amplitude;
            max = Math.max(max, amplitude);
            if (this.dataArray[i] !== 128) nonZeroCount++;
        }
        
        // 如果所有数据都是128（静音），返回0
        if (nonZeroCount === 0) {
            return 0;
        }
        
        const rms = Math.sqrt(sum / this.dataArray.length);
        const mean = Math.sqrt(sum / this.dataArray.length);
        
        // 计算方差来检测音频活动
        for (let i = 0; i < this.dataArray.length; i++) {
            const amplitude = Math.abs(this.dataArray[i] - 128) / 128;
            varianceSum += Math.pow(amplitude - mean, 2);
        }
        const variance = Math.sqrt(varianceSum / this.dataArray.length);
        
        // 多重增强算法
        const rmsVolume = rms * 12;     // 从8倍进一步提高到12倍
        const peakVolume = max * 3;     // 峰值增强
        const varianceVolume = variance * 8; // 方差增强，检测音频变化
        
        // 组合算法：RMS为主，峰值和方差为辅
        const combinedVolume = (rmsVolume * 0.6) + (peakVolume * 0.2) + (varianceVolume * 0.2);
        
        // 应用非线性增强曲线
        const enhancedVolume = Math.pow(combinedVolume, 0.5); // 使用平方根增强小信号
        
        // 添加最小阈值，确保有音频输入时有可见的音量
        const minThreshold = 0.02;
        const finalVolume = Math.max(
            enhancedVolume > minThreshold ? enhancedVolume : 0,
            0
        );
        
        // 限制在0-1范围，但允许较高的音量
        return Math.min(finalVolume, 1.0);
    }

    async connectToMicrophone(stream: MediaStream): Promise<void> {
        if (!this.audioContext) {
            await this.initializeAudioContext();
        }

        if (!this.audioContext) {
            throw new Error('音频上下文初始化失败');
        }

        try {
            console.log('🎤 VAD 连接到麦克风...');

            // 创建音频分析节点 - 最大化敏感度设置
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 4096;  // 增加到4096以获得更好的频率分辨率
            this.analyserNode.smoothingTimeConstant = 0.1; // 进一步降低到0.1，最大化响应速度
            this.analyserNode.minDecibels = -120; // 进一步降低到-120，捕获极小的信号
            this.analyserNode.maxDecibels = -10;  // 保持不变

            // 连接麦克风输入
            this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
            this.microphoneSource.connect(this.analyserNode);

            // 初始化数据数组
            const bufferLength = this.analyserNode.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.freqDataArray = new Uint8Array(bufferLength);

            console.log('✅ VAD 已连接到麦克风（高敏感度配置）', {
                fftSize: this.analyserNode.fftSize,
                bufferLength,
                sampleRate: this.audioContext.sampleRate,
                audioContextState: this.audioContext.state,
                minDecibels: this.analyserNode.minDecibels,
                maxDecibels: this.analyserNode.maxDecibels,
                smoothingTimeConstant: this.analyserNode.smoothingTimeConstant
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

    // 修复初始化音频上下文，确保正确恢复
    private async initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 确保音频上下文处于运行状态
            if (this.audioContext.state === 'suspended') {
                console.log('🎤 音频上下文被暂停，正在恢复...');
                await this.audioContext.resume();
                console.log('✅ 音频上下文已恢复');
            }
            
            console.log('🎤 VAD AudioContext 已初始化', {
                state: this.audioContext.state,
                sampleRate: this.audioContext.sampleRate,
                destination: this.audioContext.destination
            });
        } catch (error) {
            console.error('❌ VAD AudioContext 初始化失败:', error);
            throw error;
        }
    }

    // 添加实时音量监控方法
    getRealTimeVolume(): number {
        if (!this.analyserNode || !this.dataArray) return 0;
        
        this.analyserNode.getByteTimeDomainData(this.dataArray);
        return this.calculateVolume();
    }

    // 改进测试音量响应方法
    testVolumeResponse(): void {
        console.log('🧪 开始高精度音量响应测试...');
        
        if (!this.analyserNode || !this.dataArray) {
            console.error('❌ 分析器未初始化');
            return;
        }

        let testCount = 0;
        const maxTests = 60; // 60秒测试
        
        const testInterval = setInterval(() => {
            this.analyserNode!.getByteTimeDomainData(this.dataArray!);
            
            // 计算多种音量指标
            let rms = 0;
            let peak = 0;
            let nonZeroCount = 0;
            let variance = 0;
            let totalAmplitude = 0;
            
            // 计算基础统计
            for (let i = 0; i < this.dataArray!.length; i++) {
                const amplitude = Math.abs(this.dataArray![i] - 128);
                totalAmplitude += amplitude;
                rms += amplitude * amplitude;
                peak = Math.max(peak, amplitude);
                if (this.dataArray![i] !== 128) nonZeroCount++;
            }
            
            const avgAmplitude = totalAmplitude / this.dataArray!.length;
            rms = Math.sqrt(rms / this.dataArray!.length);
            
            // 计算方差
            for (let i = 0; i < this.dataArray!.length; i++) {
                const amplitude = Math.abs(this.dataArray![i] - 128);
                variance += Math.pow(amplitude - avgAmplitude, 2);
            }
            variance = Math.sqrt(variance / this.dataArray!.length);
            
            // 归一化
            const rmsNormalized = rms / 128;
            const peakNormalized = peak / 128;
            const varianceNormalized = variance / 128;
            const dataPercent = (nonZeroCount / this.dataArray!.length) * 100;
            const ourAlgorithm = this.calculateVolume();
            
            if (rmsNormalized > 0.001 || ourAlgorithm > 0.001) {
                console.log(`🎤 音量测试 [${testCount + 1}/${maxTests}]:`, {
                    '我们的算法': ourAlgorithm.toFixed(6),
                    'RMS标准化': rmsNormalized.toFixed(6),
                    '峰值标准化': peakNormalized.toFixed(6),
                    '方差标准化': varianceNormalized.toFixed(6),
                    '数据覆盖率': `${dataPercent.toFixed(1)}%`,
                    '平均振幅': avgAmplitude.toFixed(2),
                    '音频上下文': this.audioContext?.state,
                    '样本数据': Array.from(this.dataArray!.slice(0, 8)),
                    '当前阈值': this.config.threshold.toFixed(3),
                    '超过阈值': ourAlgorithm >= this.config.threshold ? '✅' : '❌'
                });
            } else if (testCount % 10 === 0) {
                console.log(`🎤 静音检测 [${testCount + 1}/${maxTests}]: 无音频输入`);
            }
            
            testCount++;
            if (testCount >= maxTests) {
                clearInterval(testInterval);
                console.log('🧪 高精度音量响应测试结束');
            }
        }, 1000);
    }

    private analyzeSpectrum(): any {
        if (!this.freqDataArray) {
            return {
                totalEnergy: 0,
                speechEnergy: 0,
                spectralCentroid: 0
            };
        }

        let totalEnergy = 0;
        let speechEnergy = 0;
        let weightedFreqSum = 0;
        let energySum = 0;

        const sampleRate = this.audioContext?.sampleRate || 48000;
        const nyquist = sampleRate / 2;
        const binSize = nyquist / this.freqDataArray.length;

        for (let i = 0; i < this.freqDataArray.length; i++) {
            const amplitude = this.freqDataArray[i] / 255;
            const energy = amplitude * amplitude;
            const frequency = i * binSize;

            totalEnergy += energy;

            // 语音频段通常在 85Hz - 4000Hz
            if (frequency >= 85 && frequency <= 4000) {
                speechEnergy += energy;
            }

            // 计算频谱重心
            weightedFreqSum += frequency * energy;
            energySum += energy;
        }

        const spectralCentroid = energySum > 0 ? weightedFreqSum / energySum : 0;

        return {
            totalEnergy,
            speechEnergy,
            spectralCentroid
        };
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
    private originalStream: MediaStream | null = null;

    constructor() {
        // 不在构造函数中初始化音频上下文，而是在连接时初始化
        console.log('🎛️ VAD音频网关已创建');
    }

    private async initializeAudioContext() {
        try {
            // 确保在用户交互后创建音频上下文
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // 如果音频上下文处于暂停状态，尝试恢复
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
                console.log('🎛️ 音频上下文已恢复');
            }
            
            // 创建增益节点
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = 1.0;
            
            // 创建目标流节点
            this.destinationNode = this.audioContext.createMediaStreamDestination();
            
            // 连接音频图
            this.gainNode.connect(this.destinationNode);
            
            console.log('🎛️ VAD音频网关音频上下文已初始化');
            console.log('🔍 音频上下文状态:', this.audioContext.state);
            console.log('🔍 音频上下文采样率:', this.audioContext.sampleRate);
            
        } catch (error) {
            console.error('❌ VAD音频网关初始化失败:', error);
            throw error;
        }
    }

    async connectToStream(inputStream: MediaStream): Promise<MediaStream | null> {
        try {
            console.log('🔗 VAD音频网关开始连接到输入流...');
            
            // 验证输入流
            const inputTracks = inputStream.getAudioTracks();
            if (inputTracks.length === 0) {
                throw new Error('输入流没有音频轨道');
            }
            
            const inputTrack = inputTracks[0];
            console.log('🔍 输入音频轨道状态:', {
                label: inputTrack.label,
                readyState: inputTrack.readyState,
                enabled: inputTrack.enabled,
                muted: inputTrack.muted,
                settings: inputTrack.getSettings()
            });
            
            if (inputTrack.readyState !== 'live') {
                throw new Error(`输入音频轨道状态无效: ${inputTrack.readyState}`);
            }
            
            // 保存原始流引用
            this.originalStream = inputStream;
            
            // 初始化音频上下文
            await this.initializeAudioContext();
            
            if (!this.audioContext || !this.gainNode || !this.destinationNode) {
                throw new Error('音频网关未正确初始化');
            }
            
            // 创建源节点
            this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
            console.log('🔗 已创建音频源节点');
            
            // 连接音频图：源 -> 增益 -> 目标
            this.sourceNode.connect(this.gainNode);
            console.log('🔗 音频图已连接');
            
            // 验证输出流
            const outputStream = this.destinationNode.stream;
            const outputTracks = outputStream.getAudioTracks();
            
            if (outputTracks.length === 0) {
                throw new Error('输出流没有生成音频轨道');
            }
            
            const outputTrack = outputTracks[0];
            console.log('🔍 输出音频轨道状态:', {
                label: outputTrack.label,
                readyState: outputTrack.readyState,
                enabled: outputTrack.enabled,
                muted: outputTrack.muted,
                settings: outputTrack.getSettings()
            });
            
            // 等待一小段时间确保轨道状态稳定
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 再次检查输出轨道状态
            if (outputTrack.readyState !== 'live') {
                throw new Error(`输出音频轨道状态无效: ${outputTrack.readyState}`);
            }
            
            // 监听输入轨道状态变化
            inputTrack.addEventListener('ended', () => {
                console.log('⚠️ 输入音频轨道已结束，VAD音频网关将停止');
                this.handleInputTrackEnded();
            });
            
            console.log('✅ VAD音频网关已成功连接到输入流');
            return outputStream;
            
        } catch (error) {
            console.error('❌ VAD音频网关连接失败:', error);
            this.cleanup();
            return null;
        }
    }

    private handleInputTrackEnded() {
        console.log('🛑 处理输入轨道结束事件');
        // 不立即清理，而是通知状态变化
        if (this.onStateChange) {
            this.onStateChange({
                ...this.getState(),
                inputEnded: true
            });
        }
    }

    setTransmitting(transmitting: boolean, fadeTime: number = 50) {
        if (this.isTransmitting === transmitting) return;
        
        this.isTransmitting = transmitting;
        this.targetGain = transmitting ? 1.0 : 0.0;
        
        console.log(`🎛️ VAD音频网关切换传输状态: ${transmitting ? '开启' : '关闭'}`);
        
        if (!this.gainNode || !this.audioContext) {
            console.warn('音频网关未初始化，无法设置传输状态');
            return;
        }
        
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }
        
        const steps = Math.max(1, fadeTime / 10);
        const fadeStep = Math.abs(this.targetGain - this.currentGain) / steps;
        
        this.fadeInterval = window.setInterval(() => {
            if (Math.abs(this.currentGain - this.targetGain) < fadeStep) {
                this.currentGain = this.targetGain;
                if (this.gainNode && this.audioContext && this.audioContext.state === 'running') {
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
                
                if (this.gainNode && this.audioContext && this.audioContext.state === 'running') {
                    this.gainNode.gain.value = this.currentGain;
                }
            }
        }, 10);
    }

    getState() {
        return {
            isControlling: true,
            isTransmitting: this.isTransmitting,
            outputVolume: this.currentGain,
            audioContextState: this.audioContext?.state || 'closed',
            hasValidOutput: this.destinationNode?.stream.getAudioTracks()[0]?.readyState === 'live'
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

    private cleanup() {
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        
        if (this.sourceNode) {
            try {
                this.sourceNode.disconnect();
            } catch (error) {
                console.warn('断开源节点时出错:', error);
            }
            this.sourceNode = null;
        }
        
        if (this.gainNode) {
            try {
                this.gainNode.disconnect();
            } catch (error) {
                console.warn('断开增益节点时出错:', error);
            }
            this.gainNode = null;
        }
    }

    disconnect() {
        console.log('🔌 VAD音频网关断开连接');
        this.cleanup();
    }

    dispose() {
        console.log('🗑️ VAD音频网关开始销毁');
        
        this.cleanup();
        
        // 不要关闭音频上下文，让浏览器管理
        if (this.audioContext) {
            console.log('🔍 保留音频上下文，让浏览器管理');
            this.audioContext = null;
        }
        
        this.destinationNode = null;
        this.originalStream = null;
        this.onStateChange = null;
        
        console.log('✅ VAD音频网关已销毁');
    }
}