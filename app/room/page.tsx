'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LiveKitRoom, VideoConference, formatChatMessageLinks, useRoomContext } from '@livekit/components-react';
import { Room, DisconnectReason } from 'livekit-client';

// Components
import { LoadingSpinner, PageLoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorDisplay } from '../components/ui/ErrorDisplay';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantList } from '../components/room/ParticipantList';
import { ControlBar } from '../components/room/ControlBar';
import { SettingsPanel } from '../components/room/SettingsPanel';
import { ImagePreview } from '../components/ui/ImagePreview';
import { ConnectionStatus } from '../components/room/ConnectionStatus';
import { NotificationCenter } from '../components/ui/NotificationCenter';

// Hooks
import { useRoom } from '../hooks/useRoom';
import { useChat } from '../hooks/useChat';
import { useAudioManager } from '../hooks/useAudioManager';
import { useImagePreview } from '../hooks/useImagePreview';

// Types
import { RoomConnectionParams } from '../types/room';
import { SoundEvent } from '../types/audio';

// Utils
import { generateAccessToken } from '../utils/tokenUtils';

// Styles
import '@livekit/components-styles';

interface RoomPageProps {}

interface RoomState {
    isConnecting: boolean;
    isConnected: boolean;
    error: string | null;
    token: string | null;
    serverUrl: string | null;
}

