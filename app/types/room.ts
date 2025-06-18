import { Room, Participant, Track } from 'livekit-client';

// 房间连接状态枚举
export enum RoomConnectionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
}

// 音频处理选项接口
export interface AudioProcessingOptions {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl?: boolean;
    sampleRate?: number;
    channelCount?: number;
}

// 房间配置接口
export interface RoomConfig {
    adaptiveStream: boolean;
    dynacast: boolean;
    audioPreset?: string;
    videoQuality?: 'low' | 'medium' | 'high';
    autoSubscribe?: boolean;
}

// 房间连接参数接口
export interface RoomConnectionParams {
    roomName: string;
    participantName: string;
    token?: string;
    serverUrl?: string;
}

// 房间状态接口
export interface RoomState {
    connectionState: RoomConnectionState;
    isLoading: boolean;
    error: string | null;
    participants: Participant[];
    localParticipant: Participant | null;
    room: Room | null;
}

// 音频轨道发布选项
export interface AudioTrackPublishOptions {
    audioPreset: any; // AudioPresets 类型
    dtx: boolean;
    red: boolean;
    source: Track.Source;
}

// 参与者信息接口
export interface ParticipantInfo {
    identity: string;
    name?: string;
    metadata?: string;
    isLocal: boolean;
    connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
    isSpeaking: boolean;
    audioEnabled: boolean;
    videoEnabled: boolean;
    screenShareEnabled: boolean;
}

// 房间统计信息接口
export interface RoomStats {
    participantCount: number;
    duration: number; // 房间持续时间（秒）
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    roundTripTime: number; // RTT（毫秒）
}

// 房间事件类型
export interface RoomEvents {
    onParticipantConnected?: (participant: Participant) => void;
    onParticipantDisconnected?: (participant: Participant) => void;
    onConnectionStateChanged?: (state: RoomConnectionState) => void;
    onDataReceived?: (payload: Uint8Array, participant?: Participant) => void;
    onError?: (error: Error) => void;
    onRoomDisconnected?: () => void;
}

// 媒体设备信息接口
export interface MediaDeviceInfo {
    deviceId: string;
    label: string;
    kind: 'audioinput' | 'audiooutput' | 'videoinput';
    groupId?: string;
}

// 设备权限状态
export enum DevicePermissionState {
    GRANTED = 'granted',
    DENIED = 'denied',
    PROMPT = 'prompt',
    UNKNOWN = 'unknown'
}

// 媒体权限接口
export interface MediaPermissions {
    camera: DevicePermissionState;
    microphone: DevicePermissionState;
}

// 房间操作接口
export interface RoomActions {
    connect: (params: RoomConnectionParams) => Promise<void>;
    disconnect: () => Promise<void>;
    toggleMicrophone: () => Promise<void>;
    toggleCamera: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    sendData: (data: Uint8Array, reliable?: boolean) => Promise<void>;
    updateAudioSettings: (options: AudioProcessingOptions) => Promise<void>;
}

// 控制栏配置接口
export interface ControlBarConfig {
    showMicrophone: boolean;
    showCamera: boolean;
    showScreenShare: boolean;
    showLeave: boolean;
    showSettings: boolean;
    variation: 'minimal' | 'verbose' | 'textOnly';
}

// 音频设置接口
export interface AudioSettings {
    enabled: boolean;
    volume: number;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    deviceId?: string;
}

// 视频设置接口
export interface VideoSettings {
    enabled: boolean;
    quality: 'low' | 'medium' | 'high';
    frameRate: number;
    deviceId?: string;
    facingMode?: 'user' | 'environment';
}

// 布局设置接口
export interface LayoutSettings {
    mode: 'grid' | 'focus' | 'sidebar';
    showParticipantNames: boolean;
    showConnectionQuality: boolean;
    maxParticipants: number;
}

// 房间设置接口
export interface RoomSettings {
    audio: AudioSettings;
    video: VideoSettings;
    layout: LayoutSettings;
    chat: {
        enabled: boolean;
        sounds: boolean;
    };
}

// API 响应接口
export interface RoomTokenResponse {
    token: string;
    error?: string;
    expiresAt?: number;
}

// 房间元数据接口
export interface RoomMetadata {
    name: string;
    description?: string;
    maxParticipants?: number;
    isPublic: boolean;
    createdAt: Date;
    createdBy: string;
}

// 网络质量枚举
export enum NetworkQuality {
    EXCELLENT = 'excellent',
    GOOD = 'good',
    POOR = 'poor',
    UNKNOWN = 'unknown'
}

// 连接质量统计
export interface ConnectionQuality {
    overall: NetworkQuality;
    audio: NetworkQuality;
    video: NetworkQuality;
    latency: number;
    packetLoss: number;
    bandwidth: {
        upload: number;
        download: number;
    };
}

// 简化房间类型，移除持久化相关字段
export interface RoomInfo {
    id: string;
    name: string;
    description?: string;
    participantCount: number;
    createdAt: string;
    lastActivity: string;
    isActive: boolean;
    createdBy: string;
}

// 常驻房间配置
export interface PermanentRoom {
    id: string;
    name: string;
    description: string;
    category: string;
    icon?: string;
    color?: string;
}

// 移除不必要的房间标签
export enum RoomTag {
    PUBLIC = 'public',
    PRIVATE = 'private'
}

export interface RoomListResponse {
    rooms: RoomInfo[];
    total: number;
}