// 文件路径: app/room/components/CustomChat.tsx
// @/app/room/components/CustomChat.tsx
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useChat, ChatMessage } from '@/app/room/hooks/useChat';
import { MAX_IMAGE_SIZE } from '@/app/room/utils/imageUtils';
import ImagePreview from './ImagePreview';

/**
 * 自定义聊天组件的 UI 部分
 */
export function CustomChat() {
    const room = useRoomContext();
    const { messages, sendTextMessage, handleAndSendImage } = useChat(room);

    const [messageInput, setMessageInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 自动滚动到最新消息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 发送按钮点击事件
    const handleSendMessage = useCallback(() => {
        sendTextMessage(messageInput);
        setMessageInput('');
    }, [sendTextMessage, messageInput]);

    // 处理键盘事件（Enter发送）
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // 处理文件选择
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleAndSendImage(file);
        }
        e.target.value = ''; // 重置，以便可以再次选择相同的文件
    };

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const file = Array.from(e.clipboardData.items).find(item => item.type.startsWith('image/'))?.getAsFile();
        if (file) {
            e.preventDefault();
            handleAndSendImage(file);
        }
    }, [handleAndSendImage]);

    // 处理拖拽事件
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) {
            handleAndSendImage(file);
        }
    }, [handleAndSendImage]);

    // 渲染单个消息
    const renderMessage = (msg: ChatMessage) => (
        <div key={msg.id} className="break-words">
            <div className="text-xs text-gray-400 mb-1">
                <span className="font-medium text-blue-400">{msg.user}</span>
                <span className="ml-2">{msg.timestamp.toLocaleTimeString()}</span>
            </div>
            {msg.type === 'text' ? (
                <div className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3 whitespace-pre-wrap">
                    {msg.text}
                </div>
            ) : (
                <div className="bg-gray-800/50 rounded-lg p-2 max-w-xs relative">
                    <img
                        src={msg.image}
                        alt="聊天图片"
                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-80 transition-opacity"
                        onDoubleClick={() => setPreviewImage(msg.image!)}
                        style={{ maxHeight: '200px' }}
                        title="双击全屏查看"
                    />
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
                </div>
            )}
        </div>
    );

    return (
        <div className="flex flex-col h-full" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            {/* 拖拽覆盖层 */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
                    {/* ... SVG 和提示文字 ... */}
                </div>
            )}

            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        {/* ... 空状态提示 ... */}
                    </div>
                ) : (
                    messages.map(renderMessage)
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="border-t border-gray-700 p-4 flex-shrink-0">
                <div className="flex gap-2">
                    <textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onPaste={handlePaste}
                        placeholder="输入消息..."
                        // ... 其他属性 ...
                    />
                    {/* ... 图片上传和发送按钮 ... */}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                <div className="text-xs text-gray-500 mt-2">Enter 发送，支持粘贴/拖拽图片</div>
            </div>

            {/* 图片预览 */}
            {previewImage && <ImagePreview src={previewImage} onClose={() => setPreviewImage(null)} />}
        </div>
    );
}