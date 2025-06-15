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
    useParticipants,
    GridLayout,
    ParticipantTile
} from '@livekit/components-react';
import { Room, DisconnectReason, ConnectionQuality, Track } from 'livekit-client';

// Components
import { LoadingSpinner, PageLoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorDisplay } from '../components/ui/ErrorDisplay';
import { ImagePreview } from '../components/ui/ImagePreview';
import { NotificationCenter } from '../components/ui/NotificationCenter';
import { Button } from '../components/ui/Button';
import { ControlBar as CustomControlBar } from '../components/room/ControlBar';
import { Sidebar } from '../components/room/Sidebar';
import FloatingChat from '../components/room/FloatingChat';

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
    showSettings: boolean;
    isFullscreen: boolean;
    sidebarCollapsed: boolean;
}

interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
}

// 自定义视频网格组件 - 隐藏默认控件
function CustomVideoGrid() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    return (
        <div className="relative w-full h-full bg-black">
            <GridLayout tracks={tracks} style={{ height: '100%' }}>
                <ParticipantTile />
            </GridLayout>
            <RoomAudioRenderer />
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
    switchRoom,
    addNotification
}: {
    roomName: string;
    username: string;
    uiState: UIState;
    toggleUIPanel: (panel: keyof UIState) => void;
    toggleFullscreen: () => void;
    leaveRoom: () => void;
    switchRoom: (newRoomName: string) => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
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

    // 默认设备状态设置
    useEffect(() => {
        if (!room || !room.localParticipant) return;

        const setupDefaultDeviceStates = async () => {
            try {
                // 默认开启麦克风
                await room.localParticipant.setMicrophoneEnabled(true);
                // 默认关闭摄像头
                await room.localParticipant.setCameraEnabled(false);
                // 默认关闭屏幕共享
                await room.localParticipant.setScreenShareEnabled(false);
                
                console.log('设备默认状态已设置: 麦克风开启, 摄像头关闭, 屏幕共享关闭');
            } catch (error) {
                console.error('设置默认设备状态失败:', error);
            }
        };

        // 延迟设置，确保房间完全连接
        const timer = setTimeout(setupDefaultDeviceStates, 1000);
        return () => clearTimeout(timer);
    }, [room]);

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

    return (
        <div className="flex h-full">
            {/* 左侧边栏 */}
            <div className={`transition-all duration-300 ${uiState.sidebarCollapsed ? 'w-0' : 'w-80'} flex-shrink-0`}>
                {!uiState.sidebarCollapsed && (
                    <Sidebar
                        currentRoomName={roomName}
                        onRoomSwitch={switchRoom}
                        className="h-full"
                    />
                )}
            </div>

            {/* 主视频区域 */}
            <div className="relative bg-black flex-1 h-full">
                <CustomVideoGrid />
                
                {/* 自定义控制栏 - 包含聊天按钮 */}
                <CustomControlBar
                    onToggleChat={() => toggleUIPanel('showChat')}
                    onToggleParticipants={() => toggleUIPanel('sidebarCollapsed')}
                    onToggleSettings={() => toggleUIPanel('showSettings')}
                    onToggleFullscreen={toggleFullscreen}
                    onLeaveRoom={leaveRoom}
                    isFullscreen={uiState.isFullscreen}
                    chatUnreadCount={chatState.unreadCount}
                    showChat={uiState.showChat}
                />
            </div>

            {/* 聊天面板 */}
            {uiState.showChat && (
                <FloatingChat 
                    setPreviewImage={(src) => src && openPreview(src)}
                    onClose={() => toggleUIPanel('showChat')}
                    chatState={chatState}
                    onSendMessage={sendTextMessage}
                    onSendImage={sendImageMessage}
                    onClearMessages={clearMessages}
                    onRetryMessage={retryMessage}
                    onDeleteMessage={deleteMessage}
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
    
    // 从 URL 参数获取房间信息
    const roomName = searchParams.get('room') || 'default-room';
    const username = searchParams.get('username') || `user_${Date.now()}`;

    // 房间状态
    const [roomState, setRoomState] = useState<RoomState>({
        isConnecting: false,
        isConnected: false,
        error: null,
        token: null,
        serverUrl: null,
        connectionAttempts: 0
    });

    // UI 状态
    const [uiState, setUIState] = useState<UIState>({
        showChat: false,
        showSettings: false,
        isFullscreen: false,
        sidebarCollapsed: false
    });

    // 通知系统
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // 获取房间令牌
    const getToken = useCallback(async (room: string, user: string) => {
        try {
            setRoomState(prev => ({ 
                ...prev, 
                isConnecting: true, 
                error: null,
                connectionAttempts: prev.connectionAttempts + 1
            }));

            const response = await fetch('/api/get-participant-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ room, username: user }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.token || !data.serverUrl) {
                throw new Error('Invalid response from server');
            }

            setRoomState(prev => ({
                ...prev,
                token: data.token,
                serverUrl: data.serverUrl,
                isConnecting: false,
                error: null
            }));

            return data;
        } catch (error) {
            console.error('获取令牌失败:', error);
            setRoomState(prev => ({
                ...prev,
                isConnecting: false,
                error: error instanceof Error ? error.message : '获取房间令牌失败'
            }));
            throw error;
        }
    }, []);

    // 初始化房间连接
    useEffect(() => {
        if (roomName && username) {
            getToken(roomName, username).catch(console.error);
        }
    }, [roomName, username, getToken]);

    // 切换 UI 面板
    const toggleUIPanel = useCallback((panel: keyof UIState) => {
        setUIState(prev => ({
            ...prev,
            [panel]: !prev[panel]
        }));
    }, []);

    // 切换全屏
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                setUIState(prev => ({ ...prev, isFullscreen: true }));
            });
        } else {
            document.exitFullscreen().then(() => {
                setUIState(prev => ({ ...prev, isFullscreen: false }));
            });
        }
    }, []);

    // 离开房间
    const leaveRoom = useCallback(() => {
        router.push('/');
    }, [router]);

    // 切换房间
    const switchRoom = useCallback(async (newRoomName: string) => {
        if (newRoomName === roomName) return;
        
        try {
            const newUrl = `/room?room=${encodeURIComponent(newRoomName)}&username=${encodeURIComponent(username)}`;
            router.push(newUrl);
        } catch (error) {
            console.error('切换房间失败:', error);
            addNotification({
                type: 'error',
                title: '切换房间失败',
                message: error instanceof Error ? error.message : '未知错误'
            });
        }
    }, [roomName, username, router]);

    // 添加通知
    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const newNotification: Notification = {
            ...notification,
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date()
        };

        setNotifications(prev => [...prev, newNotification]);

        // 自动移除通知
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
        }, 5000);
    }, []);

    // 手动移除通知
    const dismissNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // 房间事件处理
    const handleRoomConnected = useCallback(() => {
        console.log('房间连接成功');
        setRoomState(prev => ({ ...prev, isConnected: true }));
        addNotification({
            type: 'success',
            title: '连接成功',
            message: `已连接到房间 ${roomName}`
        });
    }, [roomName, addNotification]);

    const handleRoomDisconnected = useCallback((reason?: DisconnectReason) => {
        console.log('房间连接断开:', reason);
        setRoomState(prev => ({ ...prev, isConnected: false }));
        
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
            addNotification({
                type: 'warning',
                title: '被移出房间',
                message: '您已被管理员移出房间'
            });
            router.push('/');
        } else if (reason === DisconnectReason.ROOM_DELETED) {
            addNotification({
                type: 'warning',
                title: '房间已关闭',
                message: '房间已被删除'
            });
            router.push('/');
        }
    }, [addNotification, router]);

    const handleRoomError = useCallback((error: Error) => {
        console.error('房间错误:', error);
        setRoomState(prev => ({ ...prev, error: error.message }));
        addNotification({
            type: 'error',
            title: '房间错误',
            message: error.message
        });
    }, [addNotification]);

    // 重试连接
    const retryConnection = useCallback(() => {
        if (roomName && username) {
            getToken(roomName, username).catch(console.error);
        }
    }, [roomName, username, getToken]);

    // 显示加载状态
    if (roomState.isConnecting) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="mt-4 text-white">
                        正在连接房间 {roomName}...
                        {roomState.connectionAttempts > 1 && (
                            <span className="block text-sm text-gray-400 mt-1">
                                尝试次数: {roomState.connectionAttempts}
                            </span>
                        )}
                    </p>
                </div>
            </div>
        );
    }

    // 显示错误状态
    if (roomState.error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <ErrorDisplay
                    title="连接失败"
                    message={roomState.error}
                    onRetry={retryConnection}
                />
            </div>
        );
    }

    // 等待令牌
    if (!roomState.token || !roomState.serverUrl) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <LoadingSpinner size="lg" />
                    <p className="mt-4 text-white">正在准备房间...</p>
                </div>
            </div>
        );
    }

    // 主要房间界面
    return (
        <div className={`h-screen bg-gray-900 flex flex-col overflow-hidden ${uiState.isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
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
                        audio={true} // 默认开启麦克风
                        video={false} // 默认关闭摄像头
                        screen={false} // 默认关闭屏幕共享
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
                        style={{
                            // 隐藏默认控件
                            '--lk-bg-control-bar': 'transparent',
                            '--lk-control-bar-height': '0px'
                        } as React.CSSProperties}
                    >
                        <RoomInnerContent
                            roomName={roomName}
                            username={username}
                            uiState={uiState}
                            toggleUIPanel={toggleUIPanel}
                            toggleFullscreen={toggleFullscreen}
                            leaveRoom={leaveRoom}
                            switchRoom={switchRoom}
                            addNotification={addNotification}
                        />
                    </LiveKitRoom>
                </div>
            </div>

            {/* 通知中心 */}
            <NotificationCenter
                notifications={notifications}
                onDismiss={dismissNotification}
            />
        </div>
    );
}

export default function RoomPage() {
    return (
        <Suspense fallback={<PageLoadingSpinner />}>
            <RoomPageContent />
        </Suspense>
    );
}