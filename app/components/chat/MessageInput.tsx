'use client';

import React, { useState, useRef, useCallback } from 'react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    return (
        <div className={`flex items-end space-x-2 ${className}`}>
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
                className="flex-shrink-0 h-10 w-10 p-0 flex items-center justify-center"
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

            {/* 消息输入框 */}
            <div className="flex-1">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    maxLength={maxLength}
                    disabled={disabled}
                    rows={1}
                    className="
                        w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg 
                        text-white placeholder-gray-400 resize-none
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        min-h-[40px] max-h-[120px] overflow-y-auto
                    "
                    style={{
                        height: '40px',
                        lineHeight: '1.5'
                    }}
                    onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = '40px';
                        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                    }}
                />
            </div>

            {/* 发送按钮 */}
            <Button
                variant="primary"
                size="sm"
                onClick={handleSendMessage}
                disabled={!message.trim() || disabled}
                title="发送消息"
                className="flex-shrink-0 h-10 px-4 flex items-center justify-center"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </Button>
        </div>
    );
}