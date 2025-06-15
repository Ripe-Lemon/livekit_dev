'use client';

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent, ChangeEvent, DragEvent } from 'react';
import Image from 'next/image';

// Components
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

// Types
import { ChatMessage, getMessageContent, getSenderName } from '../../types/chat';

// Utils
import { compressImage, validateImageFile } from '../../utils/imageUtils';

// Constants
import { 
    CHAT_LIMITS, 
    SUPPORTED_IMAGE_FORMATS, 
    SUPPORTED_IMAGE_EXTENSIONS,
    CHAT_SHORTCUTS 
} from '../../constants/chat';

interface MessageInputProps {
    onSendMessage: (content: string) => void;
    onSendImage: (file: File) => void;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
    enableImageUpload?: boolean;
    enableEmoji?: boolean;
    compressImages?: boolean;
    replyingTo?: ChatMessage | null; // 使用 ChatMessage 类型
    onCancelReply?: () => void;
    className?: string;
}


interface ImagePreview {
    file: File;
    url: string;
    isValid: boolean;
    error?: string;
}

interface EmojiCategory {
    name: string;
    emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
    {
        name: '表情',
        emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳']
    },
    {
        name: '手势',
        emojis: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '🤌', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
    },
    {
        name: '心情',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💯', '💢', '💥', '💫', '💦', '💨']
    },
    {
        name: '物品',
        emojis: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎯', '⭐', '🌟', '💫', '✨', '🔥', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭']
    }
];

