// 用 CustomControlBar 的内容替换当前的 ControlBar

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    useLocalParticipant, 
    useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useControlAudio } from '../../hooks/useControlAudio';

// 统一的 props 接口
interface ControlBarProps {
    onToggleChat?: () => void;
    onToggleParticipants?: () => void;
    onToggleSettings?: () => void;
    onToggleFullscreen?: () => void;
    onLeaveRoom?: () => void;
    isFullscreen?: boolean;
    chatUnreadCount?: number;
    showChat?: boolean;
    className?: string;
}

// 控制按钮组件（从 CustomControlBar 移过来）
function ControlButton({ 
    onClick, 
    isActive, 
    isLoading, 
    icon, 
    activeIcon, 
    title, 
    activeColor = 'bg-green-600',
    inactiveColor = 'bg-gray-700'
}: {
    onClick: () => void;
    isActive: boolean;
    isLoading?: boolean;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
    title: string;
    activeColor?: string;
    inactiveColor?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={`
                flex items-center justify-center w-12 h-12 rounded-full
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                text-white hover:scale-105
                ${isActive 
                    ? `${activeColor} hover:opacity-90` 
                    : `${inactiveColor} hover:bg-gray-600`
                }
            `}
            title={title}
        >
            {isLoading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
                isActive && activeIcon ? activeIcon : icon
            )}
        </button>
    );
}

// 离开房间按钮组件
function LeaveRoomButton({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
    const router = useRouter();
    const room = useRoomContext();
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeave = useCallback(async () => {
        if (isLeaving) return;

        const confirmed = window.confirm('确定要离开房间吗？');
        if (!confirmed) return;

        setIsLeaving(true);
        try {
            if (onLeaveRoom) {
                onLeaveRoom();
            } else {
                await room.disconnect();
                router.push('/');
            }
        } catch (error) {
            console.error('离开房间失败:', error);
            setIsLeaving(false);
        }
    }, [room, router, isLeaving, onLeaveRoom]);

    return (
        <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title="离开房间"
        >
            {isLeaving ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            )}
            <span className="hidden sm:inline">{isLeaving ? '离开中...' : '离开'}</span>
        </button>
    );
}

