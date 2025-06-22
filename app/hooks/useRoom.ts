'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Room, RoomEvent, ConnectionState, ParticipantEvent, DataPacket_Kind, DisconnectReason, Track } from 'livekit-client';
import { 
    RoomConnectionState, 
    RoomState, 
    RoomConnectionParams, 
    AudioProcessingOptions,
    RoomEvents 
} from '../types/room';

interface UseRoomOptions {
    autoConnect?: boolean;
    reconnectOnFailure?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    events?: RoomEvents;
}

interface UseRoomReturn {
    roomState: RoomState;
    connect: (params: RoomConnectionParams) => Promise<void>;
    disconnect: () => Promise<void>;
    reconnect: () => Promise<void>;
    toggleMicrophone: () => Promise<void>;
    toggleCamera: () => Promise<void>;
    toggleScreenShare: () => Promise<void>;
    sendData: (data: Uint8Array, reliable?: boolean) => Promise<void>;
    updateAudioSettings: (options: AudioProcessingOptions) => Promise<void>;
    isConnected: boolean;
    isConnecting: boolean;
    hasError: boolean;
}

export function useRoom(options: UseRoomOptions = {}): UseRoomReturn {
    const {
        autoConnect = false,
        reconnectOnFailure = true,
        maxReconnectAttempts = 3,
        reconnectDelay = 3000,
        events = {}
    } = options;

    // 状态管理
    const [roomState, setRoomState] = useState<RoomState>({
        connectionState: RoomConnectionState.DISCONNECTED,
        isLoading: false,
        error: null,
        participants: [],
        localParticipant: null,
        room: null
    });

    // Refs
    const roomRef = useRef<Room | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionParamsRef = useRef<RoomConnectionParams | null>(null);
    const isMountedRef = useRef(true);

    // 计算派生状态
    const isConnected = roomState.connectionState === RoomConnectionState.CONNECTED;
    const isConnecting = roomState.connectionState === RoomConnectionState.CONNECTING || 
                         roomState.connectionState === RoomConnectionState.RECONNECTING;
    const hasError = roomState.connectionState === RoomConnectionState.FAILED;

    // 更新状态的辅助函数
    const updateRoomState = useCallback((updates: Partial<RoomState>) => {
        if (!isMountedRef.current) return;
        setRoomState(prev => ({ ...prev, ...updates }));
    }, []);

    // 设置房间事件监听器
    const setupRoomEvents = useCallback((room: Room) => {
        // 连接状态变化
        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            let connectionState: RoomConnectionState;
            
            switch (state) {
                case ConnectionState.Connecting:
                    connectionState = RoomConnectionState.CONNECTING;
                    break;
                case ConnectionState.Connected:
                    connectionState = RoomConnectionState.CONNECTED;
                    reconnectAttemptsRef.current = 0; // 重置重连次数
                    break;
                case ConnectionState.Disconnected:
                    connectionState = RoomConnectionState.DISCONNECTED;
                    break;
                case ConnectionState.Reconnecting:
                    connectionState = RoomConnectionState.RECONNECTING;
                    break;
                default:
                    connectionState = RoomConnectionState.FAILED;
            }

            updateRoomState({ 
                connectionState,
                isLoading: connectionState === RoomConnectionState.CONNECTING || 
                          connectionState === RoomConnectionState.RECONNECTING,
                error: connectionState === RoomConnectionState.FAILED ? '连接失败' : null
            });

            events.onConnectionStateChanged?.(connectionState);
        });

        // 参与者连接
        room.on(RoomEvent.ParticipantConnected, (participant) => {
            console.log('参与者加入:', participant.identity);
            updateRoomState({
                participants: Array.from(room.remoteParticipants.values())
            });
            events.onParticipantConnected?.(participant);
        });

        // 参与者断开连接
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            console.log('参与者离开:', participant.identity);
            updateRoomState({
                participants: Array.from(room.remoteParticipants.values())
            });
            events.onParticipantDisconnected?.(participant);
        });

        // 接收数据
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant) => {
            events.onDataReceived?.(payload, participant);
        });

        // 房间断开连接
        room.on(RoomEvent.Disconnected, (reason) => {
            console.log('房间断开连接:', reason);
            updateRoomState({
                connectionState: RoomConnectionState.DISCONNECTED,
                isLoading: false,
                participants: [],
                localParticipant: null,
                room: null
            });
            
            events.onRoomDisconnected?.();

            // 自动重连逻辑
            if (reconnectOnFailure && 
                reason !== DisconnectReason.CLIENT_INITIATED && 
                reconnectAttemptsRef.current < maxReconnectAttempts &&
                connectionParamsRef.current) {
                
                reconnectAttemptsRef.current++;
                console.log(`尝试重连 (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
                
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current && connectionParamsRef.current) {
                        reconnect();
                    }
                }, reconnectDelay);
            }
        });

        // 错误处理
        room.on(RoomEvent.RoomMetadataChanged, (metadata) => {
            console.log('房间元数据更新:', metadata);
        });

    }, [events, reconnectOnFailure, maxReconnectAttempts, reconnectDelay, updateRoomState]);

    // 断开连接
    const disconnect = useCallback(async () => {
        try {
            // 清除重连定时器
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (roomRef.current) {
                await roomRef.current.disconnect();
                roomRef.current = null;
            }

            connectionParamsRef.current = null;
            reconnectAttemptsRef.current = 0;

            updateRoomState({
                connectionState: RoomConnectionState.DISCONNECTED,
                isLoading: false,
                error: null,
                room: null,
                localParticipant: null,
                participants: []
            });

            console.log('已断开房间连接');

        } catch (error) {
            console.error('断开连接时出错:', error);
        }
    }, [updateRoomState]);

    // 连接到房间
    const connect = useCallback(async (params: RoomConnectionParams) => {
        try {
            if (roomRef.current) {
                await disconnect();
            }

            updateRoomState({
                connectionState: RoomConnectionState.CONNECTING,
                isLoading: true,
                error: null
            });

            connectionParamsRef.current = params;
            
            // 🎯 修复：完全禁用默认音频捕获和发布
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
                
                // 🎯 关键：不设置任何默认音频捕获选项
                // audioCaptureDefaults: undefined, // 完全不设置
                
                videoCaptureDefaults: {
                    resolution: {
                        width: 1280,
                        height: 720,
                        frameRate: 30
                    }
                },
                publishDefaults: {
                    stopMicTrackOnMute: true,
                    audioPreset: {
                        maxBitrate: 20_000,
                    },
                    dtx: false,
                    red: true,
                    simulcast: true,
                }
            });

            roomRef.current = room;
            setupRoomEvents(room);

            // 获取访问令牌
            let token = params.token;
            if (!token) {
                const response = await fetch('https://livekit-api.2k2.cc/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        room: params.roomName,
                        username: params.participantName,
                    }),
                });

                if (!response.ok) {
                    throw new Error('获取访问令牌失败');
                }

                const data = await response.json();
                token = data.token;
            }

            // 🎯 修复：连接时明确禁用自动音频发布
            const connectOptions = {
                autoSubscribe: true,
                publishAudio: false, // 🎯 关键：禁用自动音频发布
                publishVideo: false, // 🎯 也禁用自动视频发布，让用户手动控制
            };

            // 连接到房间
            const serverUrl = params.serverUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL;
            if (!serverUrl) {
                throw new Error('LiveKit 服务器地址未配置');
            }

            if (!token) {
                throw new Error('访问令牌获取失败');
            }

            await room.connect(serverUrl, token, connectOptions);

            // 启用音频和视频
            await room.localParticipant.enableCameraAndMicrophone();

            updateRoomState({
                connectionState: RoomConnectionState.CONNECTED,
                isLoading: false,
                room,
                localParticipant: room.localParticipant,
                participants: Array.from(room.remoteParticipants.values())
            });

            console.log('成功连接到房间:', params.roomName);

        } catch (error) {
            console.error('连接房间失败:', error);
            
            updateRoomState({
                connectionState: RoomConnectionState.FAILED,
                isLoading: false,
                error: error instanceof Error ? error.message : '连接失败'
            });

            events.onError?.(error instanceof Error ? error : new Error('连接失败'));
            throw error;
        }
    }, [setupRoomEvents, updateRoomState, events, disconnect]);

    // 重新连接
    const reconnect = useCallback(async () => {
        if (connectionParamsRef.current) {
            await connect(connectionParamsRef.current);
        }
    }, [connect]);

    // 切换麦克风
    const toggleMicrophone = useCallback(async () => {
        if (!roomRef.current?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const participant = roomRef.current.localParticipant;
        const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
        
        if (audioPublication) {
            await participant.setMicrophoneEnabled(!audioPublication.isMuted);
        } else {
            await participant.setMicrophoneEnabled(true);
        }
    }, []);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (!roomRef.current?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const participant = roomRef.current.localParticipant;
        const videoPublication = participant.getTrackPublication(Track.Source.Camera);
        
        if (videoPublication) {
            await participant.setCameraEnabled(!videoPublication.isMuted);
        } else {
            await participant.setCameraEnabled(true);
        }
    }, []);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!roomRef.current?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const participant = roomRef.current.localParticipant;
        const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
        
        if (screenPublication) {
            await participant.setScreenShareEnabled(false);
        } else {
            await participant.setScreenShareEnabled(true);
        }
    }, []);

    // 发送数据
    const sendData = useCallback(async (data: Uint8Array, reliable: boolean = true) => {
        if (!roomRef.current?.localParticipant) {
            throw new Error('未连接到房间');
        }

        await roomRef.current.localParticipant.publishData(
            data,
            { reliable, destinationIdentities: undefined }
        );
    }, []);

    // 更新音频设置
    const updateAudioSettings = useCallback(async (options: AudioProcessingOptions) => {
        if (!roomRef.current?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const audioPublication = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication && audioPublication.track) {
            // 获取当前音频轨道的约束
            const mediaStreamTrack = audioPublication.track.mediaStreamTrack;
            if (mediaStreamTrack) {
                try {
                    await mediaStreamTrack.applyConstraints({
                        echoCancellation: options.echoCancellation,
                        noiseSuppression: options.noiseSuppression,
                        autoGainControl: options.autoGainControl || true,
                        sampleRate: options.sampleRate || 48000,
                        channelCount: options.channelCount || 1
                    });
                    console.log('音频设置已更新:', options);
                } catch (error) {
                    console.warn('应用音频约束失败:', error);
                    // 在某些浏览器中，可能需要重新创建音频轨道
                }
            }
        }
    }, []);

    // 清理函数
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            
            if (roomRef.current) {
                roomRef.current.disconnect();
            }
        };
    }, []);

    // 自动连接
    useEffect(() => {
        if (autoConnect && connectionParamsRef.current) {
            connect(connectionParamsRef.current);
        }
    }, [autoConnect, connect]);

    return {
        roomState,
        connect,
        disconnect,
        reconnect,
        toggleMicrophone,
        toggleCamera,
        toggleScreenShare,
        sendData,
        updateAudioSettings,
        isConnected,
        isConnecting,
        hasError
    };
}