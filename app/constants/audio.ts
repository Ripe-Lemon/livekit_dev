import { SoundConfig, AudioProcessingOptions, AudioEffects, AudioQualitySettings } from '../types/audio';

// 音频文件路径
export const SOUND_PATHS = {
    'user-join': '/sounds/user-join.mp3',
    'user-leave': '/sounds/user-leave.mp3',
    'message-notification': '/sounds/message.mp3',
    'error': '/sounds/error.mp3',
    'call-start': '/sounds/call-start.mp3',
    'call-end': '/sounds/call-end.mp3',
    'recording-start': '/sounds/recording-start.mp3',
    'recording-stop': '/sounds/recording-stop.mp3',
    'screen-share-start': '/sounds/screen-share-start.mp3',
    'screen-share-stop': '/sounds/screen-share-stop.mp3',
    'mute': '/sounds/mute.mp3',
    'unmute': '/sounds/unmute.mp3',
    'camera-on': '/sounds/camera-on.mp3',
    'camera-off': '/sounds/camera-off.mp3',
    'connection-lost': '/sounds/connection-lost.mp3',
    'connection-restored': '/sounds/connection-restored.mp3'
} as const;

// 默认音频配置
export const DEFAULT_SOUND_CONFIG: Record<string, SoundConfig> = {
    'user-join': {
        enabled: true,
        volume: 0.6,
        url: SOUND_PATHS['user-join'],
        loop: false,
        fadeIn: 100,
        fadeOut: 100,
        delay: 0
    },
    'user-leave': {
        enabled: true,
        volume: 0.5,
        url: SOUND_PATHS['user-leave'],
        loop: false,
        fadeIn: 100,
        fadeOut: 100,
        delay: 0
    },
    'message-notification': {
        enabled: true,
        volume: 0.7,
        url: SOUND_PATHS['message-notification'],
        loop: false,
        fadeIn: 50,
        fadeOut: 50,
        delay: 0
    },
    'error': {
        enabled: true,
        volume: 0.8,
        url: SOUND_PATHS['error'],
        loop: false,
        fadeIn: 0,
        fadeOut: 100,
        delay: 0
    },
    'call-start': {
        enabled: true,
        volume: 0.9,
        url: SOUND_PATHS['call-start'],
        loop: false,
        fadeIn: 200,
        fadeOut: 200,
        delay: 0
    },
    'call-end': {
        enabled: true,
        volume: 0.8,
        url: SOUND_PATHS['call-end'],
        loop: false,
        fadeIn: 100,
        fadeOut: 300,
        delay: 0
    },
    'recording-start': {
        enabled: true,
        volume: 0.6,
        url: SOUND_PATHS['recording-start'],
        loop: false,
        fadeIn: 150,
        fadeOut: 150,
        delay: 0
    },
    'recording-stop': {
        enabled: true,
        volume: 0.6,
        url: SOUND_PATHS['recording-stop'],
        loop: false,
        fadeIn: 150,
        fadeOut: 150,
        delay: 0
    },
    'screen-share-start': {
        enabled: true,
        volume: 0.5,
        url: SOUND_PATHS['screen-share-start'],
        loop: false,
        fadeIn: 100,
        fadeOut: 100,
        delay: 0
    },
    'screen-share-stop': {
        enabled: true,
        volume: 0.5,
        url: SOUND_PATHS['screen-share-stop'],
        loop: false,
        fadeIn: 100,
        fadeOut: 100,
        delay: 0
    },
    'mute': {
        enabled: true,
        volume: 0.4,
        url: SOUND_PATHS['mute'],
        loop: false,
        fadeIn: 50,
        fadeOut: 50,
        delay: 0
    },
    'unmute': {
        enabled: true,
        volume: 0.4,
        url: SOUND_PATHS['unmute'],
        loop: false,
        fadeIn: 50,
        fadeOut: 50,
        delay: 0
    },
    'camera-on': {
        enabled: true,
        volume: 0.4,
        url: SOUND_PATHS['camera-on'],
        loop: false,
        fadeIn: 50,
        fadeOut: 50,
        delay: 0
    },
    'camera-off': {
        enabled: true,
        volume: 0.4,
        url: SOUND_PATHS['camera-off'],
        loop: false,
        fadeIn: 50,
        fadeOut: 50,
        delay: 0
    },
    'connection-lost': {
        enabled: true,
        volume: 0.9,
        url: SOUND_PATHS['connection-lost'],
        loop: false,
        fadeIn: 0,
        fadeOut: 200,
        delay: 0
    },
    'connection-restored': {
        enabled: true,
        volume: 0.8,
        url: SOUND_PATHS['connection-restored'],
        loop: false,
        fadeIn: 100,
        fadeOut: 100,
        delay: 0
    }
} as const;

// 音频处理默认选项
export const DEFAULT_AUDIO_PROCESSING: AudioProcessingOptions = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1,
    latency: 0.01 // 10ms
};

