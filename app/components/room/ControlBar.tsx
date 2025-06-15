'use client';

import React, { useState, useCallback } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Button, ButtonVariant } from '../ui/Button';

interface ControlBarProps {
    onToggleChat: () => void;
    onToggleParticipants: () => void;
    onToggleSettings: () => void;
    onToggleFullscreen: () => void;
    onLeaveRoom: () => void;
    isFullscreen: boolean;
    chatUnreadCount?: number;
    className?: string;
}

export const ControlBar: React.FC<ControlBarProps> = ({
    onToggleChat,
    onToggleParticipants,
    onToggleSettings,
    onToggleFullscreen,
    onLeaveRoom,
    isFullscreen,
    chatUnreadCount = 0,
    className = ''
}) => {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    const [isAudioEnabled, setIsAudioEnabled] = useState(
        localParticipant?.isMicrophoneEnabled ?? false
    );
    const [isVideoEnabled, setIsVideoEnabled] = useState(
        localParticipant?.isCameraEnabled ?? false
    );
    const [isScreenSharing, setIsScreenSharing] = useState(
        localParticipant?.isScreenShareEnabled ?? false
    );

    // 切换音频
    const toggleAudio = useCallback(async () => {
        if (localParticipant) {
            try {
                await localParticipant.setMicrophoneEnabled(!isAudioEnabled);
                setIsAudioEnabled(!isAudioEnabled);
            } catch (error) {
                console.error('切换音频失败:', error);
            }
        }
    }, [localParticipant, isAudioEnabled]);

    // 切换视频
    const toggleVideo = useCallback(async () => {
        if (localParticipant) {
            try {
                await localParticipant.setCameraEnabled(!isVideoEnabled);
                setIsVideoEnabled(!isVideoEnabled);
            } catch (error) {
                console.error('切换视频失败:', error);
            }
        }
    }, [localParticipant, isVideoEnabled]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (localParticipant) {
            try {
                await localParticipant.setScreenShareEnabled(!isScreenSharing);
                setIsScreenSharing(!isScreenSharing);
            } catch (error) {
                console.error('切换屏幕共享失败:', error);
            }
        }
    }, [localParticipant, isScreenSharing]);

    // 离开房间确认
    const handleLeaveRoom = useCallback(() => {
        if (window.confirm('确定要离开房间吗？')) {
            onLeaveRoom();
        }
    }, [onLeaveRoom]);

    return (
        <div className={`
            absolute bottom-6 left-1/2 transform -translate-x-1/2 
            bg-gray-900/90 backdrop-blur-sm border border-gray-700 
            rounded-full px-6 py-3 shadow-lg z-50
            ${className}
        `}>
            <div className="flex items-center space-x-4">
                {/* 音频控制 */}
                <Button
                    variant={isAudioEnabled ? "primary" : "outline"}
                    size="lg"
                    onClick={toggleAudio}
                    className="rounded-full w-12 h-12 p-0"
                    title={isAudioEnabled ? "关闭麦克风" : "开启麦克风"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isAudioEnabled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-3a1 1 0 011-1h1.586l4.707-4.707C10.923 4.663 12 5.109 12 6v12c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        )}
                    </svg>
                </Button>

                {/* 视频控制 */}
                <Button
                    variant={isVideoEnabled ? "primary" : "outline"}
                    size="lg"
                    onClick={toggleVideo}
                    className="rounded-full w-12 h-12 p-0"
                    title={isVideoEnabled ? "关闭摄像头" : "开启摄像头"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isVideoEnabled ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18 18M5.636 5.636L6 6" />
                        )}
                    </svg>
                </Button>

                {/* 屏幕共享 */}
                <Button
                    variant={isScreenSharing ? "primary" : "ghost"}
                    size="lg"
                    onClick={toggleScreenShare}
                    className="rounded-full w-12 h-12 p-0"
                    title={isScreenSharing ? "停止屏幕共享" : "开始屏幕共享"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </Button>

                {/* 分隔线 */}
                <div className="w-px h-8 bg-gray-600"></div>

                {/* 聊天 */}
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={onToggleChat}
                    className="rounded-full w-12 h-12 p-0 relative"
                    title="聊天"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {chatUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                        </span>
                    )}
                </Button>

                {/* 参与者 */}
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={onToggleParticipants}
                    className="rounded-full w-12 h-12 p-0"
                    title="参与者列表"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                </Button>

                {/* 设置 */}
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={onToggleSettings}
                    className="rounded-full w-12 h-12 p-0"
                    title="设置"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </Button>

                {/* 全屏 */}
                <Button
                    variant="ghost"
                    size="lg"
                    onClick={onToggleFullscreen}
                    className="rounded-full w-12 h-12 p-0"
                    title={isFullscreen ? "退出全屏" : "进入全屏"}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isFullscreen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        )}
                    </svg>
                </Button>

                {/* 分隔线 */}
                <div className="w-px h-8 bg-gray-600"></div>

                {/* 离开房间 */}
                <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLeaveRoom}
                    className="rounded-full w-12 h-12 p-0"
                    title="离开房间"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </Button>
            </div>
        </div>
    );
};