// 主控制栏组件
export function ControlBar({
    onToggleChat,
    onToggleParticipants,
    onToggleSettings,
    onToggleFullscreen,
    onLeaveRoom,
    isFullscreen = false,
    chatUnreadCount = 0,
    showChat = false,
    className = ''
}: ControlBarProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    // 状态管理
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingCamera, setIsTogglingCamera] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    // 音效控制
    const {
        playMuteSound,
        playUnmuteSound,
        playCameraOnSound,
        playCameraOffSound,
        playScreenShareStartSound,
        playScreenShareStopSound,
        playErrorSound
    } = useControlAudio({
        enabled: true,
        volume: 0.6
    });

    // 同步设备状态
    useEffect(() => {
        if (localParticipant) {
            setIsMuted(!localParticipant.isMicrophoneEnabled);
            setIsCameraOff(!localParticipant.isCameraEnabled);
            setIsScreenSharing(localParticipant.isScreenShareEnabled);
        }
    }, [localParticipant]);

    // 自动隐藏控制栏（全屏模式）
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const showControls = () => {
            setIsControlsVisible(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                setIsControlsVisible(false);
            }, 3000);
        };

        const handleMouseMove = () => showControls();

        if (isFullscreen) {
            document.addEventListener('mousemove', handleMouseMove);
            showControls();
        } else {
            setIsControlsVisible(true);
        }

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isFullscreen]);

    // 切换麦克风
    const toggleMicrophone = useCallback(async () => {
        if (!room || isTogglingMic) return;

        setIsTogglingMic(true);
        try {
            const currentlyMuted = !localParticipant.isMicrophoneEnabled;
            
            if (currentlyMuted) {
                await localParticipant.setMicrophoneEnabled(true);
                setIsMuted(false);
                playUnmuteSound();
                console.log('🔊 麦克风已开启');
            } else {
                await localParticipant.setMicrophoneEnabled(false);
                setIsMuted(true);
                playMuteSound();
                console.log('🔇 麦克风已关闭');
            }
        } catch (error) {
            console.error('切换麦克风失败:', error);
            playErrorSound();
        } finally {
            setIsTogglingMic(false);
        }
    }, [localParticipant, playMuteSound, playUnmuteSound, playErrorSound, isTogglingMic]);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (!room || isTogglingCamera) return;

        setIsTogglingCamera(true);
        try {
            const currentlyOff = !localParticipant.isCameraEnabled;
            
            if (currentlyOff) {
                await localParticipant.setCameraEnabled(true);
                setIsCameraOff(false);
                playCameraOnSound();
                console.log('📹 摄像头已开启');
            } else {
                await localParticipant.setCameraEnabled(false);
                setIsCameraOff(true);
                playCameraOffSound();
                console.log('📹❌ 摄像头已关闭');
            }
        } catch (error) {
            console.error('切换摄像头失败:', error);
            playErrorSound();
        } finally {
            setIsTogglingCamera(false);
        }
    }, [localParticipant, playCameraOnSound, playCameraOffSound, playErrorSound, isTogglingCamera]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!room || isTogglingScreen) return;

        setIsTogglingScreen(true);
        try {
            const currentlySharing = localParticipant.isScreenShareEnabled;
            
            if (currentlySharing) {
                await localParticipant.setScreenShareEnabled(false);
                setIsScreenSharing(false);
                playScreenShareStopSound();
                console.log('🖥️❌ 屏幕共享已停止');
            } else {
                await localParticipant.setScreenShareEnabled(true);
                setIsScreenSharing(true);
                playScreenShareStartSound();
                console.log('🖥️ 屏幕共享已开始');
            }
        } catch (error) {
            console.error('切换屏幕共享失败:', error);
            playErrorSound();
            
            if (error instanceof Error && error.name === 'NotAllowedError') {
                alert('屏幕共享权限被拒绝，请在浏览器中允许屏幕共享权限。');
            }
        } finally {
            setIsTogglingScreen(false);
        }
    }, [localParticipant, playScreenShareStartSound, playScreenShareStopSound, playErrorSound, isTogglingScreen]);

    return (
        <div className={`
            fixed bottom-4 left-1/2 transform -translate-x-1/2
            flex items-center gap-3 px-4 py-3 
            bg-gray-800/90 backdrop-blur-sm rounded-full
            border border-gray-600/50 shadow-lg
            transition-all duration-300
            ${isFullscreen && !isControlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            ${className}
        `}>
            {/* 麦克风按钮 */}
            <ControlButton
                onClick={toggleMicrophone}
                isActive={!isMuted}
                isLoading={isTogglingMic}
                title={isMuted ? '开启麦克风' : '关闭麦克风'}
                activeColor="bg-green-600"
                inactiveColor="bg-red-600"
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isMuted ? (
                            <>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12L19 10v2a7 7 0 0 1-5.14 6.74"/>
                                <path d="M12 1a3 3 0 0 0-3 3v4"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </>
                        ) : (
                            <>
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </>
                        )}
                    </svg>
                }
            />

            {/* 摄像头按钮 */}
            <ControlButton
                onClick={toggleCamera}
                isActive={!isCameraOff}
                isLoading={isTogglingCamera}
                title={isCameraOff ? '开启摄像头' : '关闭摄像头'}
                activeColor="bg-green-600"
                inactiveColor="bg-red-600"
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isCameraOff ? (
                            <>
                                <line x1="1" y1="1" x2="23" y2="23"/>
                                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>
                                <path d="M9 3h6l2 2h2a2 2 0 0 1 2 2v9"/>
                                <circle cx="12" cy="13" r="3"/>
                            </>
                        ) : (
                            <>
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                <circle cx="12" cy="13" r="4"/>
                            </>
                        )}
                    </svg>
                }
            />

            {/* 屏幕共享按钮 */}
            <ControlButton
                onClick={toggleScreenShare}
                isActive={isScreenSharing}
                isLoading={isTogglingScreen}
                title={isScreenSharing ? '停止屏幕共享' : '开始屏幕共享'}
                activeColor="bg-blue-600"
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="12" rx="2"/>
                        <circle cx="8" cy="20" r="2"/>
                        <path d="M12 18l4 2h-8l4-2z"/>
                        {isScreenSharing && <path d="M7 10l5 5 5-5" strokeWidth="3"/>}
                    </svg>
                }
            />

            {/* 分隔线 */}
            <div className="h-8 w-px bg-gray-600/50" />

            {/* 其他控制按钮 */}
            {onToggleChat && (
                <button
                    onClick={onToggleChat}
                    className={`
                        relative flex items-center justify-center w-10 h-10 rounded-lg
                        transition-all duration-200 text-white
                        ${showChat 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-gray-700 hover:bg-gray-600'
                        }
                    `}
                    title="聊天"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {chatUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* 参与者、设置、全屏按钮等保持原来的样式 */}
            {onToggleParticipants && (
                <button
                    onClick={onToggleParticipants}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title="参与者"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </button>
            )}

            {onToggleSettings && (
                <button
                    onClick={onToggleSettings}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title="设置"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.04a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </button>
            )}

            {onToggleFullscreen && (
                <button
                    onClick={onToggleFullscreen}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title={isFullscreen ? '退出全屏' : '进入全屏'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isFullscreen ? (
                            <>
                                <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                                <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                                <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                                <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                            </>
                        ) : (
                            <>
                                <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                                <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                                <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                                <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                            </>
                        )}
                    </svg>
                </button>
            )}

            {/* 分隔线 */}
            <div className="h-8 w-px bg-gray-600/50" />

            {/* 离开房间按钮 */}
            <LeaveRoomButton onLeaveRoom={onLeaveRoom} />
        </div>
    );
}

// 导出默认组件
export default ControlBar;