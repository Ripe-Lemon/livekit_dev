'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { Button } from '../ui/Button';

interface ControlBarProps {
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onToggleSettings: () => void;
    onToggleFullscreen: () => void;
    onLeaveRoom: () => void;
    isFullscreen: boolean;
    chatUnreadCount?: number;
    showChat?: boolean;
    className?: string;
}

export function ControlBar({
    onToggleChat,
    onToggleParticipants,
    onToggleSettings,
    onToggleFullscreen,
    onLeaveRoom,
    isFullscreen,
    chatUnreadCount = 0,
    showChat = false,
    className = ''
}: ControlBarProps) {
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    // 安全地获取 room context
    let room = null;
    try {
        room = useRoomContext();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    // 设备状态
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [isScreenShareEnabled, setIsScreenShareEnabled] = useState(false);

    // 更新设备状态
    useEffect(() => {
        if (!room?.localParticipant) return;

        const updateStates = () => {
            setIsMicEnabled(room.localParticipant.isMicrophoneEnabled);
            setIsCameraEnabled(room.localParticipant.isCameraEnabled);
            setIsScreenShareEnabled(room.localParticipant.isScreenShareEnabled);
        };

        // 立即更新一次
        updateStates();

        // 监听设备状态变化
        const participant = room.localParticipant;
        participant.on('trackMuted', updateStates);
        participant.on('trackUnmuted', updateStates);
        participant.on('trackPublished', updateStates);
        participant.on('trackUnpublished', updateStates);

        // 定期检查状态（备用方案）
        const interval = setInterval(updateStates, 1000);

        return () => {
            participant.off('trackMuted', updateStates);
            participant.off('trackUnmuted', updateStates);
            participant.off('trackPublished', updateStates);
            participant.off('trackUnpublished', updateStates);
            clearInterval(interval);
        };
    }, [room]);

    // 切换麦克风
    const toggleMicrophone = useCallback(async () => {
        if (!room?.localParticipant) return;
        
        try {
            const newState = !isMicEnabled;
            await room.localParticipant.setMicrophoneEnabled(newState);
            setIsMicEnabled(newState); // 立即更新状态
            console.log('麦克风状态切换为:', newState);
        } catch (error) {
            console.error('切换麦克风失败:', error);
        }
    }, [room, isMicEnabled]);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (!room?.localParticipant) return;
        
        try {
            const newState = !isCameraEnabled;
            await room.localParticipant.setCameraEnabled(newState);
            setIsCameraEnabled(newState); // 立即更新状态
            console.log('摄像头状态切换为:', newState);
        } catch (error) {
            console.error('切换摄像头失败:', error);
        }
    }, [room, isCameraEnabled]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!room?.localParticipant) return;
        
        try {
            const newState = !isScreenShareEnabled;
            await room.localParticipant.setScreenShareEnabled(newState);
            setIsScreenShareEnabled(newState); // 立即更新状态
            console.log('屏幕共享状态切换为:', newState);
        } catch (error) {
            console.error('切换屏幕共享失败:', error);
        }
    }, [room, isScreenShareEnabled]);

    // 自动隐藏控制栏
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

    return (
        <div 
            className={`
                absolute bottom-0 left-0 right-0 z-30 p-4
                transition-all duration-300
                ${isFullscreen && !isControlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                ${className}
            `}
        >
            <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
                    {/* 麦克风按钮 */}
                    <Button
                        variant={isMicEnabled ? "primary" : "danger"}
                        size="sm"
                        onClick={toggleMicrophone}
                        disabled={!room}
                        title={isMicEnabled ? "关闭麦克风" : "开启麦克风"}
                        className="relative"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMicEnabled ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            ) : (
                                <>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l14 14" />
                                </>
                            )}
                        </svg>
                    </Button>

                    {/* 摄像头按钮 */}
                    <Button
                        variant={isCameraEnabled ? "primary" : "danger"}
                        size="sm"
                        onClick={toggleCamera}
                        disabled={!room}
                        title={isCameraEnabled ? "关闭摄像头" : "开启摄像头"}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isCameraEnabled ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            ) : (
                                <>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5l14 14" />
                                </>
                            )}
                        </svg>
                    </Button>

                    {/* 屏幕共享按钮 */}
                    <Button
                        variant={isScreenShareEnabled ? "primary" : "ghost"}
                        size="sm"
                        onClick={toggleScreenShare}
                        disabled={!room}
                        title={isScreenShareEnabled ? "停止屏幕共享" : "开始屏幕共享"}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </Button>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-gray-600" />

                    {/* 聊天按钮 */}
                    <Button
                        variant={showChat ? "primary" : "ghost"}
                        size="sm"
                        onClick={onToggleChat}
                        title="聊天"
                        className="relative"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {/* 未读消息气泡 */}
                        {chatUnreadCount > 0 && !showChat && (
                            <div className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                            </div>
                        )}
                    </Button>

                    {/* 参与者按钮 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleParticipants}
                        title="参与者列表"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                    </Button>

                    {/* 设置按钮 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleSettings}
                        title="设置"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </Button>

                    {/* 全屏按钮 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleFullscreen}
                        title={isFullscreen ? "退出全屏" : "进入全屏"}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d={isFullscreen 
                                    ? "M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15H4.5M9 15v4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5"
                                    : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                                } 
                            />
                        </svg>
                    </Button>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-gray-600" />

                    {/* 离开房间按钮 */}
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={onLeaveRoom}
                        title="离开房间"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </Button>
                </div>
            </div>
        </div>
    );
}