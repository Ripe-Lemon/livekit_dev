export type SoundEvent = 
    | 'user-join' 
    | 'user-leave' 
    | 'message-notification' 
    | 'error'
    | 'call-start'
    | 'call-end'
    | 'recording-start'
    | 'recording-stop'
    | 'screen-share-start'
    | 'screen-share-stop'
    | 'mute'
    | 'unmute'
    | 'camera-on'
    | 'camera-off'
    | 'connection-lost'
    | 'connection-restored';

export interface AudioConfig {
    globalVolume: number;
    enabled: boolean;
    sounds: Record<SoundEvent, SoundConfig>;
}

export interface SoundConfig {
    enabled: boolean;
    volume: number;
    url?: string;
    loop?: boolean;
    fadeIn?: number;
    fadeOut?: number;
    delay?: number;
}

export interface AudioDeviceInfo {
    deviceId: string;
    groupId: string;
    kind: MediaDeviceKind;
    label: string;
}

export interface AudioStreamInfo {
    id: string;
    label: string;
    muted: boolean;
    volume: number;
    active: boolean;
    source: 'microphone' | 'system' | 'file';
}

export interface AudioProcessingOptions {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    sampleRate?: number;
    channelCount?: number;
    latency?: number;
}

export interface AudioEffects {
    reverb?: {
        enabled: boolean;
        roomSize: number;
        damping: number;
        wetness: number;
    };
    compressor?: {
        enabled: boolean;
        threshold: number;
        ratio: number;
        attack: number;
        release: number;
    };
    equalizer?: {
        enabled: boolean;
        bands: Array<{
            frequency: number;
            gain: number;
            q: number;
        }>;
    };
    filter?: {
        enabled: boolean;
        type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
        frequency: number;
        q: number;
    };
}

export interface AudioAnalytics {
    inputLevel: number;
    outputLevel: number;
    latency: number;
    jitter: number;
    packetLoss: number;
    bitrate: number;
    codec: string;
}

export interface AudioRecordingOptions {
    format: 'mp3' | 'wav' | 'ogg' | 'webm';
    quality: 'low' | 'medium' | 'high';
    bitrate?: number;
    sampleRate?: number;
    channels: 1 | 2;
    maxDuration?: number; // seconds
    autoStop?: boolean;
}

export interface AudioRecording {
    id: string;
    blob: Blob;
    duration: number;
    size: number;
    format: string;
    timestamp: Date;
    metadata?: {
        title?: string;
        description?: string;
        tags?: string[];
    };
}

export interface AudioVisualization {
    type: 'waveform' | 'spectrum' | 'meter';
    enabled: boolean;
    options: {
        color?: string;
        backgroundColor?: string;
        barCount?: number;
        smoothing?: number;
        sensitivity?: number;
    };
}

export interface SpatialAudioOptions {
    enabled: boolean;
    listenerPosition: {
        x: number;
        y: number;
        z: number;
    };
    listenerOrientation: {
        forward: [number, number, number];
        up: [number, number, number];
    };
}

export interface AudioParticipant {
    id: string;
    name: string;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    audioLevel: number;
    isMuted: boolean;
    isSpeaking: boolean;
    volume: number;
    effects: AudioEffects;
}

export interface VoiceDetection {
    enabled: boolean;
    threshold: number;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    language: string;
}

export interface VoiceCommand {
    phrase: string;
    action: string;
    confidence: number;
    timestamp: Date;
}

export interface AudioMixerChannel {
    id: string;
    label: string;
    input: AudioStreamInfo;
    volume: number;
    muted: boolean;
    solo: boolean;
    effects: AudioEffects;
    routing: string[];
}

export interface AudioMixerSettings {
    masterVolume: number;
    channels: AudioMixerChannel[];
    crossfader: {
        position: number;
        curve: 'linear' | 'logarithmic';
    };
    monitoring: {
        enabled: boolean;
        channel: string;
        volume: number;
    };
}

