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

import { AudioManager } from '../lib/audio/AudioManager';

// Components
import { LoadingSpinner, PageLoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorDisplay } from '../components/ui/ErrorDisplay';
import { ImagePreview } from '../components/ui/ImagePreview';
import { NotificationCenter } from '../components/ui/NotificationCenter';
import { Button } from '../components/ui/Button';
import { ControlBar } from '../components/room/ControlBar';
import ConnectionStatus from '../components/room/ConnectionStatus';
import RoomInfo from '../components/room/RoomInfo';
import { ParticipantList } from '../components/room/ParticipantList';
import FloatingChat from '../components/room/FloatingChat';
import { Sidebar } from '../components/room/Sidebar';
import { SettingsPanel } from '../components/room/SettingsPanel'; // 添加新的设置面板导入

// Hooks
import { useImagePreview } from '../hooks/useImagePreview';
import { useAudioManager, useAudioTesting, SoundEvent } from '../hooks/useAudioManager';
import { useAudioNotifications } from '../hooks/useAudioNotifications';
import { useChat } from '../hooks/useChat';
import { useAudioProcessing } from '../hooks/useAudioProcessing';

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
    
    // 🎯 关键：在房间组件中启用音频处理，让其常驻
    const { 
        settings: audioSettings, 
        isProcessingActive, 
        isInitialized: audioInitialized 
    } = useAudioProcessing();
    
    // 添加音频通知 Hook
    useAudioNotifications(room, {
        enableUserJoinLeave: true,       // 保留用户加入/离开音效
        enableMessageNotification: true, // 保留消息通知音效
        enableMediaControls: false,      // 禁用自动媒体控制音效（避免重复）
        enableScreenShare: false,        // 禁用自动屏幕共享音效（避免重复）
        enableConnection: true,          // 保留连接状态音效
        messageVolume: 0.6,
        controlVolume: 0.7
    },{ isOpen: uiState.showChat });

    // 在 RoomInnerContent 组件中修改 useChat 的调用
    const { 
        chatState, 
        sendTextMessage, 
        sendImageMessage, 
        clearMessages, 
        retryMessage, 
        deleteMessage,
        markAsRead
    } = useChat({
        maxMessages: 100,
        enableSounds: false, // 关闭 useChat 内置音效，使用 useAudioNotifications
        autoScrollToBottom: true,
        isChatOpen: uiState.showChat // 传递聊天栏状态给 useChat
    });

    // 修改聊天切换处理函数
    const handleToggleChat = useCallback(() => {
        // 如果聊天栏即将打开，立即清除未读计数
        if (!uiState.showChat) {
            markAsRead();
        }
        toggleUIPanel('showChat');
    }, [uiState.showChat, toggleUIPanel, markAsRead]);

    // 音频管理
    const { playSound } = useAudioManager({
        autoInitialize: false,
        globalVolume: 0.7,
        enabled: true
    });

    // 图片预览
    const { 
        previewState, 
        openPreview, 
        closePreview 
    } = useImagePreview();

    // 修复图片预览回调类型
    const handleImagePreview = useCallback((src: string | null) => {
        if (src) {
            openPreview(src);
        }
    }, [openPreview]);

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
        if (process.env.NODE_ENV === 'development') {
            // 添加全局测试函数
            (window as any).roomAudioDebug = {
                playSound: (name: string) => playSound(name as SoundEvent)
            };
            
            console.log('🎵 音频调试功能已启用:');
            console.log('  audioDebug.playSound("user-join") - 播放音效');
        }
    }, [playSound]);

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
        <div className="relative w-full h-full flex">
            {/* 左侧边栏 - 移动端改为抽屉式 */}
            <div className={`
                transition-all duration-300 
                ${uiState.sidebarCollapsed ? 'w-0' : 'w-80 lg:w-80 md:w-64 sm:w-full'} 
                flex-shrink-0
                ${!uiState.sidebarCollapsed ? 'absolute lg:relative z-20 h-full' : ''}
            `}>
                {!uiState.sidebarCollapsed && (
                    <>
                        {/* 移动端遮罩层 */}
                        <div 
                            className="fixed inset-0 bg-black/50 lg:hidden z-10"
                            onClick={() => toggleUIPanel('sidebarCollapsed')}
                        />
                        <Sidebar
                            currentRoomName={roomName}
                            onRoomSwitch={switchRoom}
                            username={username}
                            className="h-full relative z-20"
                        />
                    </>
                )}
            </div>

            {/* 主视频区域 */}
            <div className="relative bg-black w-full h-full">
                <CustomVideoGrid />
                
                {/* 自定义控制栏 */}
                <ControlBar
                    onToggleChat={handleToggleChat}
                    onToggleParticipants={() => toggleUIPanel('sidebarCollapsed')}
                    onToggleSettings={() => toggleUIPanel('showSettings')}
                    onToggleFullscreen={toggleFullscreen}
                    onLeaveRoom={leaveRoom}
                    isFullscreen={uiState.isFullscreen}
                    chatUnreadCount={chatState.unreadCount}
                    showChat={uiState.showChat}
                    className="bottom-4 left-1/2 transform -translate-x-1/2"
                />
            </div>

            {/* 参与者面板 - 移动端全屏 */}
            {uiState.showParticipants && (
                <div className={`
                    absolute top-0 left-0 h-full z-30
                    w-80 lg:w-80 md:w-64 sm:w-full
                    bg-gray-800 border-r border-gray-700
                `}>
                    {/* 移动端背景遮罩 */}
                    <div 
                        className="fixed inset-0 bg-black/50 lg:hidden z-10"
                        onClick={() => toggleUIPanel('showParticipants')}
                    />
                    <ParticipantList
                        onClose={() => toggleUIPanel('showParticipants')}
                        className="h-full relative z-20"
                    />
                </div>
            )}

            {/* 设置面板 - 替换为新的悬浮窗口版本 */}
            {uiState.showSettings && (
                <SettingsPanel
                    onClose={() => toggleUIPanel('showSettings')}
                />
            )}

            {/* 悬浮聊天窗口 - 移动端全屏 */}
            {uiState.showChat && (
                <div className={`
                    fixed top-0 right-0 h-full z-40
                    w-80 lg:w-80 md:w-64 sm:w-full
                `}>
                    {/* 移动端背景遮罩 */}
                    <div 
                        className="fixed inset-0 bg-black/50 lg:hidden z-10"
                        onClick={() => toggleUIPanel('showChat')}
                    />
                    <FloatingChat 
                        setPreviewImage={(src) => src && openPreview(src)}
                        onClose={handleToggleChat}
                        chatState={chatState}
                        onSendMessage={sendTextMessage}
                        onSendImage={sendImageMessage}
                        onClearMessages={clearMessages}
                        onRetryMessage={retryMessage}
                        onDeleteMessage={deleteMessage}
                        onMarkAsRead={markAsRead}
                        className="relative z-20"
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

    // 添加音频管理器 Hook - 在状态管理之前添加
    const { 
        playSound, 
        isInitialized: audioInitialized,
        getDebugInfo,
        testAllSounds,
        initialize: initializeAudio
    } = useAudioManager({
        autoInitialize: true,
        globalVolume: 0.7,
        enabled: true
    });

    // 开发环境下的音频测试
    const { runFullTest } = useAudioTesting();

    // 启用全局错误音效
    useErrorAudio(true);

    // 手动确保音频初始化
    useEffect(() => {
        const ensureAudioInit = async () => {
            if (!audioInitialized) {
                try {
                    console.log('手动初始化音频管理器...');
                    await initializeAudio();
                } catch (error) {
                    console.error('手动初始化音频失败:', error);
                }
            }
        };

        // 延迟一点执行，确保页面完全加载
        const timer = setTimeout(ensureAudioInit, 1000);
        return () => clearTimeout(timer);
    }, [audioInitialized, initializeAudio]);

    // 用户交互时尝试初始化音频（现代浏览器需要用户交互）
    useEffect(() => {
        const handleUserInteraction = async () => {
            if (!audioInitialized) {
                try {
                    console.log('用户交互触发音频初始化...');
                    await initializeAudio();
                } catch (error) {
                    console.error('用户交互音频初始化失败:', error);
                }
            }
        };

        // 监听用户交互事件
        document.addEventListener('click', handleUserInteraction, { once: true });
        document.addEventListener('keydown', handleUserInteraction, { once: true });
        document.addEventListener('touchstart', handleUserInteraction, { once: true });

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            document.removeEventListener('touchstart', handleUserInteraction);
        };
    }, [audioInitialized, initializeAudio]);

    // 状态管理 - 修复UIState初始化
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
        sidebarCollapsed: false
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

    // 添加调试功能
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            (window as any).audioDebug = {
                testAll: testAllSounds,
                playTest: (name: string) => {
                    console.log(`尝试播放音效: ${name}, 初始化状态: ${audioInitialized}`);
                    if (audioInitialized) {
                        playSound(name as SoundEvent, { volume: 0.5 });
                    } else {
                        console.warn('音频管理器未初始化，尝试手动初始化...');
                        initializeAudio().then(() => {
                            console.log('初始化完成，重试播放音效...');
                            playSound(name as SoundEvent, { volume: 0.5 });
                        }).catch(error => {
                            console.error('初始化失败:', error);
                        });
                    }
                },
                getDebug: getDebugInfo,
                initialized: audioInitialized,
                forceInit: initializeAudio
            };
            
            console.log('🎵 音频调试功能已启用:');
            console.log('  audioDebug.testAll() - 测试所有音频文件');
            console.log('  audioDebug.playTest("user-join") - 播放测试');
            console.log('  audioDebug.getDebug() - 获取调试信息');
            console.log('  audioDebug.initialized - 查看初始化状态');
            console.log('  audioDebug.forceInit() - 强制初始化');
        }
    }, [testAllSounds, playSound, getDebugInfo, audioInitialized, initializeAudio]);

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

    const switchRoom = useCallback(async (newRoomName: string) => {
    if (newRoomName === roomName) return;
    
    try {
        if (!username) {
            throw new Error('用户名不能为空');
        }
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
                                // 移除 maxRetryCount，因为它不在 ReconnectPolicy 类型中
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
                onDismiss={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                position="top-right"
                maxNotifications={5}
            />

            {/* 快捷键提示（开发环境） */}
            {process.env.NODE_ENV === 'development' && !uiState.isFullscreen && (
                <div className="fixed bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs z-40">
                    <div className="space-y-1">
                        <div>快捷键:</div>
                        <div>Ctrl+P - 参与者 | Ctrl+S - 设置</div>
                        <div>F11 - 全屏 | Ctrl+Esc - 离开</div>
                    </div>
                </div>
            )}
        </div>
    );
}

const audioManager = AudioManager.getInstance();

function useErrorAudio(enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;

        // 监听全局错误
        const handleError = (event: ErrorEvent) => {
            console.log('全局错误，播放错误音效');
            audioManager.playSound('error', { volume: 0.7 });
        };

        // 监听未处理的 Promise 拒绝
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            console.log('未处理的 Promise 拒绝，播放错误音效');
            audioManager.playSound('error', { volume: 0.7 });
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, [enabled]);
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