// 音频质量预设
export const AUDIO_QUALITY_PRESETS: Record<string, AudioQualitySettings> = {
    low: {
        preset: 'low',
        bandwidth: {
            bitrate: 32000,
            sampleRate: 22050,
            channels: 1,
            codec: 'opus',
            adaptive: true,
            maxBitrate: 48000,
            minBitrate: 16000
        },
        latency: 'normal',
        reliability: 'best-effort',
        adaptive: true
    },
    medium: {
        preset: 'medium',
        bandwidth: {
            bitrate: 64000,
            sampleRate: 44100,
            channels: 1,
            codec: 'opus',
            adaptive: true,
            maxBitrate: 96000,
            minBitrate: 32000
        },
        latency: 'low',
        reliability: 'best-effort',
        adaptive: true
    },
    high: {
        preset: 'high',
        bandwidth: {
            bitrate: 128000,
            sampleRate: 48000,
            channels: 2,
            codec: 'opus',
            adaptive: true,
            maxBitrate: 192000,
            minBitrate: 64000
        },
        latency: 'low',
        reliability: 'guaranteed',
        adaptive: true
    },
    ultra: {
        preset: 'ultra',
        bandwidth: {
            bitrate: 256000,
            sampleRate: 48000,
            channels: 2,
            codec: 'opus',
            adaptive: false,
            maxBitrate: 320000,
            minBitrate: 128000
        },
        latency: 'ultra-low',
        reliability: 'guaranteed',
        adaptive: false
    }
} as const;

// 音频设备约束
export const AUDIO_CONSTRAINTS = {
    microphone: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
        volume: { min: 0.0, max: 1.0 }
    },
    speakers: {
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 2 },
        volume: { min: 0.0, max: 1.0 },
        latency: { ideal: 0.01 }
    }
} as const;

// 音频效果预设
export const AUDIO_EFFECT_PRESETS: Record<string, AudioEffects> = {
    none: {
        reverb: { enabled: false, roomSize: 0, damping: 0, wetness: 0 },
        compressor: { enabled: false, threshold: 0, ratio: 1, attack: 0, release: 0 },
        equalizer: { enabled: false, bands: [] },
        filter: { enabled: false, type: 'lowpass', frequency: 1000, q: 1 }
    },
    voice: {
        reverb: { enabled: false, roomSize: 0, damping: 0, wetness: 0 },
        compressor: { enabled: true, threshold: -18, ratio: 3, attack: 3, release: 100 },
        equalizer: {
            enabled: true,
            bands: [
                { frequency: 80, gain: -6, q: 0.7 },
                { frequency: 200, gain: -3, q: 0.8 },
                { frequency: 1000, gain: 2, q: 1.0 },
                { frequency: 3000, gain: 3, q: 0.9 },
                { frequency: 8000, gain: 1, q: 0.7 }
            ]
        },
        filter: { enabled: true, type: 'highpass', frequency: 80, q: 0.7 }
    },
    music: {
        reverb: { enabled: true, roomSize: 0.3, damping: 0.5, wetness: 0.2 },
        compressor: { enabled: true, threshold: -12, ratio: 2, attack: 5, release: 200 },
        equalizer: {
            enabled: true,
            bands: [
                { frequency: 60, gain: 2, q: 0.7 },
                { frequency: 170, gain: 0, q: 0.8 },
                { frequency: 500, gain: -1, q: 1.0 },
                { frequency: 1400, gain: 1, q: 0.9 },
                { frequency: 4000, gain: 2, q: 0.8 },
                { frequency: 10000, gain: 1, q: 0.7 }
            ]
        },
        filter: { enabled: false, type: 'lowpass', frequency: 20000, q: 1 }
    },
    broadcast: {
        reverb: { enabled: false, roomSize: 0, damping: 0, wetness: 0 },
        compressor: { enabled: true, threshold: -16, ratio: 4, attack: 1, release: 50 },
        equalizer: {
            enabled: true,
            bands: [
                { frequency: 100, gain: -12, q: 0.7 },
                { frequency: 300, gain: -3, q: 0.8 },
                { frequency: 1000, gain: 3, q: 1.0 },
                { frequency: 3000, gain: 4, q: 0.9 },
                { frequency: 6000, gain: 2, q: 0.8 },
                { frequency: 12000, gain: -2, q: 0.7 }
            ]
        },
        filter: { enabled: true, type: 'bandpass', frequency: 300, q: 0.5 }
    }
} as const;

// 音频可视化配置
export const AUDIO_VISUALIZATION_CONFIG = {
    waveform: {
        fftSize: 2048,
        smoothingTimeConstant: 0.8,
        barCount: 128,
        minDecibels: -90,
        maxDecibels: -10,
        colors: {
            primary: '#3B82F6',
            secondary: '#1E40AF',
            background: '#1F2937'
        }
    },
    spectrum: {
        fftSize: 4096,
        smoothingTimeConstant: 0.6,
        barCount: 64,
        minDecibels: -100,
        maxDecibels: -30,
        colors: {
            primary: '#10B981',
            secondary: '#059669',
            background: '#1F2937'
        }
    },
    meter: {
        updateInterval: 50, // ms
        peakHoldTime: 1000, // ms
        colors: {
            low: '#10B981',
            medium: '#F59E0B',
            high: '#EF4444',
            peak: '#DC2626',
            background: '#374151'
        },
        thresholds: {
            low: 0.3,
            medium: 0.7,
            high: 0.9
        }
    }
} as const;

