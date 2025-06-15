'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';

// Components
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Button } from '../ui/Button';

// Types
import { ChatMessage, MessageStatus, MessageType } from '../../types/chat';

// Utils
import { formatTime, formatFileSize } from '../../utils/formatUtils';
import { isImageUrl, extractUrls, formatMentions } from '../../utils/messageUtils';

// Constants
import { MESSAGE_STATUS_STYLES, CHAT_EMOJIS } from '../../constants/chat';

interface MessageItemProps {
    message: ChatMessage;
    isOwn: boolean;
    showAvatar?: boolean;
    showTimestamp?: boolean;
    onRetry?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    onReact?: (messageId: string, emoji: string) => void;
    onReply?: (message: ChatMessage) => void;
    onImageClick?: (src: string) => void;
    onMentionClick?: (username: string) => void;
    onUrlClick?: (url: string) => void;
    className?: string;
}

interface ContextMenuProps {
    x: number;
    y: number;
    isVisible: boolean;
    onClose: () => void;
    onRetry?: () => void;
    onDelete?: () => void;
    onReply?: () => void;
    onCopy?: () => void;
    canRetry: boolean;
    canDelete: boolean;
}

// 右键菜单组件
function ContextMenu({
    x,
    y,
    isVisible,
    onClose,
    onRetry,
    onDelete,
    onReply,
    onCopy,
    canRetry,
    canDelete
}: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isVisible, onClose]);

    if (!isVisible) return null;

    return (
        <div
            ref={menuRef}
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 z-50 min-w-32"
            style={{ left: x, top: y }}
        >
            {onReply && (
                <button
                    onClick={() => {
                        onReply();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                    回复
                </button>
            )}
            
            {onCopy && (
                <button
                    onClick={() => {
                        onCopy();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                >
                    复制
                </button>
            )}
            
            {canRetry && onRetry && (
                <button
                    onClick={() => {
                        onRetry();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-yellow-400 hover:bg-gray-700 transition-colors"
                >
                    重试
                </button>
            )}
            
            {canDelete && onDelete && (
                <button
                    onClick={() => {
                        onDelete();
                        onClose();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors"
                >
                    删除
                </button>
            )}
        </div>
    );
}

// 表情符号选择器组件
function EmojiPicker({
    isVisible,
    onClose,
    onSelectEmoji,
    buttonRef
}: {
    isVisible: boolean;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
    buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
    const pickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                pickerRef.current && 
                !pickerRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        if (isVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isVisible, onClose, buttonRef]);

    if (!isVisible) return null;

    return (
        <div
            ref={pickerRef}
            className="absolute bottom-full right-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-2 z-50"
        >
            <div className="grid grid-cols-4 gap-1">
                {CHAT_EMOJIS.reactions.map((emoji) => (
                    <button
                        key={emoji}
                        onClick={() => {
                            onSelectEmoji(emoji);
                            onClose();
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded transition-colors"
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}

export function MessageItem({
    message,
    isOwn,
    showAvatar = true,
    showTimestamp = true,
    onRetry,
    onDelete,
    onReact,
    onReply,
    onImageClick,
    onMentionClick,
    onUrlClick,
    className = ''
}: MessageItemProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, isVisible: false });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const messageRef = useRef<HTMLDivElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);

    // 获取消息状态样式
    const statusStyle = MESSAGE_STATUS_STYLES[message.status as keyof typeof MESSAGE_STATUS_STYLES] || MESSAGE_STATUS_STYLES[MessageStatus.SENT];

    // 处理右键菜单
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            isVisible: true
        });
    }, []);

    // 复制消息内容
    const handleCopy = useCallback(async () => {
        if (!message.content) {
            console.warn('无法复制：消息内容为空');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(message.content);
        } catch (error) {
            console.error('复制失败:', error);
        }
    }, [message.content]);

    // 处理表情符号选择
    const handleEmojiSelect = useCallback((emoji: string) => {
        if (onReact) {
            onReact(message.id, emoji);
        }
    }, [message.id, onReact]);

    // 处理图片点击
    const handleImageClick = useCallback((src: string) => {
        if (onImageClick) {
            onImageClick(src);
        }
    }, [onImageClick]);

    // 处理提及点击
    const handleMentionClick = useCallback((username: string) => {
        if (onMentionClick) {
            onMentionClick(username);
        }
    }, [onMentionClick]);

    // 处理URL点击
    const handleUrlClick = useCallback((url: string) => {
        if (onUrlClick) {
            onUrlClick(url);
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [onUrlClick]);

    // 渲染消息内容
    const renderMessageContent = () => {
        switch (message.type) {
            case 'text':
                return renderTextMessage();
            case 'image':
                return renderImageMessage();
            case 'file':
                return renderFileMessage();
            case 'system':
                return renderSystemMessage();
            default:
                return <span className="text-gray-400">不支持的消息类型</span>;
        }
    };

    // 渲染文本消息
    const renderTextMessage = () => {
        const content = message.content || '';
        const urls = extractUrls(content);
        const formattedContent = formatMentions(content, handleMentionClick);

        return (
            <div className="space-y-2">
                <div className="text-gray-200 break-words whitespace-pre-wrap">
                    {formattedContent}
                </div>
                
                {/* URL 预览 */}
                {urls.length > 0 && (
                    <div className="space-y-2">
                        {urls.map((url, index) => (
                            <div key={index} className="border border-gray-600 rounded p-2">
                                <button
                                    onClick={() => handleUrlClick(url)}
                                    className="text-blue-400 hover:text-blue-300 text-sm break-all"
                                >
                                    {url}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // 渲染图片消息
    const renderImageMessage = () => {
        const imageUrl = message.imageUrl || message.content;

        if (!imageUrl) {
            return (
                <div className="flex items-center space-x-2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>图片URL缺失</span>
                </div>
            );
        }

        if (imageLoadError) {
            return (
                <div className="flex items-center space-x-2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span>图片加载失败</span>
                </div>
            );
        }

        return (
            <div className="relative max-w-xs">
                {imageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-700 rounded">
                        <LoadingSpinner size="sm" />
                    </div>
                )}
                
                <Image
                    src={imageUrl}
                    alt="聊天图片"
                    width={300}
                    height={200}
                    className="rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ objectFit: 'cover' }}
                    onClick={() => handleImageClick(imageUrl)}
                    onLoad={() => setImageLoading(false)}
                    onError={() => {
                        setImageLoading(false);
                        setImageLoadError(true);
                    }}
                />
            </div>
        );
    };

    // 渲染文件消息
    const renderFileMessage = () => {
        const fileInfo = message.fileInfo;
        if (!fileInfo) return null;

        const fileIcon = getFileIcon(fileInfo.type);
        
        return (
            <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg max-w-xs">
                <div className="text-2xl">{fileIcon}</div>
                <div className="flex-1 min-w-0">
                    <div className="text-gray-200 text-sm font-medium truncate">
                        {fileInfo.name}
                    </div>
                    <div className="text-gray-400 text-xs">
                        {formatFileSize(fileInfo.size)}
                    </div>
                </div>
                <button
                    onClick={() => message.content && handleUrlClick(message.content)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </button>
            </div>
        );
    };

    // 渲染系统消息
    const renderSystemMessage = () => (
        <div className="text-center text-gray-400 text-sm italic">
            {message.content}
        </div>
    );

    // 获取文件图标
    const getFileIcon = (mimeType: string): string => {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.startsWith('video/')) return '🎥';
        if (mimeType.startsWith('audio/')) return '🎵';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
        return '📎';
    };

    // 系统消息的特殊渲染
    if (message.type === 'system') {
        return (
            <div className={`flex justify-center py-2 ${className}`}>
                {renderSystemMessage()}
            </div>
        );
    }

    return (
        <div
            ref={messageRef}
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onContextMenu={handleContextMenu}
        >
            <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'} space-x-2`}>
                {/* 头像 */}
                {showAvatar && !isOwn && (
                    <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-medium text-white">
                            {message.senderName?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                )}

                {/* 消息气泡 */}
                <div className="flex flex-col space-y-1">
                    {/* 发送者名称 */}
                    {!isOwn && message.senderName && (
                        <div className="text-xs text-gray-400 px-1">
                            {message.senderName}
                        </div>
                    )}

                    {/* 消息内容 */}
                    <div
                        className={`relative p-3 rounded-lg ${
                            isOwn
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-200'
                        } ${statusStyle.opacity < 1 ? `opacity-${Math.round(statusStyle.opacity * 100)}` : ''}`}
                    >
                        {renderMessageContent()}

                        {/* 消息状态 */}
                        {isOwn && message.status !== MessageStatus.SENT && (
                            <div className={`absolute -bottom-1 -right-1 text-xs ${statusStyle.color}`}>
                                {statusStyle.icon}
                            </div>
                        )}

                        {/* 悬浮操作按钮 */}
                        {isHovered && (
                            <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex items-center space-x-1 bg-gray-800 rounded-lg shadow-lg px-1 py-1`}>
                                {/* 表情符号按钮 */}
                                {onReact && (
                                    <div className="relative">
                                        <button
                                            ref={emojiButtonRef}
                                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                            className="p-1 text-gray-400 hover:text-yellow-400 transition-colors"
                                            title="添加表情"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                        
                                        <EmojiPicker
                                            isVisible={showEmojiPicker}
                                            onClose={() => setShowEmojiPicker(false)}
                                            onSelectEmoji={handleEmojiSelect}
                                            buttonRef={emojiButtonRef}
                                        />
                                    </div>
                                )}

                                {/* 回复按钮 */}
                                {onReply && (
                                    <button
                                        onClick={() => onReply(message)}
                                        className="p-1 text-gray-400 hover:text-blue-400 transition-colors"
                                        title="回复"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 时间戳和状态 */}
                    {showTimestamp && (
                        <div className={`text-xs text-gray-400 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                            {formatTime(message.timestamp)}
                            {isOwn && message.status === MessageStatus.FAILED && onRetry && (
                                <button
                                    onClick={() => onRetry(message.id)}
                                    className="ml-2 text-yellow-400 hover:text-yellow-300"
                                    title="重试发送"
                                >
                                    重试
                                </button>
                            )}
                        </div>
                    )}

                    {/* 消息反应 */}
                    {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-1">
                            {message.reactions.map((reaction, index) => (
                                <button
                                    key={index}
                                    onClick={() => onReact && onReact(message.id, reaction.emoji)}
                                    className="flex items-center space-x-1 bg-gray-600 rounded-full px-2 py-1 text-xs hover:bg-gray-500 transition-colors"
                                >
                                    <span>{reaction.emoji}</span>
                                    <span className="text-gray-300">{reaction.count}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 右键菜单 */}
            <ContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                isVisible={contextMenu.isVisible}
                onClose={() => setContextMenu(prev => ({ ...prev, isVisible: false }))}
                onRetry={onRetry ? () => onRetry(message.id) : undefined}
                onDelete={onDelete ? () => onDelete(message.id) : undefined}
                onReply={onReply ? () => onReply(message) : undefined}
                onCopy={handleCopy}
                canRetry={isOwn && message.status === MessageStatus.FAILED}
                canDelete={isOwn || (message.canDelete ?? false)}
            />
        </div>
    );
}

export default MessageItem;