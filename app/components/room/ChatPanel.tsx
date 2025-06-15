'use client';

import React, { useState, useCallback } from 'react';
import { ChatState, DisplayMessage } from '../../types/chat';
import ChatContainer from '../room/ChatContainer';
import { Button } from '../ui/Button';

interface ChatPanelProps {
    chatState: ChatState;
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    onToggleChat: () => void;
    onClearMessages: () => void;
    onRetryMessage: (messageId: string) => void;
    onDeleteMessage: (messageId: string) => void;
    onImageClick: (src: string) => void;
    onClose: () => void;
    className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
    chatState,
    onSendMessage,
    onSendImage,
    onToggleChat,
    onClearMessages,
    onRetryMessage,
    onDeleteMessage,
    onImageClick,
    onClose,
    className = ''
}) => {
    const [showActions, setShowActions] = useState(false);

    const handleClearMessages = useCallback(() => {
        if (window.confirm('确定要清除所有消息吗？此操作无法撤销。')) {
            onClearMessages();
            setShowActions(false);
        }
    }, [onClearMessages]);

    return (
        <div className={`flex flex-col h-full bg-gray-800 ${className}`}>
            {/* 聊天头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">聊天</h3>
                    {chatState.messages.length > 0 && (
                        <span className="text-sm text-gray-400">
                            ({chatState.messages.length} 条消息)
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    {/* 更多操作按钮 */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowActions(!showActions)}
                            className="text-gray-400 hover:text-white"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </Button>

                        {/* 操作菜单 */}
                        {showActions && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                    <button
                                        onClick={handleClearMessages}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
                                    >
                                        <svg className="w-4 h-4 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        清除所有消息
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 关闭按钮 */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </Button>
                </div>
            </div>

            {/* 聊天内容 */}
            <div className="flex-1 flex flex-col min-h-0">
                <ChatContainer
                    messages={chatState.messages}
                    onSendMessage={onSendMessage}
                    onSendImage={onSendImage}
                    onImagePreview={onImageClick}
                    onRetryMessage={onRetryMessage}
                    onDeleteMessage={onDeleteMessage}
                    className="flex-1"
                />
            </div>

            {/* 点击外部关闭菜单 */}
            {showActions && (
                <div 
                    className="fixed inset-0 z-5" 
                    onClick={() => setShowActions(false)}
                />
            )}
        </div>
    );
};