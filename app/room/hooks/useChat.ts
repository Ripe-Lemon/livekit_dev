// 文件路径: app/room/hooks/useChat.ts
// @/app/room/hooks/useChat.ts
'use client';

import { Room } from 'livekit-client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ImageChunkManager,
    compressImage,
    sendImageInChunks,
    MAX_IMAGE_SIZE,
} from '@/app/room/utils/imageUtils';

export interface ChatMessage {
    id: string;
    user: string;
    text?: string;
    image?: string;
    timestamp: Date;
    type: 'text' | 'image';
    sending?: boolean;
    progress?: number;
}

/**
 * 自定义 Hook，封装聊天功能的所有逻辑。
 * @param room - LiveKit Room 实例
 * @returns - 聊天状态和操作函数
 */
export function useChat(room: Room) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const chunkManagerRef = useRef<ImageChunkManager | null>(null);

    // 初始化图片分片管理器
    useEffect(() => {
        const handleImageComplete = (id: string, imageData: string, user: string) => {
            setMessages(prev => {
                const newMessages = [...prev, {
                    id,
                    user,
                    image: imageData,
                    timestamp: new Date(),
                    type: 'image' as const
                }];
                // 触发新消息事件，供悬浮窗提示使用
                window.dispatchEvent(new CustomEvent('newChatMessage'));
                return newMessages.slice(-100); // 最多保留100条消息
            });
        };

        chunkManagerRef.current = new ImageChunkManager(handleImageComplete);

        return () => {
            chunkManagerRef.current?.cleanup();
        };
    }, []);

    // 监听 LiveKit 的数据通道消息
    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            const decoder = new TextDecoder();
            const messageStr = decoder.decode(payload);
            const userName = participant?.name || participant?.identity || '未知用户';

            try {
                const msg = JSON.parse(messageStr);
                if (msg.type === 'chat') {
                    setMessages(prev => {
                        const newMessages = [...prev, {
                            id: Date.now().toString(),
                            user: userName,
                            text: msg.message,
                            timestamp: new Date(),
                            type: 'text' as const
                        }];
                        window.dispatchEvent(new CustomEvent('newChatMessage'));
                        return newMessages.slice(-100);
                    });
                } else if (msg.type === 'image_chunk') {
                    chunkManagerRef.current?.handleChunk(msg, userName);
                }
            } catch (e) {
                console.error('解析聊天消息失败:', e);
            }
        };

        room.on('dataReceived', handleDataReceived);
        return () => {
            room.off('dataReceived', handleDataReceived);
        };
    }, [room]);

    // 发送文本消息
    const sendTextMessage = useCallback(async (message: string) => {
        if (!message.trim()) return;

        const chatMessage = { type: 'chat', message: message.trim() };
        const data = new TextEncoder().encode(JSON.stringify(chatMessage));

        try {
            await room.localParticipant.publishData(data, { reliable: true });
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                user: '我',
                text: message.trim(),
                timestamp: new Date(),
                type: 'text' as const
            }].slice(-100));
        } catch (e) {
            console.error('发送消息失败:', e);
        }
    }, [room]);

    // 处理并发送图片文件
    const handleAndSendImage = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            alert(`图片文件大小不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
            return;
        }

        const tempId = Date.now().toString();
        try {
            const compressedBase64 = await compressImage(file);
            // 添加一个临时的本地消息，用于显示上传进度
            setMessages(prev => [...prev, {
                id: tempId,
                user: '我',
                image: compressedBase64,
                timestamp: new Date(),
                type: 'image' as const,
                sending: true,
                progress: 0
            }]);

            // 分片发送
            await sendImageInChunks(room, compressedBase64, (progress) => {
                setMessages(prev => prev.map(msg =>
                    msg.id === tempId ? { ...msg, progress } : msg
                ));
            });

            // 发送完成，更新UI
            setMessages(prev => prev.map(msg =>
                msg.id === tempId ? { ...msg, sending: false, progress: 100 } : msg
            ));

        } catch (error) {
            console.error('处理或发送图片失败:', error);
            alert('发送图片失败，请重试');
            // 移除失败的临时消息
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
        }
    }, [room]);

    return { messages, sendTextMessage, handleAndSendImage };
}