export function MessageInput({
    onSendMessage,
    onSendImage,
    disabled = false,
    placeholder = '输入消息...',
    maxLength = CHAT_LIMITS.MAX_MESSAGE_LENGTH,
    enableImageUpload = true,
    enableEmoji = true,
    compressImages = true,
    replyingTo,
    onCancelReply,
    className = ''
}: MessageInputProps) {
    // 状态管理
    const [message, setMessage] = useState('');
    const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Refs
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 字符计数
    const characterCount = message.length;
    const isOverLimit = characterCount > maxLength;

    // 获取回复消息的显示文本
    const getReplyMessageText = useCallback((msg: ChatMessage): string => {
        // 尝试不同的属性名称来获取消息内容
        return msg.text || msg.content || msg.message || '消息内容';
    }, []);

    // 获取发送者名称
    const getReplySenderName = useCallback((msg: ChatMessage): string => {
        // 尝试不同的属性名称来获取发送者名称
        return msg.senderName || msg.sender || msg.author || msg.participantName || '用户';
    }, []);

    // 自动调整文本框高度
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
        }
    }, []);

    // 处理消息输入
    const handleMessageChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setMessage(value);
        adjustTextareaHeight();
    }, [adjustTextareaHeight]);

    // 发送消息
    const sendMessage = useCallback(async () => {
        if (disabled || isUploading) return;

        const trimmedMessage = message.trim();
        
        // 发送图片
        if (imagePreview?.file && imagePreview.isValid) {
            setIsUploading(true);
            try {
                await onSendImage(imagePreview.file);
                setImagePreview(null);
                
                // 如果有文本消息，也发送
                if (trimmedMessage) {
                    onSendMessage(trimmedMessage);
                    setMessage('');
                }
            } catch (error) {
                console.error('发送图片失败:', error);
            } finally {
                setIsUploading(false);
            }
            return;
        }

        // 发送文本消息
        if (trimmedMessage && !isOverLimit) {
            onSendMessage(trimmedMessage);
            setMessage('');
            adjustTextareaHeight();
        }
    }, [message, imagePreview, disabled, isUploading, isOverLimit, onSendMessage, onSendImage, adjustTextareaHeight]);

    // 处理键盘事件
    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        // 发送消息 (Enter)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }

        // 换行 (Shift + Enter)
        if (e.key === 'Enter' && e.shiftKey) {
            // 允许默认行为
            return;
        }

        // 清空输入 (Escape)
        if (e.key === 'Escape') {
            setMessage('');
            setImagePreview(null);
            adjustTextareaHeight();
        }

        // 表情符号选择器 (Ctrl/Cmd + E)
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            setIsEmojiPickerOpen(!isEmojiPickerOpen);
        }

        // 文件上传 (Ctrl/Cmd + U)
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            fileInputRef.current?.click();
        }
    }, [sendMessage, adjustTextareaHeight, isEmojiPickerOpen]);

    // 处理文件选择
    const handleFileSelect = useCallback(async (file: File) => {
        if (!enableImageUpload) return;

        try {
            const validation = validateImageFile(file);
            
            if (!validation.isValid) {
                setImagePreview({
                    file,
                    url: '',
                    isValid: false,
                    error: validation.error
                });
                return;
            }

            let processedFile = file;
            
            // 压缩图片
            if (compressImages) {
                try {
                    const compressedDataUrl = await compressImage(file, 2048, 0.8);
                    // Convert data URL back to File
                    const response = await fetch(compressedDataUrl);
                    const blob = await response.blob();
                    processedFile = new File([blob], file.name, { type: 'image/jpeg' });
                } catch (error) {
                    console.warn('图片压缩失败，使用原图:', error);
                }
            }

            const url = URL.createObjectURL(processedFile);
            setImagePreview({
                file: processedFile,
                url,
                isValid: true
            });
        } catch (error) {
            console.error('处理文件失败:', error);
            setImagePreview({
                file,
                url: '',
                isValid: false,
                error: '文件处理失败'
            });
        }
    }, [enableImageUpload, compressImages]);

    // 处理文件输入变化
    const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
        // 清空input值，允许选择相同文件
        e.target.value = '';
    }, [handleFileSelect]);

    // 处理拖拽
    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files);
        const imageFile = files.find(file => file.type.startsWith('image/'));
        
        if (imageFile) {
            handleFileSelect(imageFile);
        }
    }, [handleFileSelect]);

    // 处理表情符号选择
    const handleEmojiSelect = useCallback((emoji: string) => {
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newMessage = message.slice(0, start) + emoji + message.slice(end);
            setMessage(newMessage);
            
            // 设置光标位置
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + emoji.length, start + emoji.length);
            }, 0);
        }
        
        setIsEmojiPickerOpen(false);
        adjustTextareaHeight();
    }, [message, adjustTextareaHeight]);

    // 清除图片预览
    const clearImagePreview = useCallback(() => {
        if (imagePreview?.url) {
            URL.revokeObjectURL(imagePreview.url);
        }
        setImagePreview(null);
    }, [imagePreview]);

    // 点击外部关闭表情选择器
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                emojiPickerRef.current &&
                !emojiPickerRef.current.contains(event.target as Node) &&
                containerRef.current &&
                !containerRef.current.contains(event.target as Node)
            ) {
                setIsEmojiPickerOpen(false);
            }
        };

        if (isEmojiPickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isEmojiPickerOpen]);

    // 清理资源
    useEffect(() => {
        return () => {
            if (imagePreview?.url) {
                URL.revokeObjectURL(imagePreview.url);
            }
        };
    }, [imagePreview]);

    // 自动聚焦
    useEffect(() => {
        if (!disabled) {
            textareaRef.current?.focus();
        }
    }, [disabled]);

    return (
        <div
            ref={containerRef}
            className={`relative border-t border-gray-700 bg-gray-800 ${className}`}
        >
            {/* 回复消息显示 */}
            {replyingTo && (
                <div className="flex items-center justify-between p-3 bg-gray-700 border-b border-gray-600">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-blue-400">回复 {getReplySenderName(replyingTo)}</div>
                            <div className="text-sm text-gray-300 truncate">{getReplyMessageText(replyingTo)}</div>
                        </div>
                    </div>
                    {onCancelReply && (
                        <button
                            onClick={onCancelReply}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            )}

            {/* 图片预览 */}
            {imagePreview && (
                <div className="p-3 border-b border-gray-600">
                    <div className="relative inline-block">
                        {imagePreview.isValid ? (
                            <div className="relative">
                                <Image
                                    src={imagePreview.url}
                                    alt="预览"
                                    width={200}
                                    height={150}
                                    className="rounded-lg object-cover"
                                    style={{ maxHeight: '150px' }}
                                />
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                                        <div className="text-center">
                                            <LoadingSpinner size="sm" className="mb-2" />
                                            <div className="text-xs text-white">
                                                上传中... {uploadProgress}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 bg-red-900 border border-red-700 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <span className="text-red-200 text-sm">{imagePreview.error}</span>
                                </div>
                            </div>
                        )}
                        
                        <button
                            onClick={clearImagePreview}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-600 transition-colors"
                            disabled={isUploading}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* 拖拽覆盖层 */}
            {isDragOver && (
                <div className="absolute inset-0 bg-blue-600 bg-opacity-20 border-2 border-blue-400 border-dashed flex items-center justify-center z-10">
                    <div className="text-center">
                        <svg className="w-12 h-12 text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <div className="text-blue-400 font-medium">拖拽图片到这里</div>
                    </div>
                </div>
            )}

            {/* 主输入区域 */}
            <div
                className="flex items-end space-x-2 p-3"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* 工具按钮 */}
                <div className="flex space-x-1">
                    {/* 图片上传按钮 */}
                    {enableImageUpload && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={disabled || isUploading}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="上传图片"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>
                    )}

                    {/* 表情符号按钮 */}
                    {enableEmoji && (
                        <div className="relative">
                            <button
                                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                disabled={disabled}
                                className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="插入表情符号"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>

                            {/* 表情符号选择器 */}
                            {isEmojiPickerOpen && (
                                <div
                                    ref={emojiPickerRef}
                                    className="absolute bottom-full left-0 mb-2 w-64 max-h-64 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden z-50"
                                >
                                    <div className="max-h-64 overflow-y-auto">
                                        {EMOJI_CATEGORIES.map((category) => (
                                            <div key={category.name} className="p-2">
                                                <div className="text-xs text-gray-400 mb-2 font-medium">
                                                    {category.name}
                                                </div>
                                                <div className="grid grid-cols-8 gap-1">
                                                    {category.emojis.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => handleEmojiSelect(emoji)}
                                                            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded transition-colors"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 文本输入区域 */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleMessageChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled || isUploading}
                        rows={1}
                        className={`w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isOverLimit ? 'border-red-500' : ''
                        }`}
                        style={{ minHeight: '40px', maxHeight: '120px' }}
                    />
                    
                    {/* 字符计数 */}
                    {characterCount > 0 && (
                        <div className={`absolute bottom-1 right-2 text-xs ${
                            isOverLimit ? 'text-red-400' : 'text-gray-400'
                        }`}>
                            {characterCount}/{maxLength}
                        </div>
                    )}
                </div>

                {/* 发送按钮 */}
                <Button
                    onClick={sendMessage}
                    disabled={disabled || isUploading || (!message.trim() && !imagePreview?.isValid) || isOverLimit}
                    size="sm"
                    className="px-4 py-2"
                >
                    {isUploading ? (
                        <LoadingSpinner size="sm" />
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    )}
                </Button>
            </div>

            {/* 隐藏的文件输入 */}
            <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_IMAGE_FORMATS.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
            />

            {/* 快捷键提示 */}
            <div className="px-3 pb-2">
                <div className="text-xs text-gray-500">
                    Enter 发送 • Shift+Enter 换行 • Ctrl+E 表情 • Ctrl+U 上传
                </div>
            </div>
        </div>
    );
}

export default MessageInput;