// 音频设备类型
export const AUDIO_DEVICE_TYPES = {
    INPUT: 'audioinput',
    OUTPUT: 'audiooutput'
} as const;

// 音频编解码器
export const AUDIO_CODECS = {
    OPUS: 'opus',
    AAC: 'aac',
    G722: 'g722',
    PCMU: 'pcmu',
    PCMA: 'pcma'
} as const;

// 音频采样率
export const SAMPLE_RATES = [
    8000,   // 电话质量
    16000,  // 宽带语音
    22050,  // 标准音频
    32000,  // 专业音频
    44100,  // CD质量
    48000,  // 专业数字音频
    96000,  // 高分辨率音频
    192000  // 超高分辨率音频
] as const;

// 音频延迟级别
export const LATENCY_LEVELS = {
    'ultra-low': { target: 5, description: '超低延迟 (5ms) - 专业录音' },
    'low': { target: 20, description: '低延迟 (20ms) - 实时通信' },
    'normal': { target: 50, description: '正常 (50ms) - 一般应用' },
    'high': { target: 100, description: '高延迟 (100ms) - 流媒体' }
} as const;

// 噪声抑制等级
export const NOISE_SUPPRESSION_LEVELS = {
    off: { enabled: false, level: 0, description: '关闭' },
    low: { enabled: true, level: 0.3, description: '轻度抑制' },
    medium: { enabled: true, level: 0.6, description: '中度抑制' },
    high: { enabled: true, level: 0.9, description: '强力抑制' },
    aggressive: { enabled: true, level: 1.0, description: '激进抑制' }
} as const;

// 回声消除等级
export const ECHO_CANCELLATION_LEVELS = {
    off: { enabled: false, description: '关闭' },
    basic: { enabled: true, description: '基础回声消除' },
    advanced: { enabled: true, description: '高级回声消除' }
} as const;

// 音频监控配置
export const AUDIO_MONITORING = {
    updateInterval: 100, // ms
    historyLength: 100, // 保留历史数据点数
    thresholds: {
        volume: {
            low: 0.1,
            medium: 0.5,
            high: 0.8,
            clip: 0.95
        },
        latency: {
            good: 50, // ms
            acceptable: 100,
            poor: 200
        },
        packetLoss: {
            good: 0.01, // 1%
            acceptable: 0.05, // 5%
            poor: 0.1 // 10%
        }
    }
} as const;

// 本地存储键名
export const AUDIO_STORAGE_KEYS = {
    SETTINGS: 'livekit_audio_settings',
    DEVICE_PREFERENCES: 'livekit_audio_devices',
    VOLUME_LEVELS: 'livekit_volume_levels',
    EFFECT_PRESETS: 'livekit_effect_presets',
    NOTIFICATION_SOUNDS: 'livekit_notification_sounds',
    CALIBRATION_DATA: 'livekit_audio_calibration'
} as const;

// 音频权限状态
export const AUDIO_PERMISSION_STATES = {
    GRANTED: 'granted',
    DENIED: 'denied',
    PROMPT: 'prompt'
} as const;

// 音频错误代码
export const AUDIO_ERROR_CODES = {
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
    DEVICE_IN_USE: 'DEVICE_IN_USE',
    HARDWARE_ERROR: 'HARDWARE_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    CODEC_ERROR: 'CODEC_ERROR',
    BUFFER_ERROR: 'BUFFER_ERROR',
    CONTEXT_ERROR: 'CONTEXT_ERROR'
} as const;

// 音频状态
export const AUDIO_STATES = {
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    ACTIVE: 'active',
    MUTED: 'muted',
    ERROR: 'error',
    DISCONNECTED: 'disconnected'
} as const;

// 音频测试配置
export const AUDIO_TEST_CONFIG = {
    testTone: {
        frequency: 1000, // Hz
        duration: 1000, // ms
        volume: 0.5,
        waveform: 'sine'
    },
    micTest: {
        duration: 5000, // ms
        sampleRate: 48000,
        threshold: 0.01 // 最小音量阈值
    },
    latencyTest: {
        iterations: 10,
        interval: 100, // ms
        timeout: 5000 // ms
    }
} as const;

// 音频统计指标
export const AUDIO_METRICS = {
    SAMPLE_RATE: 'sampleRate',
    BITRATE: 'bitrate',
    CODEC: 'codec',
    LATENCY: 'latency',
    JITTER: 'jitter',
    PACKET_LOSS: 'packetLoss',
    INPUT_LEVEL: 'inputLevel',
    OUTPUT_LEVEL: 'outputLevel',
    ECHO_RETURN_LOSS: 'echoReturnLoss',
    BACKGROUND_NOISE: 'backgroundNoise'
} as const;