export interface AudioPreset {
    id: string;
    name: string;
    description: string;
    settings: {
        processing: AudioProcessingOptions;
        effects: AudioEffects;
        volume: number;
    };
    category: 'music' | 'voice' | 'gaming' | 'presentation' | 'custom';
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AudioNotification {
    id: string;
    type: 'device-changed' | 'permission-denied' | 'level-warning' | 'quality-degraded';
    severity: 'info' | 'warning' | 'error';
    message: string;
    timestamp: Date;
    autoHide: boolean;
    duration?: number;
    actions?: Array<{
        label: string;
        action: () => void;
    }>;
}

export interface AudioMetrics {
    timestamp: Date;
    inputLevel: number;
    outputLevel: number;
    latency: number;
    jitter: number;
    packetLoss: number;
    bitrate: number;
    quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AudioProfile {
    id: string;
    name: string;
    user: string;
    settings: {
        devices: {
            input?: string;
            output?: string;
        };
        processing: AudioProcessingOptions;
        effects: AudioEffects;
        volume: {
            master: number;
            microphone: number;
            speakers: number;
        };
        notifications: {
            sounds: Record<SoundEvent, boolean>;
            volume: number;
        };
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AudioCalibration {
    timestamp: Date;
    environment: 'quiet' | 'normal' | 'noisy';
    recommendations: {
        inputGain: number;
        noiseSuppression: boolean;
        echoCancellation: boolean;
        threshold: number;
    };
    ambientNoise: number;
    echoDelay: number;
    reverberation: number;
}

export interface AudioAccessibility {
    visualIndicators: {
        enabled: boolean;
        showSpeaking: boolean;
        showMuted: boolean;
        showLevels: boolean;
    };
    captions: {
        enabled: boolean;
        language: string;
        fontSize: number;
        position: 'top' | 'bottom' | 'overlay';
    };
    hapticFeedback: {
        enabled: boolean;
        patterns: Record<SoundEvent, boolean>;
    };
}

export interface AudioSecurity {
    encryption: {
        enabled: boolean;
        algorithm: string;
        keySize: number;
    };
    endToEnd: boolean;
    recording: {
        allowed: boolean;
        notification: boolean;
        retention: number; // days
    };
    monitoring: {
        enabled: boolean;
        logLevel: 'none' | 'basic' | 'detailed';
    };
}

export interface AudioBandwidth {
    bitrate: number;
    sampleRate: number;
    channels: number;
    codec: string;
    adaptive: boolean;
    maxBitrate: number;
    minBitrate: number;
}

export interface AudioQualitySettings {
    preset: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
    bandwidth: AudioBandwidth;
    latency: 'ultra-low' | 'low' | 'normal' | 'high';
    reliability: 'best-effort' | 'guaranteed';
    adaptive: boolean;
}

// 在现有内容基础上添加音频处理相关类型

// 现有的音频设置类型
export interface LiveKitAudioSettings {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    voiceDetectionThreshold: number;
}

export interface ParticipantVolumeSettings {
    [participantId: string]: number;
}

// 新增：音频处理模块设置
export interface AudioProcessingSettings {
    autoGainControl: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    microphoneThreshold: number; // 0-1 范围
}

// 新增：音频处理状态
export interface AudioProcessingState {
    isProcessing: boolean;
    currentSettings: AudioProcessingSettings;
    lastError?: string;
}

// 新增：音频约束配置
export interface AudioConstraintsConfig {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    sampleRate?: number | ConstrainULong;
    channelCount?: number | ConstrainULong;
    deviceId?: string;
}

// 新增：音频处理事件
export type AudioProcessingEvent = 
    | 'settings-changed'
    | 'processing-started'
    | 'processing-completed'
    | 'processing-failed'
    | 'track-recreated';

export interface AudioProcessingEventData {
    event: AudioProcessingEvent;
    settings?: AudioProcessingSettings;
    error?: Error;
    timestamp: number;
}