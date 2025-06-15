'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useChat } from '../../hooks/useChat';
import { useAudioManager } from '../../hooks/useAudioManager';
import { MessageItem } from '../chat/MessageItem';
import { MessageInput } from '../chat/MessageInput';

interface FloatingChatProps {
    setPreviewImage: (src: string | null) => void;
    className?: string;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    size?: 'small' | 'medium' | 'large';
}

export default function FloatingChat({ 
    setPreviewImage, 
    className = '',
    position = 'bottom-right',
    size = 'medium'
}: FloatingChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // 确保在 LiveKit Room 内部使用这些 hooks
    const room = useRoomContext();
    
    // 只有在 room 存在时才使用聊天功能
    const { 
        chatState, 
        sendTextMessage, 
        sendImageMessage, 
        clearMessages 
    } = useChat({
        maxMessages: 100,
        enableSounds: true,
        autoScrollToBottom: true
    });

    const { playSound } = useAudioManager({
        autoInitialize: true,
        globalVolume: 0.7,
        enabled: true
    });

    // 尺寸配置
    const sizeConfig = {
        small: { width: 'w-72', height: 'h-96' },
        medium: { width: 'w-80', height: 'h-[500px]' },
        large: { width: 'w-96', height: 'h-[600px]' }
    };

    // 位置配置
    const positionConfig = {
        'top-right': 'top-6 right-20',
        'top-left': 'top-6 left-20',
        'bottom-right': 'bottom-6 right-20',
        'bottom-left': 'bottom-6 left-20'
    };

    const buttonPositionConfig = {
        'top-right': 'top-6 right-6',
        'top-left': 'top-6 left-6',
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6'
    };

    // 切换聊天窗口
    const handleToggleChat = useCallback(() => {
        if (!isOpen) {
            setIsOpen(true);
            setIsMinimized(false);
        } else if (isMinimized) {
            setIsMinimized(false);
        } else {
            setIsOpen(false);
            setIsMinimized(false);
        }
    }, [isOpen, isMinimized]);

    // 最小化聊天窗口
    const handleMinimize = useCallback(() => {
        setIsMinimized(true);
    }, []);

    // 关闭聊天窗口
    const handleClose = useCallback(() => {
        setIsOpen(false);
        setIsMinimized(false);
    }, []);

    // 发送消息处理
    const handleSendMessage = useCallback(async (message: string) => {
        try {
            await sendTextMessage(message);
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [sendTextMessage]);

    // 发送图片处理
    const handleSendImage = useCallback(async (file: File) => {
        try {
            await sendImageMessage(file);
        } catch (error) {
            console.error('发送图片失败:', error);
        }
    }, [sendImageMessage]);

    // 图片预览处理
    const handleImageClick = useCallback((src: string) => {
        setPreviewImage(src);
    }, [setPreviewImage]);

    // 如果没有 room 连接，不渲染聊天组件
    if (!room) {
        return null;
    }

    return (
        <>
            {/* 悬浮聊天面板 */}
            <div
                className={`
                    fixed ${positionConfig[position]} z-40 
                    ${sizeConfig[size].height} ${sizeConfig[size].width}
                    transform transition-all duration-300 ease-in-out
                    ${isOpen && !isMinimized 
                        ? 'translate-x-0 opacity-100' 
                        : 'translate-x-full opacity-0 pointer-events-none'
                    }
                    ${className}
                `}
            >
                <div className="h-full rounded-lg bg-gray-900/95 backdrop-blur-sm shadow-2xl border border-gray-700 flex flex-col">
                    {/* 聊天头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-blue-400"
                            >
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                            <h3 className="text-lg font-medium text-white">聊天</h3>
                            
                            <div className="flex items-center gap-1 ml-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-xs text-gray-400">在线</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleMinimize}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                                title="最小化"
                            >
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
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                            </button>
                            
                            <button
                                onClick={handleClose}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                                title="关闭"
                            >
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
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    {/* 聊天内容区域 */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* 消息列表 */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {chatState.messages.map((message) => (
                                <MessageItem
                                    key={message.id}
                                    message={message}
                                    isOwn={'isOwn' in message ? Boolean(message.isOwn) : false}
                                    onImageClick={handleImageClick}
                                    onRetry={() => {}}
                                    onDelete={() => {}}
                                />
                            ))}
                            
                            {chatState.messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                    <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <p className="text-center">还没有消息</p>
                                    <p className="text-sm text-center mt-1">开始对话吧！</p>
                                </div>
                            )}
                        </div>
                        
                        {/* 消息输入 */}
                        <div className="border-t border-gray-700 p-4">
                            <MessageInput
                                onSendMessage={handleSendMessage}
                                onSendImage={handleSendImage}
                                placeholder="输入消息..."
                                maxLength={1000}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* 最小化状态的提示栏 */}
            {isOpen && isMinimized && (
                <div
                    className={`
                        fixed ${position.includes('bottom') ? 'bottom-20' : 'top-20'} 
                        ${position.includes('right') ? 'right-6' : 'left-6'} 
                        z-40 bg-gray-900/95 backdrop-blur-sm border border-gray-700 
                        rounded-lg px-4 py-2 cursor-pointer hover:bg-gray-800/95 
                        transition-all duration-200
                    `}
                    onClick={handleToggleChat}
                >
                    <div className="flex items-center gap-2 text-sm text-white">
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
                            className="text-blue-400"
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <span>聊天已最小化</span>
                        {chatState.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {chatState.unreadCount > 99 ? '99+' : chatState.unreadCount}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* 聊天按钮 */}
            <div className={`fixed ${buttonPositionConfig[position]} z-50 relative`}>
                <button
                    onClick={handleToggleChat}
                    className={`
                        flex h-12 w-12 items-center justify-center 
                        rounded-full shadow-lg backdrop-blur-sm transition-all
                        ${isOpen && !isMinimized
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-black/60 text-white hover:bg-black/80 hover:scale-105'
                        }
                    `}
                    aria-label={isOpen ? "管理聊天" : "打开聊天"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>

                {/* 未读消息气泡 */}
                {chatState.unreadCount > 0 && (!isOpen || isMinimized) && (
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse z-10">
                        {chatState.unreadCount > 99 ? '99+' : chatState.unreadCount}
                    </div>
                )}

                {/* 在线状态指示器 */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-gray-900 rounded-full z-10"></div>
            </div>
        </>
    );
}