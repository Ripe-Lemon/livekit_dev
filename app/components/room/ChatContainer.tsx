'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, DisplayMessage, MessageType } from '../../types/chat';
import { MessageItem } from '../chat/MessageItem';
import { MessageInput } from '../chat/MessageInput';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface ChatContainerProps {
    messages: DisplayMessage[];
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    onImagePreview?: (src: string) => void;
    onNewMessage?: () => void;
    onRetryMessage?: (messageId: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    className?: string;
    maxHeight?: string;
    showTypingIndicator?: boolean;
    isLoading?: boolean;
    error?: string | null;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
    messages = [],
    onSendMessage,
    onSendImage,
    onImagePreview,
    onNewMessage,
    onRetryMessage,
    onDeleteMessage,
    className = '',
    maxHeight = 'h-full',
    showTypingIndicator = false,
    isLoading = false,
    error = null
}) => {
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // 滚动到底部
    const scrollToBottom = useCallback((force = false) => {
        if (messagesEndRef.current && (isAtBottom || force)) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [isAtBottom]);

    // 检查是否在底部
    const checkIfAtBottom = useCallback(() => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 10;
            setIsAtBottom(atBottom);
            setShowScrollButton(!atBottom && messages.length > 0);
        }
    }, [messages.length]);

    // 监听滚动事件
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (container) {
            container.addEventListener('scroll', checkIfAtBottom);
            return () => container.removeEventListener('scroll', checkIfAtBottom);
        }
    }, [checkIfAtBottom]);

    // 新消息时自动滚动
    useEffect(() => {
        if (messages.length > 0) {
            const timer = setTimeout(() => {
                scrollToBottom();
                onNewMessage?.();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length, scrollToBottom, onNewMessage]);

    // 初始化滚动到底部
    useEffect(() => {
        scrollToBottom(true);
    }, []);

    const handleSendMessage = useCallback(async (content: string, type: MessageType = 'text') => {
        try {
            if (type === 'text') {
                await onSendMessage(content);
            }
            // 发送成功后滚动到底部
            setTimeout(() => scrollToBottom(true), 100);
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [onSendMessage, scrollToBottom]);

    const handleSendImage = useCallback(async (file: File) => {
        try {
            await onSendImage(file);
            // 发送成功后滚动到底部
            setTimeout(() => scrollToBottom(true), 100);
        } catch (error) {
            console.error('发送图片失败:', error);
        }
    }, [onSendImage, scrollToBottom]);

    const handleImageClick = useCallback((src: string) => {
        onImagePreview?.(src);
    }, [onImagePreview]);

    const handleRetryMessage = useCallback((messageId: string) => {
        onRetryMessage?.(messageId);
    }, [onRetryMessage]);

    const handleDeleteMessage = useCallback((messageId: string) => {
        onDeleteMessage?.(messageId);
    }, [onDeleteMessage]);

    return (
        <div className={`flex flex-col ${maxHeight} ${className}`}>
            {/* 消息列表区域 */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
            >
                <div className="p-4 space-y-3">
                    {/* 加载状态 */}
                    {isLoading && messages.length === 0 && (
                        <div className="flex justify-center py-8">
                            <LoadingSpinner size="md" color="white" text="加载消息中..." />
                        </div>
                    )}

                    {/* 错误状态 */}
                    {error && (
                        <div className="flex justify-center py-4">
                            <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-2">
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* 空状态 */}
                    {!isLoading && !error && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <svg 
                                className="w-16 h-16 mb-4 opacity-50" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    strokeWidth={1.5} 
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                                />
                            </svg>
                            <p className="text-lg font-medium mb-2">还没有消息</p>
                            <p className="text-sm">发送第一条消息开始聊天吧！</p>
                        </div>
                    )}

                    {/* 消息列表 */}
                    {messages.map((message) => (
                        <MessageItem
                            key={message.id}
                            message={message}
                            isOwn={message.sender === 'current-user'} // You may need to adjust this logic based on your user identification
                            onImageClick={handleImageClick}
                            onRetry={handleRetryMessage}
                            onDelete={handleDeleteMessage}
                        />
                    ))}

                    {/* 正在输入指示器 */}
                    {showTypingIndicator && (
                        <div className="flex items-center space-x-2 text-gray-400 text-sm">
                            <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                            <span>有人正在输入...</span>
                        </div>
                    )}

                    {/* 滚动锚点 */}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* 滚动到底部按钮 */}
            {showScrollButton && (
                <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-10">
                    <button
                        onClick={() => scrollToBottom(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
                        title="滚动到底部"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </button>
                </div>
            )}

            {/* 消息输入区域 */}
            <div className="border-t border-gray-700 p-4">
                <MessageInput
                    onSendMessage={handleSendMessage}
                    onSendImage={handleSendImage}
                    placeholder="输入消息..."
                    disabled={isLoading}
                />
            </div>
        </div>
    );
};

export default ChatContainer;