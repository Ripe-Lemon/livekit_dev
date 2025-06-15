'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { MessageItem } from '../chat/MessageItem';
import { MessageInput } from '../chat/MessageInput';
import { DisplayMessage, ChatState } from '../../types/chat';

interface FloatingChatProps {
    setPreviewImage: (src: string | null) => void;
    onClose: () => void;
    chatState: ChatState;
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    onClearMessages: () => void;
    onRetryMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    className?: string;
}

export default function FloatingChat({ 
    setPreviewImage,
    onClose,
    chatState,
    onSendMessage,
    onSendImage,
    onClearMessages,
    onRetryMessage,
    onDeleteMessage,
    className = ''
}: FloatingChatProps) {
    const [isVisible, setIsVisible] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 确保在 LiveKit Room 内部使用这些 hooks
    const room = useRoomContext();

    // 挂载动画
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    // 发送消息处理
    const handleSendMessage = useCallback(async (message: string) => {
        try {
            await onSendMessage(message);
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [onSendMessage]);

    // 发送图片处理
    const handleSendImage = useCallback(async (file: File) => {
        try {
            await onSendImage(file);
        } catch (error) {
            console.error('发送图片失败:', error);
        }
    }, [onSendImage]);

    // 图片预览处理
    const handleImageClick = useCallback((src: string) => {
        setPreviewImage(src);
    }, [setPreviewImage]);

    // 关闭处理 - 添加滑出动画
    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // 等待动画完成
    }, [onClose]);

    // 自动滚动到底部
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatState.messages]);

    // 如果没有 room 连接，不渲染聊天组件
    if (!room) {
        return null;
    }

    return (
        <div className={`fixed top-0 right-0 h-full w-80 z-40 ${className}`}>
            <div 
                className={`
                    h-full bg-gray-900/95 backdrop-blur-sm shadow-2xl border-l border-gray-700 
                    flex flex-col transition-transform duration-300 ease-in-out
                    ${isVisible ? 'transform translate-x-0' : 'transform translate-x-full'}
                `}
            >
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
                            onClick={onClearMessages}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                            title="清除消息"
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
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
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
                                onImageClick={handleImageClick}
                                onRetry={onRetryMessage}
                                onDelete={onDeleteMessage}
                                currentUser={room.localParticipant?.identity || '你'}
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
                        
                        {/* 消息列表底部锚点 */}
                        <div ref={messagesEndRef} />
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
    );
}