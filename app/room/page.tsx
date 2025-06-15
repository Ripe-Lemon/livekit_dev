'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    LiveKitRoom, 
    VideoConference, 
    formatChatMessageLinks, 
    useRoomContext,
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
import { Button } from '../components/ui/Button';
import { ControlBar as CustomControlBar } from '../components/room/ControlBar';
import ConnectionStatus from '../components/room/ConnectionStatus';
import RoomInfo from '../components/room/RoomInfo';
import { ParticipantList } from '../components/room/ParticipantList';
import CustomVideoConference from '../components/room/VideoConference';
import FloatingChat from '../components/room/FloatingChat';
import { ChatPanel } from '../components/room/ChatPanel';

// Hooks
import { useImagePreview } from '../hooks/useImagePreview';
import { useAudioManager } from '../hooks/useAudioManager';
import { useChat } from '../hooks/useChat';

// Types
import { DisplayMessage, ChatState } from '../types/chat';

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
    showFloatingChat: boolean;
}

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
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
    
    // 在 LiveKit Room 内部使用聊天 Hook
    const { 
        chatState, 
        sendTextMessage, 
        sendImageMessage, 
        clearMessages, 
        retryMessage, 
        deleteMessage 
    } = useChat({
        maxMessages: 100,
        enableSounds: true,
        autoScrollToBottom: true
    });

    // 音频管理
    const { playSound } = useAudioManager({
        autoInitialize: true,
        globalVolume: 0.7,
        enabled: true
    });

    // 图片预览
    const { 
        previewState, 
        openPreview, 
        closePreview 
    } = useImagePreview();

    // 包装 openPreview 以处理 null 值
    const handlePreviewImage = useCallback((src: string | null) => {
        if (src) {
            openPreview(src);
        }
    }, [openPreview]);

    useEffect(() => {
        if (!room) return;

        console.log('房间连接成功，房间信息:', {
            name: room.name,
            participants: participants.length,
            localParticipant: room.localParticipant?.identity
        });

        const handleParticipantConnected = (participant: any) => {
            console.log('参与者加入:', participant.identity);
            playSound('user-join');
            addNotification({
                type: 'info',
                title: '用户加入',
                message: `${participant.identity} 加入了房间`
            });
        };

        const handleParticipantDisconnected = (participant: any) => {
            console.log('参与者离开:', participant.identity);
            playSound('user-leave');
            addNotification({
                type: 'info',
                title: '用户离开',
                message: `${participant.identity} 离开了房间`
            });
        };

        const handleConnectionQualityChanged = (quality: ConnectionQuality, participant: any) => {
            console.log('连接质量变化:', quality, participant.identity);
        };

        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);
        room.on('connectionQualityChanged', handleConnectionQualityChanged);

        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
            room.off('connectionQualityChanged', handleConnectionQualityChanged);
        };
    }, [room, participants.length, addNotification, playSound]);

    // 计算视频区域宽度（考虑聊天栏）
    const videoAreaStyle = {
        width: uiState.showChat ? `calc(100% - ${uiState.chatWidth}px)` : '100%'
    };

    return (
        <div className="relative w-full h-full flex">
            {/* 主视频区域 */}
            <div className="relative bg-black" style={videoAreaStyle}>
                {/* 使用 LiveKit 默认的 VideoConference 组件 */}
                <VideoConference 
                    chatMessageFormatter={formatChatMessageLinks}
                />
                
                {/* 自定义控制栏 */}
                <CustomControlBar
                    onToggleChat={() => toggleUIPanel('showChat')}
                    onToggleParticipants={() => toggleUIPanel('showParticipants')}
                    onToggleSettings={() => toggleUIPanel('showSettings')}
                    onToggleFullscreen={toggleFullscreen}
                    onLeaveRoom={leaveRoom}
                    isFullscreen={uiState.isFullscreen}
                    chatUnreadCount={chatState.unreadCount}
                />
            </div>

            {/* 侧边聊天面板 */}
            {uiState.showChat && (
                <div 
                    className="h-full bg-gray-800 border-l border-gray-700 z-10 flex-shrink-0"
                    style={{ width: `${uiState.chatWidth}px` }}
                >
                    <ChatPanel
                        chatState={chatState}
                        onSendMessage={sendTextMessage}
                        onSendImage={sendImageMessage}
                        onToggleChat={() => toggleUIPanel('showChat')}
                        onClearMessages={clearMessages}
                        onRetryMessage={retryMessage}
                        onDeleteMessage={deleteMessage}
                        onImageClick={openPreview}
                        onClose={() => toggleUIPanel('showChat')}
                        className="h-full"
                    />
                </div>
            )}

            {/* 参与者面板 */}
            {uiState.showParticipants && (
                <div className="absolute top-0 left-0 h-full w-80 bg-gray-800 border-r border-gray-700 z-10">
                    <ParticipantList
                        onClose={() => toggleUIPanel('showParticipants')}
                        className="h-full"
                    />
                </div>
            )}

            {/* 设置面板 */}
            {uiState.showSettings && (
                <div className="absolute top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-10">
                    <div className="p-4 h-full overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">设置</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleUIPanel('showSettings')}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>
                        
                        <div className="space-y-6">
                            {/* 聊天设置 */}
                            <div>
                                <h4 className="font-medium text-white mb-3">聊天设置</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            聊天栏宽度: {uiState.chatWidth}px
                                        </label>
                                        <input
                                            type="range"
                                            min="280"
                                            max="500"
                                            value={uiState.chatWidth}
                                            onChange={(e) => setChatWidth(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-300">悬浮聊天窗口</span>
                                        <Button
                                            variant={uiState.showFloatingChat ? "primary" : "outline"}
                                            size="sm"
                                            onClick={() => toggleUIPanel('showFloatingChat')}
                                        >
                                            {uiState.showFloatingChat ? '已启用' : '已禁用'}
                                        </Button>
                                    </div>
                                    
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={clearMessages}
                                        className="w-full"
                                    >
                                        清除聊天记录
                                    </Button>
                                </div>
                            </div>

                            {/* 连接状态 */}
                            <div>
                                <h4 className="font-medium text-white mb-3">连接状态</h4>
                                <ConnectionStatus 
                                    showDetails={true}
                                    className="bg-gray-700 rounded-lg"
                                />
                            </div>

                            {/* 房间信息 */}
                            <div>
                                <h4 className="font-medium text-white mb-3">房间信息</h4>
                                <RoomInfo 
                                    className="bg-gray-700 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 悬浮聊天窗口 */}
            {uiState.showFloatingChat && (
                <FloatingChat 
                    setPreviewImage={handlePreviewImage}
                    position="top-right"
                    size="medium"
                />
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
        chatWidth: 350,
        showFloatingChat: true
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
            
            if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showFloatingChat');
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
                <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push('/')}
                                className="text-gray-400 hover:text-white"
                                icon={
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                }
                            >
                                返回
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold text-white">{roomName}</h1>
                                <p className="text-sm text-gray-400">用户: {username}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            {/* 快捷操作按钮 */}
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant={uiState.showFloatingChat ? "primary" : "ghost"}
                                    size="sm"
                                    onClick={() => toggleUIPanel('showFloatingChat')}
                                    title="悬浮聊天"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </Button>
                                
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleFullscreen}
                                    title="全屏模式"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </Button>
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
                position="top-right"
                maxNotifications={5}
            />

            {/* 快捷键提示（开发环境） */}
            {process.env.NODE_ENV === 'development' && !uiState.isFullscreen && (
                <div className="fixed bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs z-40">
                    <div className="space-y-1">
                        <div>快捷键:</div>
                        <div>Ctrl+C - 聊天 | Ctrl+P - 参与者 | Ctrl+S - 设置</div>
                        <div>Ctrl+F - 悬浮聊天 | F11 - 全屏 | Ctrl+Esc - 离开</div>
                    </div>
                </div>
            )}
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