interface UIState {
    showChat: boolean;
    showParticipants: boolean;
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

// 房间内部组件 - 可以访问 LiveKit Room Context
function RoomInnerContent({ 
    roomName, 
    username, 
    uiState, 
    toggleUIPanel, 
    toggleFullscreen, 
    leaveRoom, 
    addNotification 
}: {
    roomName: string;
    username: string;
    uiState: UIState;
    toggleUIPanel: (panel: keyof UIState) => void;
    toggleFullscreen: () => void;
    leaveRoom: () => void;
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
}) {
    // 这些 hooks 现在在 LiveKitRoom 内部，可以正常访问 room context
    const { 
        previewState, 
        openPreview, 
        closePreview 
    } = useImagePreview();
    
    const {
        chatState,
        sendTextMessage,
        sendImageMessage,
        toggleChat,
        clearUnreadCount,
        clearMessages,
        retryMessage,
        deleteMessage
    } = useChat({
        maxMessages: 200,
        enableSounds: true,
        autoScrollToBottom: true
    });

    // 房间事件处理（现在在正确的上下文中）
    const room = useRoomContext();

    useEffect(() => {
        if (!room) return;

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

        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);

        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
        };
    }, [room, addNotification]);

    return (
        <>
            <VideoConference 
                chatMessageFormatter={formatChatMessageLinks}
            />
            
            {/* 自定义控制栏 */}
            <ControlBar
                onToggleChat={() => toggleUIPanel('showChat')}
                onToggleParticipants={() => toggleUIPanel('showParticipants')}
                onToggleSettings={() => toggleUIPanel('showSettings')}
                onToggleFullscreen={toggleFullscreen}
                onLeaveRoom={leaveRoom}
                isFullscreen={uiState.isFullscreen}
                chatUnreadCount={chatState.unreadCount}
            />

            {/* 右侧聊天面板 */}
            {uiState.showChat && (
                <div className="absolute top-0 right-0 h-full w-80 bg-gray-800 border-l border-gray-700 z-10">
                    <ChatPanel
                        chatState={chatState}
                        onSendMessage={sendTextMessage}
                        onSendImage={sendImageMessage}
                        onToggleChat={() => toggleUIPanel('showChat')}
                        onClearMessages={clearMessages}
                        onRetryMessage={retryMessage}
                        onDeleteMessage={deleteMessage}
                        onImageClick={openPreview}
                        onClose={() => {
                            toggleUIPanel('showChat');
                            clearUnreadCount();
                        }}
                    />
                </div>
            )}

            {/* 图片预览 */}
            {previewState.isOpen && (
                <ImagePreview
                    src={previewState.src}
                    onClose={closePreview}
                />
            )}
        </>
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
        serverUrl: null
    });

    const [uiState, setUIState] = useState<UIState>({
        showChat: true,
        showParticipants: false,
        showSettings: false,
        isFullscreen: false,
        sidebarCollapsed: false
    });

    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Refs
    const roomRef = useRef<Room | null>(null);
    const isMountedRef = useRef(true);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Hooks（在 LiveKitRoom 外部的 hooks）
    const { playSound } = useAudioManager({ autoInitialize: true });

    // 验证必需参数
    const validateParams = useCallback(() => {
        if (!roomName || !username) {
            return '缺少必需的房间参数';
        }
        
        if (roomName.length < 3 || roomName.length > 50) {
            return '房间名称长度必须在3-50个字符之间';
        }
        
        if (username.length < 2 || username.length > 30) {
            return '用户名长度必须在2-30个字符之间';
        }
        
        return null;
    }, [roomName, username]);

    // 检查房间是否存在
    const checkRoomExists = useCallback(async (roomName: string): Promise<boolean> => {
        try {
            const response = await fetch('https://livekit-api.2k2.cc/api/rooms', {
                method: 'GET'
            });

            if (!response.ok) {
                console.warn('无法获取房间列表，假设房间存在');
                return true; // 如果无法获取列表，假设房间存在
            }

            const data = await response.json();
            const rooms = data.rooms || [];
            
            // 检查房间是否在列表中
            return rooms.some((room: any) => room.name === roomName);
        } catch (error) {
            console.warn('检查房间存在性失败:', error);
            return true; // 出错时假设房间存在
        }
    }, []);

    // 创建或加入房间
    const createOrJoinRoom = useCallback(async (): Promise<string> => {
        try {
            const response = await fetch('/api/room', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    room: roomName,
                    identity: username, // 使用 identity 而不是 username
                    name: username,     // 显示名称
                    metadata: JSON.stringify({
                        displayName: username,
                        joinedAt: new Date().toISOString()
                    })
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `生成访问令牌失败: HTTP ${response.status}`);
            }

            const tokenData = await response.json();
            return tokenData.token;

        } catch (error) {
            console.error('创建房间或生成令牌失败:', error);
            throw error instanceof Error ? error : new Error('创建房间或生成令牌失败');
        }
    }, [roomName, username]);

    // 获取访问令牌（修改为使用正确的 API）
    const getAccessToken = useCallback(async (): Promise<string> => {
        try {
            return await createOrJoinRoom();
        } catch (error) {
            console.error('获取访问令牌失败:', error);
            throw error instanceof Error ? error : new Error('获取访问令牌失败');
        }
    }, [createOrJoinRoom]);

    // 获取房间信息
    const getRoomInfo = useCallback(async (roomName: string) => {
        try {
            const response = await fetch(`https://livekit-api.2k2.cc/api/room?room=${encodeURIComponent(roomName)}`, {
                method: 'GET'
            });

            if (!response.ok) {
                // 房间不存在或其他错误
                return null;
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.warn('获取房间信息失败:', error);
            return null;
        }
    }, []);

    // 获取房间参与者
    const getRoomParticipants = useCallback(async (roomName: string) => {
        try {
            const response = await fetch(`https://livekit-api.2k2.cc/api/room/participants?room=${encodeURIComponent(roomName)}`, {
                method: 'GET'
            });

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.participants || [];
        } catch (error) {
            console.warn('获取房间参与者失败:', error);
            return [];
        }
    }, []);

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
            error: null 
        }));

        try {
            // 获取服务器URL
            const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
            if (!serverUrl) {
                throw new Error('LiveKit 服务器URL未配置');
            }

            // 获取访问令牌（这会自动创建房间如果不存在）
            const token = await getAccessToken();

            if (isMountedRef.current) {
                setRoomState(prev => ({
                    ...prev,
                    token,
                    serverUrl,
                    isConnecting: false,
                    isConnected: true
                }));

                // 播放连接成功音效
                playSound('call-start');

                // 添加成功通知
                addNotification({
                    type: 'success',
                    title: '连接成功',
                    message: `已成功加入房间 "${roomName}"`
                });

                // 可选：获取房间信息和参与者列表
                try {
                    if (roomName) {
                        const roomInfo = await getRoomInfo(roomName);
                        const participants = await getRoomParticipants(roomName);
                        
                        console.log('房间信息:', roomInfo);
                        console.log('当前参与者:', participants);
                    }
                } catch (infoError) {
                    console.warn('获取房间详细信息失败:', infoError);
                }
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

                // 播放错误音效
                playSound('error');

                // 添加错误通知
                addNotification({
                    type: 'error',
                    title: '连接失败',
                    message: errorMessage
                });
            }
        }
    }, [validateParams, getAccessToken, roomName, playSound, getRoomInfo, getRoomParticipants]);

    // 添加通知
    const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
        const newNotification = {
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

    // 房间事件处理
    const handleRoomConnected = useCallback(() => {
        console.log('房间连接成功');
        
        playSound('call-start');
        addNotification({
            type: 'success',
            title: '房间连接成功',
            message: `欢迎加入 "${roomName}"`
        });
    }, [playSound, addNotification, roomName]);

    const handleRoomDisconnected = useCallback((reason?: DisconnectReason) => {
        console.log('房间断开连接:', reason);
        roomRef.current = null;
        
        if (reason !== DisconnectReason.CLIENT_INITIATED) {
            playSound('connection-lost');
            addNotification({
                type: 'warning',
                title: '连接断开',
                message: '正在尝试重新连接...'
            });
            
            // 尝试重连
            reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    initializeRoom();
                }
            }, 3000);
        } else {
            playSound('call-end');
        }
    }, [playSound, addNotification, initializeRoom]);

    const handleRoomError = useCallback((error: Error) => {
        console.error('房间错误:', error);
        
        playSound('error');
        addNotification({
            type: 'error',
            title: '房间错误',
            message: error.message
        });
    }, [playSound, addNotification]);

    // UI 控制函数
    const toggleUIPanel = useCallback((panel: keyof UIState) => {
        setUIState(prev => ({ ...prev, [panel]: !prev[panel] }));
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
            if (roomRef.current) {
                await roomRef.current.disconnect();
            }
            
            // 清理定时器
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            
            // 返回首页
            router.push('/');
        } catch (error) {
            console.error('离开房间失败:', error);
            // 强制返回首页
            router.push('/');
        }
    }, [router]);

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 全屏切换
            if (e.key === 'F11') {
                e.preventDefault();
                toggleFullscreen();
            }
            
            // 聊天切换
            if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showChat');
            }
            
            // 参与者列表切换
            if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showParticipants');
            }
            
            // 设置面板切换
            if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                toggleUIPanel('showSettings');
            }
            
            // 离开房间
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
                e.preventDefault();
                e.returnValue = '确定要离开房间吗？';
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
                        onRetry={initializeRoom}
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
                            <ConnectionStatus />
                            
                            <button
                                onClick={() => toggleUIPanel('showParticipants')}
                                className={`p-2 rounded-lg transition-colors ${
                                    uiState.showParticipants 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                                title="参与者列表"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                </svg>
                            </button>
                            
                            <button
                                onClick={() => toggleUIPanel('showSettings')}
                                className={`p-2 rounded-lg transition-colors ${
                                    uiState.showSettings 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                                title="设置"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* 主要内容区域 */}
            <div className="flex-1 flex overflow-hidden">
                {/* 左侧面板 */}
                {(uiState.showParticipants || uiState.showSettings) && (
                    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
                        {uiState.showParticipants && (
                            <ParticipantList
                                onClose={() => toggleUIPanel('showParticipants')}
                            />
                        )}
                        
                        {uiState.showSettings && (
                            <SettingsPanel
                                onClose={() => toggleUIPanel('showSettings')}
                            />
                        )}
                    </div>
                )}

                {/* 中央视频区域 */}
                <div className="flex-1 flex flex-col bg-black relative">
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
                    >
                        <RoomInnerContent
                            roomName={roomName}
                            username={username}
                            uiState={uiState}
                            toggleUIPanel={toggleUIPanel}
                            toggleFullscreen={toggleFullscreen}
                            leaveRoom={leaveRoom}
                            addNotification={addNotification}
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