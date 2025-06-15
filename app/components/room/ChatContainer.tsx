'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DisplayMessage, DragState } from '../../types/chat';
import { formatDisplayTime, handlePasteEvent, extractImageFromDrop, isDragEventWithFiles, scrollToBottom, shouldAutoScroll } from '../../utils/chatUtils';
import { ImageChunkManager } from '../../lib/managers/ImageChunkManager';
import { useRoomContext } from '@livekit/components-react';

interface ChatContainerProps {
    messages: DisplayMessage[];
    onSendMessage: (message: string) => Promise<void>;
    onSendImage: (file: File) => Promise<void>;
    onImagePreview: (imageSrc: string) => void;
    onNewMessage?: () => void;
    maxImageSizeMB?: number;
    className?: string;
}

export function ChatContainer({ 
    messages, 
    onSendMessage, 
    onSendImage, 
    onImagePreview,
    onNewMessage,
    maxImageSizeMB = 10,
    className = ""
}: ChatContainerProps) {
    const [message, setMessage] = useState('');
    const [dragState, setDragState] = useState<DragState>(DragState.NONE);
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (isScrolledToBottom) {
            scrollToBottom(messagesContainerRef.current);
        }
    }, [messages, isScrolledToBottom]);

    // 监听滚动事件
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (container) {
            const isAtBottom = shouldAutoScroll(container, 50);
            setIsScrolledToBottom(isAtBottom);
        }
    }, []);

    // 处理消息发送
    const handleSendMessage = useCallback(async () => {
        if (!message.trim()) return;
        
        try {
            await onSendMessage(message.trim());
            setMessage('');
            
            // 重置文本域高度
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (error) {
            console.error('发送消息失败:', error);
        }
    }, [message, onSendMessage]);

    // 处理键盘事件
    const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // 处理图片文件
    const handleImageFile = useCallback(async (file: File) => {
        // 本地图片验证
        const maxSizeBytes = maxImageSizeMB * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            alert(`图片文件过大，请选择小于 ${maxImageSizeMB}MB 的图片`);
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            alert('请选择有效的图片文件');
            return;
        }

        try {
            await onSendImage(file);
        } catch (error) {
            console.error('发送图片失败:', error);
            alert('发送图片失败，请重试');
        }
    }, [onSendImage, maxImageSizeMB]);

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const handled = handlePasteEvent(
            e.nativeEvent,
            handleImageFile,
            (text) => {
                setMessage(prev => prev + text);
            }
        );
        
        if (handled) {
            e.preventDefault();
        }
    }, [handleImageFile]);

    // 处理拖拽事件
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        if (isDragEventWithFiles(e.nativeEvent) && dragState !== DragState.DRAGGING_IMAGE) {
            setDragState(DragState.DRAGGING_FILE);
        }
    }, [dragState]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        // 只有当拖拽离开容器时才隐藏提示
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
            setDragState(DragState.NONE);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragState(DragState.NONE);
        
        if (dragState === DragState.DRAGGING_IMAGE) {
            return; // 不允许图片拖回聊天框
        }
        
        const imageFile = extractImageFromDrop(e.nativeEvent);
        if (imageFile) {
            handleImageFile(imageFile);
        }
    }, [dragState, handleImageFile]);

    // 处理聊天图片拖拽
    const handleImageDragStart = useCallback(() => {
        setDragState(DragState.DRAGGING_IMAGE);
    }, []);

    const handleImageDragEnd = useCallback(() => {
        setDragState(DragState.NONE);
    }, []);

    // 处理文本域自动调整高度
    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        
        // 自动调整高度
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    }, []);

    // 渲染消息项
    const renderMessage = useCallback((msg: DisplayMessage) => (
        <div key={msg.id} className="break-words">
            {/* 消息头部 */}
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span className="font-medium text-blue-400">{msg.user}</span>
                <span>{formatDisplayTime(msg.timestamp)}</span>
            </div>
            
            {/* 消息内容 */}
            {msg.type === 'text' ? (
                <div className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3">
                    {msg.text}
                </div>
            ) : (
                <div className="bg-gray-800/50 rounded-lg p-2 max-w-xs relative">
                    <img
                        src={msg.image}
                        alt="聊天图片"
                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onDoubleClick={() => onImagePreview(msg.image!)}
                        onDragStart={handleImageDragStart}
                        onDragEnd={handleImageDragEnd}
                        style={{ maxHeight: '200px' }}
                        title="双击全屏查看，可拖拽到聊天框外部"
                        draggable={true}
                    />
                    
                    {/* 发送进度显示 */}
                    {msg.sending && (
                        <div className="absolute inset-0 bg-black/50 rounded flex items-center justify-center">
                            <div className="text-center text-white">
                                <div className="w-20 h-2 bg-gray-600 rounded-full mb-2">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${msg.progress || 0}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs">发送中 {Math.round(msg.progress || 0)}%</div>
                            </div>
                        </div>
                    )}
                    
                    {/* 发送失败显示 */}
                    {msg.failed && (
                        <div className="absolute inset-0 bg-red-500/20 rounded flex items-center justify-center">
                            <div className="text-center text-red-400">
                                <svg className="w-6 h-6 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div className="text-xs">发送失败</div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    ), [onImagePreview, handleImageDragStart, handleImageDragEnd]);

    return (
        <div 
            ref={containerRef}
            className={`flex flex-col h-full ${className}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* 拖拽覆盖层 */}
            {dragState === DragState.DRAGGING_FILE && (
                <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center text-blue-400">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                        <p className="text-lg font-medium">拖拽图片到这里发送</p>
                        <p className="text-sm opacity-75">支持最大 {maxImageSizeMB}MB 的图片文件</p>
                    </div>
                </div>
            )}

            {/* 图片拖拽提示 */}
            {dragState === DragState.DRAGGING_IMAGE && (
                <div className="absolute inset-0 bg-red-500/20 border-2 border-dashed border-red-500 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center text-red-400">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <p className="text-lg font-medium">不能拖回聊天框</p>
                        <p className="text-sm opacity-75">请拖拽到聊天框外部</p>
                    </div>
                </div>
            )}

            {/* 消息列表 */}
            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
                onScroll={handleScroll}
            >
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p className="text-sm">还没有消息，开始聊天吧！</p>
                        <p className="text-xs mt-2 text-gray-500">
                            支持发送文字和图片（最大{maxImageSizeMB}MB）
                        </p>
                    </div>
                ) : (
                    messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 未读消息提示 */}
            {!isScrolledToBottom && (
                <div className="px-4 py-2">
                    <button
                        onClick={() => {
                            setIsScrolledToBottom(true);
                            scrollToBottom(messagesContainerRef.current);
                        }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                    >
                        滚动到最新消息
                    </button>
                </div>
            )}

            {/* 输入区域 */}
            <div className="border-t border-gray-700 p-4 flex-shrink-0">
                <div className="flex gap-2">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleTextareaChange}
                        onKeyPress={handleKeyPress}
                        onPaste={handlePaste}
                        placeholder="输入消息..."
                        className="flex-1 resize-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        rows={1}
                        style={{
                            minHeight: '38px',
                            maxHeight: '80px'
                        }}
                    />
                    
                    {/* 图片上传按钮 */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex-shrink-0 self-end"
                        title={`发送图片 (最大${maxImageSizeMB}MB)`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                    </button>

                    {/* 发送按钮 */}
                    <button
                        onClick={handleSendMessage}
                        disabled={!message.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22,2 15,22 11,13 2,9"></polygon>
                        </svg>
                    </button>
                </div>
                
                {/* 隐藏的文件输入 */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                            handleImageFile(file);
                        }
                        e.target.value = '';
                    }}
                    className="hidden"
                />
                
                {/* 提示文字 */}
                <div className="text-xs text-gray-500 mt-2">
                    Enter 发送，支持粘贴/拖拽图片
                </div>
            </div>
        </div>
    );
}