'use client';

import React from 'react';
import { DisplayMessage } from '../../types/chat';

interface MessageItemProps {
    message: DisplayMessage;
    currentUser: string;
    onImageClick?: (src: string) => void;
    onRetry?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    className?: string;
}

export function MessageItem({
    message,
    currentUser,
    onImageClick,
    onRetry,
    onDelete,
    className = ''
}: MessageItemProps) {
    const isOwnMessage = message.user === currentUser || message.user === '你';

    // 获取用户头像
    const getUserAvatar = (username: string) => {
        if (!username) return '?';
        return username.charAt(0).toUpperCase();
    };

    // 格式化时间
    const formatTime = (timestamp: Date) => {
        return new Date(timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${className}`}>
            <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-start space-x-2 max-w-xs lg:max-w-md`}>
                {/* 用户头像 */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full ${isOwnMessage ? 'bg-blue-500 ml-2' : 'bg-green-500 mr-2'} flex items-center justify-center text-white text-sm font-semibold`}>
                    {getUserAvatar(message.user)}
                </div>

                {/* 消息内容 */}
                <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                    {/* 用户名和时间 */}
                    <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <span className="text-xs text-gray-400 font-medium">
                            {message.user}
                        </span>
                        <span className="text-xs text-gray-500">
                            {formatTime(message.timestamp)}
                        </span>
                    </div>

                    {/* 消息气泡 */}
                    <div
                        className={`
                            relative px-4 py-2 rounded-lg break-words
                            ${isOwnMessage 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-700 text-white'
                            }
                            ${message.sending ? 'opacity-70' : ''}
                            ${message.failed ? 'bg-red-600' : ''}
                        `}
                    >
                        {/* 文本消息 */}
                        {message.type === 'text' && message.text && (
                            <p className="whitespace-pre-wrap">{message.text}</p>
                        )}

                        {/* 图片消息 */}
                        {message.type === 'image' && (
                            <div className="space-y-2">
                                {message.image ? (
                                    <img
                                        src={message.image}
                                        alt="发送的图片"
                                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => onImageClick?.(message.image!)}
                                        onError={(e) => {
                                            console.error('图片加载失败:', message.image);
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-40 h-20 bg-gray-600 rounded text-gray-400 text-sm">
                                        图片加载失败
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 发送状态 */}
                        {message.sending && (
                            <div className="flex items-center mt-2 text-xs text-gray-300">
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                发送中...
                                {message.type === 'image' && message.progress !== undefined && (
                                    <span className="ml-1">({message.progress}%)</span>
                                )}
                            </div>
                        )}

                        {/* 发送失败状态 */}
                        {message.failed && (
                            <div className="flex items-center justify-between mt-2 text-xs text-red-300">
                                <span className="flex items-center">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    发送失败
                                </span>
                                <div className="flex space-x-1">
                                    <button
                                        onClick={() => onRetry?.(message.id)}
                                        className="text-blue-300 hover:text-blue-200 underline"
                                    >
                                        重试
                                    </button>
                                    <button
                                        onClick={() => onDelete?.(message.id)}
                                        className="text-red-300 hover:text-red-200 underline"
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}