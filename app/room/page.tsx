'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    LiveKitRoom, 
    VideoConference, 
    formatChatMessageLinks, 
    useRoomContext,
    Chat,
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    useParticipants
} from '@livekit/components-react';
import { Room, DisconnectReason, ConnectionQuality, Track } from 'livekit-client';

// Components
import { LoadingSpinner, PageLoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorDisplay } from '../components/ui/ErrorDisplay';
import { ImagePreview } from '../components/ui/ImagePreview';
import { NotificationCenter } from '../components/ui/NotificationCenter';

// Hooks
import { useImagePreview } from '../hooks/useImagePreview';

// Types
import { RoomConnectionParams } from '../types/room';

// Styles
import '@livekit/components-styles';

interface RoomPageProps {}

interface RoomState {
    isConnecting: boolean;
    isConnected: boolean;
    error: string | null;
    token: string | null;
    serverUrl: string | null;
    connectionAttempts: number;
}

interface UIState {
    showChat: boolean;
    showParticipants: boolean;
    showSettings: boolean;
    isFullscreen: boolean;
    sidebarCollapsed: boolean;
    chatWidth: number;
}

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
}

// 自定义控制栏组件
function CustomControlBar({ 
    onToggleChat, 
    onToggleParticipants, 
    onToggleSettings, 
    onToggleFullscreen, 
    onLeaveRoom,
    isFullscreen,
    showChat 
}: {
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onToggleSettings: () => void;
    onToggleFullscreen: () => void;
    onLeaveRoom: () => void;
    isFullscreen: boolean;
    showChat: boolean;
}) {
    return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="flex items-center space-x-2 bg-gray-800 bg-opacity-90 backdrop-blur-sm rounded-lg px-4 py-2">
                {/* LiveKit 默认控制栏 */}
                <div className="flex items-center space-x-2">
                    <ControlBar variation="minimal" />
                </div>
                
                <div className="w-px h-6 bg-gray-600 mx-2"></div>
                
                {/* 自定义按钮 */}
                <button
                    onClick={onToggleChat}
                    className={`p-2 rounded-lg text-white transition-colors ${
                        showChat ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    title="聊天"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </button>
                
                <button
                    onClick={onToggleParticipants}
                    className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    title="参与者"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                </button>
                
                <button
                    onClick={onToggleSettings}
                    className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    title="设置"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                
                <button
                    onClick={onToggleFullscreen}
                    className="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    title={isFullscreen ? "退出全屏" : "全屏"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isFullscreen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15H4.5M9 15v4.5M9 15l-5.5 5.5" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        )}
                    </svg>
                </button>
                
                <div className="w-px h-6 bg-gray-600 mx-2"></div>
                
                <button
                    onClick={onLeaveRoom}
                    className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                    title="离开房间"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// 自定义视频网格组件
function CustomVideoConference({ uiState }: { uiState: UIState }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    return (
        <div className="relative w-full h-full">
            <GridLayout tracks={tracks} style={{ height: '100%' }}>
                <ParticipantTile />
            </GridLayout>
            <RoomAudioRenderer />
        </div>
    );
}

// 聊天面板组件
function ChatPanel({ 
    isOpen, 
    onClose, 
    width 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    width: number; 
}) {
    if (!isOpen) return null;

    return (
        <div 
            className="absolute top-0 right-0 h-full bg-gray-800 border-l border-gray-700 z-10 flex flex-col"
            style={{ width: `${width}px` }}
        >
            {/* 聊天头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h3 className="text-lg font-semibold text-white">聊天</h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            {/* 聊天内容 */}
            <div className="flex-1">
                <Chat 
                    messageFormatter={formatChatMessageLinks}
                    style={{ height: '100%' }}
                />
            </div>
        </div>
    );
}

// 参与者面板组件
function ParticipantsPanel({ 
    isOpen, 
    onClose 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
}) {
    const room = useRoomContext();
    const participants = useParticipants();

    if (!isOpen) return null;

    return (
        <div className="absolute top-0 left-0 h-full w-80 bg-gray-800 border-r border-gray-700 z-10">
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">参与者</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="space-y-4">
                    {room && (
                        <div className="text-sm text-gray-300">
                            <p className="mb-2">房间: {room.name}</p>
                            <p className="mb-4">总参与者: {participants.length}</p>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <h4 className="font-medium text-white">在线用户</h4>
                        {participants.map((participant) => (
                            <div key={participant.identity} className="flex items-center space-x-3 p-2 rounded-lg bg-gray-700">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">
                                        {participant.identity}
                                        {participant.isLocal && ' (我)'}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {participant.isSpeaking ? '正在说话' : '静默'}
                                    </p>
                                </div>
                                {participant.isCameraEnabled && (
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                                {participant.isMicrophoneEnabled && (
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 房间内部组件 - 可以访问 LiveKit Room Context
function RoomInnerContent({ 
    roomName, 
    username, 
    uiState, 
    toggleUIPanel, 
    toggleFullscreen, 
    leaveRoom, 
    addNotification,
    setChatWidth
}: {
    roomName: string;
    username: string;
    uiState: UIState;
    toggleUIPanel: (panel: keyof UIState) => void;
    toggleFullscreen: () => void;
    leaveRoom: () => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    setChatWidth: (width: number) => void;
}) {
    const room = useRoomContext();
    const participants = useParticipants();
    
    const { 
        previewState, 
        openPreview, 
        closePreview 
    } = useImagePreview();

    useEffect(() => {
        if (!room) return;

        console.log('房间连接成功，房间信息:', {
            name: room.name,
            participants: participants.length,
            localParticipant: room.localParticipant?.identity
        });

        const handleParticipantConnected = (participant: any) => {
            console.log('参与者加入:', participant.identity);
            addNotification({
                type: 'info',
                title: '用户加入',
                message: `${participant.identity} 加入了房间`
            });
        };

        const handleParticipantDisconnected = (participant: any) => {
            console.log('参与者离开:', participant.identity);
            addNotification({
                type: 'info',
                title: '用户离开',
                message: `${participant.identity} 离开了房间`
            });
        };

        const handleConnectionQualityChanged = (quality: ConnectionQuality, participant: any) => {
            console.log('连接质量变化:', quality, participant.identity);
        };

        // 聊天消息事件
        const handleDataReceived = (payload: any, participant: any) => {
            if (payload && typeof payload === 'object') {
                console.log('收到聊天消息:', payload, '来自:', participant?.identity);
            }
        };

        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        room.on('connectionQualityChanged', handleConnectionQualityChanged);
        room.on('dataReceived', handleDataReceived);

        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
            room.off('connectionQualityChanged', handleConnectionQualityChanged);
            room.off('dataReceived', handleDataReceived);
        };
    }, [room, participants.length, addNotification]);

    // 计算视频区域宽度（考虑聊天栏）
    const videoAreaStyle = {
        width: uiState.showChat ? `calc(100% - ${uiState.chatWidth}px)` : '100%'
    };

    return (
        <div className="relative w-full h-full flex">
            {/* 主视频区域 */}
            <div className="relative bg-black" style={videoAreaStyle}>
                <CustomVideoConference uiState={uiState} />
                
                {/* 自定义控制栏 */}
                <CustomControlBar
                    onToggleChat={() => toggleUIPanel('showChat')}
                    onToggleParticipants={() => toggleUIPanel('showParticipants')}
                    onToggleSettings={() => toggleUIPanel('showSettings')}
                    onToggleFullscreen={toggleFullscreen}
                    onLeaveRoom={leaveRoom}
                    isFullscreen={uiState.isFullscreen}
                    showChat={uiState.showChat}
                />
            </div>

            {/* 聊天面板 */}
            <ChatPanel
                isOpen={uiState.showChat}
                onClose={() => toggleUIPanel('showChat')}
                width={uiState.chatWidth}
            />

            {/* 参与者面板 */}
            <ParticipantsPanel
                isOpen={uiState.showParticipants}
                onClose={() => toggleUIPanel('showParticipants')}
            />

            {/* 设置面板 */}
            {uiState.showSettings && (
                <div className="absolute top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-10">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">设置</h3>
                            <button
                                onClick={() => toggleUIPanel('showSettings')}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    聊天栏宽度
                                </label>
                                <input
                                    type="range"
                                    min="280"
                                    max="500"
                                    value={uiState.chatWidth}
                                    onChange={(e) => setChatWidth(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="text-xs text-gray-400 mt-1">
                                    当前宽度: {uiState.chatWidth}px
                                </div>
                            </div>
                            
                            <div className="text-gray-300">
                                <h4 className="font-medium mb-2">房间信息</h4>
                                {room && (
                                    <div className="text-sm space-y-1">
                                        <p>房间名称: {room.name}</p>
                                        <p>我的身份: {room.localParticipant?.identity}</p>
                                        <p>连接状态: {room.state}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 图片预览 */}
            {previewState.isOpen && (
                <ImagePreview
                    src={previewState.src}
                    onClose={closePreview}
                />
            )}
        </div>
    );
}

function RoomPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // URL 参数
    const roomName = searchParams.get('room');
    const username = searchParams.get('username');
    const password = searchParams.get('password');

    // 状态管理
    const [roomState, setRoomState] = useState<RoomState>({
        isConnecting: false,
        isConnected: false,
        error: null,
        token: null,
        serverUrl: null,
        connectionAttempts: 0
    });

    const [uiState, setUIState] = useState<UIState>({
        showChat: false,
        showParticipants: false,
        showSettings: false,
        isFullscreen: false,
        sidebarCollapsed: false,
        chatWidth: 350
    });

    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Refs
    const roomRef = useRef<Room | null>(null);
    const isMountedRef = useRef(true);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 验证必需参数
    const validateParams = useCallback(() => {
        if (!roomName || !username) {
            return '缺少必需的房间参数';
        }
        
        if (roomName.length < 1 || roomName.length > 50) {
            return '房间名称长度必须在1-50个字符之间';
        }
        
        if (username.length < 1 || username.length > 30) {
            return '用户名长度必须在1-30个字符之间';
        }
        
        return null;
    }, [roomName, username]);

    // 获取访问令牌
    const getAccessToken = useCallback(async (): Promise<{token: string, wsUrl: string}> => {
        try {
            if (!roomName || !username) {
                throw new Error('房间名称和用户名不能为空');
            }
            
            console.log('正在获取访问令牌...', { roomName, username });
            
            const response = await fetch(`https://livekit-api.2k2.cc/api/room?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            console.log('Token API 响应状态:', response.status);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    console.warn('无法解析错误响应:', e);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Token API 响应数据:', data);

            if (!data.token) {
                throw new Error('响应中缺少访问令牌');
            }

            return {
                token: data.token,
                wsUrl: data.wsUrl || 'wss://livekit-wss.2k2.cc'
            };

        } catch (error) {
            console.error('获取访问令牌失败:', error);
            throw error instanceof Error ? error : new Error('获取访问令牌失败');
        }
    }, [roomName, username]);

    // 初始化房间连接
    const initializeRoom = useCallback(async () => {
        const validationError = validateParams();
        if (validationError) {
            setRoomState(prev => ({ ...prev, error: validationError }));
            return;
        }

        setRoomState(prev => ({ 
            ...prev, 
            isConnecting: true, 
            error: null,
            connectionAttempts: prev.connectionAttempts + 1
        }));

        try {
            console.log('开始初始化房间连接...');
            
            const { token, wsUrl } = await getAccessToken();
            
            console.log('Token 获取成功，WS URL:', wsUrl);

            if (isMountedRef.current) {
                setRoomState(prev => ({
                    ...prev,
                    token,
                    serverUrl: wsUrl,
                    isConnecting: false,
                    isConnected: true
                }));

                addNotification({
                    type: 'success',
                    title: '连接成功',
                    message: `正在连接到房间 "${roomName}"`
                });
            }
        } catch (error) {
            console.error('初始化房间失败:', error);
            
            if (isMountedRef.current) {
                const errorMessage = error instanceof Error ? error.message : '连接失败';
                setRoomState(prev => ({
                    ...prev,
                    isConnecting: false,
                    error: errorMessage
                }));

                addNotification({
                    type: 'error',
                    title: '连接失败',
                    message: errorMessage
                });
            }
        }
    }, [validateParams, getAccessToken, roomName]);

    // 添加通知
    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const newNotification = {
            ...notification,
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date()
        };
        
        setNotifications(prev => [...prev, newNotification]);

        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
        }, 5000);
    }, []);

    // 房间事件处理
    const handleRoomConnected = useCallback(() => {
        console.log('LiveKit 房间连接成功');
        
        addNotification({
            type: 'success',
            title: '房间连接成功',
            message: `欢迎加入 "${roomName}"`
        });
    }, [addNotification, roomName]);

    const handleRoomDisconnected = useCallback((reason?: DisconnectReason) => {
        console.log('房间断开连接:', reason);
        roomRef.current = null;
        
        if (reason !== DisconnectReason.CLIENT_INITIATED) {
            addNotification({
                type: 'warning',
                title: '连接断开',
                message: '连接意外断开'
            });
            
            if (roomState.connectionAttempts < 3) {
                console.log('尝试重新连接...');
                reconnectTimeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        initializeRoom();
                    }
                }, 3000);
            } else {
                addNotification({
                    type: 'error',
                    title: '连接失败',
                    message: '多次重连失败，请手动重试'
                });
            }
        }
    }, [addNotification, roomState.connectionAttempts, initializeRoom]);

    const handleRoomError = useCallback((error: Error) => {
        console.error('房间错误:', error);
        
        if (error.message.includes('Client initiated disconnect')) {
            console.log('客户端主动断开连接，忽略错误');
            return;
        }
        
        addNotification({
            type: 'error',
            title: '房间错误',
            message: error.message
        });
    }, [addNotification]);

    // UI 控制函数
    const toggleUIPanel = useCallback((panel: keyof UIState) => {
        setUIState(prev => ({ ...prev, [panel]: !prev[panel] }));
    }, []);

    const setChatWidth = useCallback((width: number) => {
        setUIState(prev => ({ ...prev, chatWidth: width }));
    }, []);

    const toggleFullscreen = useCallback(async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setUIState(prev => ({ ...prev, isFullscreen: true }));
            } else {
                await document.exitFullscreen();
                setUIState(prev => ({ ...prev, isFullscreen: false }));
            }
        } catch (error) {
            console.error('全屏切换失败:', error);
        }
    }, []);

    const leaveRoom = useCallback(async () => {
        try {
            console.log('准备离开房间...');
            
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            
            isMountedRef.current = false;
            router.push('/');
        } catch (error) {
            console.error('离开房间失败:', error);
            router.push('/');
        }
    }, [router]);

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
            
            if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showChat');
            }
            
            if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showParticipants');
            }
            
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showSettings');
            }
            
            if (e.key === 'Escape' && e.ctrlKey) {
                e.preventDefault();
                leaveRoom();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [toggleFullscreen, toggleUIPanel, leaveRoom]);

    // 全屏状态监听
    useEffect(() => {
        const handleFullscreenChange = () => {
            setUIState(prev => ({ 
                ...prev, 
                isFullscreen: !!document.fullscreenElement 
            }));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // 页面离开时清理
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (roomState.isConnected) {
                isMountedRef.current = false;
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [roomState.isConnected]);

    // 初始化
    useEffect(() => {
        initializeRoom();
        
        return () => {
            isMountedRef.current = false;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [initializeRoom]);

    // 渲染错误状态
    if (roomState.error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <ErrorDisplay
                        title="房间连接失败"
                        message={roomState.error}
                        showRetry
                        onRetry={() => {
                            setRoomState(prev => ({ ...prev, error: null, connectionAttempts: 0 }));
                            initializeRoom();
                        }}
                    />
                </div>
            </div>
        );
    }

    // 渲染加载状态
    if (roomState.isConnecting || !roomState.token || !roomState.serverUrl) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <PageLoadingSpinner 
                    text={`正在连接房间... (房间: ${roomName} | 用户: ${username})`}
                />
            </div>
        );
    }

    // 确保必要参数存在
    if (!roomName || !username) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <ErrorDisplay
                        title="参数错误"
                        message="缺少必需的房间参数"
                        showRetry
                        onRetry={() => router.push('/')}
                    />
                </div>
            </div>
        );
    }

    // 主要房间界面
    return (
        <div className={`min-h-screen bg-gray-900 flex flex-col ${uiState.isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
            {/* 房间标题栏 */}
            {!uiState.isFullscreen && (
                <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => router.push('/')}
                                className="text-gray-400 hover:text-white transition-colors"
                                title="返回首页"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-xl font-semibold text-white">{roomName}</h1>
                                <p className="text-sm text-gray-400">用户: {username}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2 text-sm text-gray-400">
                                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                <span>已连接</span>
                            </div>
                        </div>
                    </div>
                </header>
            )}

            {/* 主要内容区域 */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative">
                    <LiveKitRoom
                        token={roomState.token}
                        serverUrl={roomState.serverUrl}
                        onConnected={handleRoomConnected}
                        onDisconnected={handleRoomDisconnected}
                        onError={handleRoomError}
                        connect={true}
                        audio={true}
                        video={true}
                        screen={true}
                        data-lk-theme="default"
                        options={{
                            adaptiveStream: true,
                            reconnectPolicy: {
                                nextRetryDelayInMs: (context) => {
                                    console.log('重连策略:', context);
                                    return Math.min(1000 * Math.pow(2, context.retryCount), 10000);
                                }
                            }
                        }}
                    >
                        <RoomInnerContent
                            roomName={roomName}
                            username={username}
                            uiState={uiState}
                            toggleUIPanel={toggleUIPanel}
                            toggleFullscreen={toggleFullscreen}
                            leaveRoom={leaveRoom}
                            addNotification={addNotification}
                            setChatWidth={setChatWidth}
                        />
                    </LiveKitRoom>
                </div>
            </div>

            {/* 通知中心 */}
            <NotificationCenter
                notifications={notifications}
                onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
            />
        </div>
    );
}

// 主组件 - 使用 Suspense 包装
export default function RoomPage(props: RoomPageProps) {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <PageLoadingSpinner text="正在加载房间..." />
            </div>
        }>
            <RoomPageContent />
        </Suspense>
    );
}