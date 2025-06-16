'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '../ui/Button';

interface MessageInputProps {
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
    className?: string;
}

export function MessageInput({
    onSendMessage,
    onSendImage,
    placeholder = '输入消息...',
    maxLength = 1000,
    disabled = false,
    className = ''
}: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSendMessage = useCallback(async () => {
        if (!message.trim() || disabled) return;

        try {
            await onSendMessage(message.trim());
            setMessage('');
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [message, onSendMessage, disabled]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    const handleImageUpload = useCallback(async (file: File) => {
        if (!file || disabled) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            console.error('只能上传图片文件');
            return;
        }

        // 验证文件大小 (10MB)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('图片文件大小不能超过 10MB');
            return;
        }

        setIsUploading(true);
        try {
            await onSendImage(file);
        } catch (error) {
            console.error('发送图片失败:', error);
        } finally {
            setIsUploading(false);
        }
    }, [onSendImage, disabled]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
        // 清除文件输入，允许重复选择同一文件
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [handleImageUpload]);

    const triggerFileSelect = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            // 检查是否为图片文件
            if (item.type.startsWith('image/')) {
                e.preventDefault(); // 阻止默认粘贴行为
                
                const file = item.getAsFile();
                if (file) {
                    console.log('检测到粘贴的图片:', file.name, file.type, file.size);
                    handleImageUpload(file);
                }
                break; // 只处理第一个图片
            }
        }
    }, [handleImageUpload]);

    // 处理拖拽事件
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        if (file.type.startsWith('image/')) {
            console.log('检测到拖拽的图片:', file.name, file.type, file.size);
            handleImageUpload(file);
        }
    }, [handleImageUpload]);

    // 自动调整输入框高度
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = '40px';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
    }, []);

    useEffect(() => {
        adjustTextareaHeight();
    }, [message, adjustTextareaHeight]);

    return (
        <div className={`flex items-end space-x-2 p-2 lg:p-0 ${className}`}>
            {/* 隐藏的文件输入 */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isUploading}
            />

            {/* 图片上传按钮 */}
            <Button
                variant="ghost"
                size="sm"
                onClick={triggerFileSelect}
                disabled={disabled || isUploading}
                title="发送图片"
                className="flex-shrink-0 h-10 w-10 lg:h-10 lg:w-10 sm:h-12 sm:w-12 p-0 flex items-center justify-center"
            >
                {isUploading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                )}
            </Button>

            {/* 消息输入框容器 */}
            <div 
                className={`flex-1 relative ${dragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onPaste={handlePaste}
                    placeholder={dragOver ? '松开鼠标粘贴图片' : placeholder}
                    maxLength={maxLength}
                    disabled={disabled}
                    rows={1}
                    className={`
                        w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                        text-white placeholder-gray-400 resize-none
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        min-h-[40px] max-h-[120px] overflow-y-auto
                        text-base lg:text-sm
                        ${dragOver ? 'border-blue-500 bg-blue-900/20' : ''}
                    `}
                />
                
                {/* 拖拽提示遮罩 */}
                {dragOver && (
                    <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
                        <div className="text-blue-400 text-sm font-medium flex items-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            松开鼠标粘贴图片
                        </div>
                    </div>
                )}
            </div>

            {/* 发送按钮 */}
            <Button
                variant="primary"
                size="sm"
                onClick={handleSendMessage}
                disabled={!message.trim() || disabled}
                title="发送消息 (Enter)"
                className="flex-shrink-0 h-10 px-4 lg:h-10 lg:px-4 sm:h-12 sm:px-6 flex items-center justify-center"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </Button>

            {/* 上传状态提示 */}
            {isUploading && (
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                    正在上传图片...
                </div>
            )}
        </div>
    );
}