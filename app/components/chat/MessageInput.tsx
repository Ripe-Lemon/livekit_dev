'use client';

import React, { useState, useRef, useCallback } from 'react';

interface MessageInputProps {
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
    showEmojiPicker?: boolean;
    showImageUpload?: boolean;
    className?: string;
}

export function MessageInput({
    onSendMessage,
    onSendImage,
    placeholder = "输入消息...",
    maxLength = 1000,
    disabled = false,
    showEmojiPicker = true,
    showImageUpload = true,
    className = ''
}: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!message.trim() || isLoading || disabled) return;

        const messageToSend = message.trim();
        setMessage('');
        setIsLoading(true);

        try {
            await onSendMessage(messageToSend);
        } catch (error) {
            console.error('发送消息失败:', error);
            setMessage(messageToSend); // 恢复消息内容
        } finally {
            setIsLoading(false);
        }
    }, [message, isLoading, disabled, onSendMessage]);

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        // 验证文件大小（10MB）
        if (file.size > 10 * 1024 * 1024) {
            alert('图片文件不能超过10MB');
            return;
        }

        setIsLoading(true);
        onSendImage(file)
            .catch(error => {
                console.error('发送图片失败:', error);
                alert('发送图片失败');
            })
            .finally(() => {
                setIsLoading(false);
            });

        // 清空文件输入
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onSendImage]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    }, [handleSubmit]);

    return (
        <form onSubmit={handleSubmit} className={`flex items-end space-x-2 ${className}`}>
            {/* 图片上传按钮 */}
            {showImageUpload && (
                <div className="flex-shrink-0">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={disabled || isLoading}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isLoading}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                        title="发送图片"
                    >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
            )}

            {/* 消息输入框 */}
            <div className="flex-1 relative">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    disabled={disabled || isLoading}
                    rows={1}
                    className="w-full min-h-[40px] max-h-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ 
                        height: '40px',
                        overflowY: message.length > 50 ? 'auto' : 'hidden'
                    }}
                />
                
                {/* 字符计数 */}
                {maxLength && (
                    <div className="absolute bottom-1 right-2 text-xs text-gray-500">
                        {message.length}/{maxLength}
                    </div>
                )}
            </div>

            {/* 发送按钮 */}
            <div className="flex-shrink-0">
                <button
                    type="submit"
                    disabled={!message.trim() || isLoading || disabled}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    title="发送消息"
                >
                    {isLoading ? (
                        <svg className="w-4 h-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    )}
                </button>
            </div>
        </form>
    );
}