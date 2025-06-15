// filepath: /Users/hotxiang/livekit_dev/components/chat/FloatingChat.tsx

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AudioManager } from '../../lib/audio/AudioManager';
import { ChatContainer } from './ChatContainer';

interface FloatingChatProps {
    setPreviewImage: (src: string | null) => void;
    className?: string;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    size?: 'small' | 'medium' | 'large';
}

export default function FloatingChat({ 
    setPreviewImage, 
    className = '',
    position = 'top-right',
    size = 'medium'
}: FloatingChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [audioManager] = useState(() => AudioManager.getInstance());
    const [isMinimized, setIsMinimized] = useState(false);

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

    // 监听新消息事件
    useEffect(() => {
        const handleNewMessage = () => {
            // 播放消息通知音效
            audioManager.playSound('message-notification');

            // 如果悬浮窗关闭或最小化，增加未读数量
            if (!isOpen || isMinimized) {
                setUnreadCount(prev => prev + 1);
            }
        };

        window.addEventListener('newChatMessage', handleNewMessage);
        
        return () => {
            window.removeEventListener('newChatMessage', handleNewMessage);
        };
    }, [isOpen, isMinimized, audioManager]);

    // 切换聊天窗口
    const handleToggleChat = useCallback(() => {
        if (!isOpen) {
            // 打开聊天窗口
            setIsOpen(true);
            setIsMinimized(false);
            setUnreadCount(0);
        } else if (isMinimized) {
            // 从最小化状态恢复
            setIsMinimized(false);
            setUnreadCount(0);
        } else {
            // 关闭聊天窗口
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

    // 当聊天窗口打开且未最小化时，清除未读数量
    useEffect(() => {
        if (isOpen && !isMinimized) {
            setUnreadCount(0);
        }
    }, [isOpen, isMinimized]);

    // 处理新消息回调
    const handleNewMessage = useCallback(() => {
        if (isOpen && !isMinimized) {
            setUnreadCount(0);
        }
    }, [isOpen, isMinimized]);

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
                            {/* 聊天图标 */}
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
                            
                            {/* 在线状态指示器 */}
                            <div className="flex items-center gap-1 ml-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-xs text-gray-400">在线</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            {/* 最小化按钮 */}
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
                            
                            {/* 关闭按钮 */}
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
                        <ChatContainer 
                            messages={[]}
                            onSendMessage={async (message) => {}}
                            onSendImage={async (file) => {}}
                            onImagePreview={(src) => setPreviewImage(src)}
                            onNewMessage={handleNewMessage}
                        />
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
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCount > 99 ? '99+' : unreadCount}
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
                {unreadCount > 0 && (!isOpen || isMinimized) && (
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse z-10">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                )}

                {/* 在线状态指示器 */}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-gray-900 rounded-full z-10"></div>
            </div>
        </>
    );
}