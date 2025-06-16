'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { 
    DisplayMessage, 
    ChatMessage, 
    ChatState, 
    ImageChunk,
    MessageType 
} from '../types/chat';
import { 
    createTextMessage, 
    createImageMessage,
    convertToDisplayMessage,
    parseChatData,
    validateMessage,
    limitMessages,
    sendImageInChunks
} from '../utils/chatUtils';
import { compressImage, validateImageFile } from '../utils/imageUtils';
import { ImageChunkManager } from '../lib/managers/ImageChunkManager';

interface UseChatOptions {
    maxMessages?: number;
    maxImageSizeMB?: number;
    enableSounds?: boolean;
    autoScrollToBottom?: boolean;
}

interface UseChatReturn {
    chatState: ChatState;
    sendTextMessage: (message: string) => Promise<void>;
    sendImageMessage: (file: File) => Promise<void>;
    toggleChat: () => void;
    clearUnreadCount: () => void;
    clearMessages: () => void;
    retryMessage: (messageId: string) => Promise<void>;
    deleteMessage: (messageId: string) => void;
    markAsRead: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
    const {
        maxMessages = 100,
        maxImageSizeMB = 10,
        enableSounds = true,
        autoScrollToBottom = true
    } = options;

    // 状态
    const [chatState, setChatState] = useState<ChatState>({
        messages: [],
        isOpen: false,
        unreadCount: 0,
        isDragging: false,
        isImageDragging: false
    });

    // 添加标记已读功能
    const markAsRead = useCallback(() => {
        setChatState(prev => ({
            ...prev,
            unreadCount: 0
        }));
    }, []);
    
    // Refs
    const imageChunkManagerRef = useRef<ImageChunkManager | null>(null);
    const pendingMessagesRef = useRef<Map<string, DisplayMessage>>(new Map());
    const isMountedRef = useRef(true);

    // 获取 room context（可能为 null）
    const room = useRoomContext();

    // 更新聊天状态的辅助函数
    const updateChatState = useCallback((updates: Partial<ChatState>) => {
        if (!isMountedRef.current) return;
        setChatState(prev => ({ ...prev, ...updates }));
    }, []);

    // 添加消息到状态
    const addMessage = useCallback((message: DisplayMessage) => {
        setChatState((prev: ChatState) => ({
            ...prev,
            messages: limitMessages([...prev.messages, message], maxMessages),
            unreadCount: prev.isOpen ? prev.unreadCount : prev.unreadCount + 1
        }));
    }, [maxMessages]);

    // 更新消息状态
    const updateMessage = useCallback((messageId: string, updates: Partial<DisplayMessage>) => {
        setChatState((prev: ChatState) => ({
            ...prev,
            messages: prev.messages.map((msg: DisplayMessage) => 
                msg.id === messageId ? { ...msg, ...updates } : msg
            )
        }));
    }, []);

    // 初始化图片分片管理器
    useEffect(() => {
        const handleImageComplete = (id: string, imageData: string, user: string) => {
            const displayMessage: DisplayMessage = {
                id,
                user,
                image: imageData,
                timestamp: new Date(),
                type: 'image' as MessageType
            };
            
            addMessage(displayMessage);
        };

        const handleImageProgress = (id: string, progress: number) => {
            console.log(`图片接收进度: ${id} - ${progress}%`);
        };

        const handleImageError = (id: string, error: string) => {
            console.error(`图片接收失败: ${id}`, error);
        };

        imageChunkManagerRef.current = new ImageChunkManager(
            handleImageComplete,
            {
                maxPendingImages: 5,
                chunkTimeout: 30000,
                cleanupInterval: 5000,
                maxImageAge: 60000
            }
        );

        imageChunkManagerRef.current.setProgressCallback(handleImageProgress);
        imageChunkManagerRef.current.setErrorCallback(handleImageError);

        return () => {
            imageChunkManagerRef.current?.cleanup();
        };
    }, [addMessage]);

    // 监听房间数据（只有在 room 存在时）
    useEffect(() => {
        if (!room) return;

        const handleDataReceived = (data: Uint8Array, participant?: any) => {
            try {
                const chatMessage = parseChatData(data);
                if (!chatMessage) return;

                const user = participant?.identity || '未知用户';

                switch (chatMessage.type) {
                    case 'chat':
                        const textMessage = convertToDisplayMessage(chatMessage, user);
                        addMessage(textMessage);
                        break;

                    case 'image':
                        const imageMessage = convertToDisplayMessage(chatMessage, user);
                        addMessage(imageMessage);
                        break;

                    case 'image_chunk':
                        if (imageChunkManagerRef.current && chatMessage.chunk) {
                            imageChunkManagerRef.current.handleChunk(chatMessage.chunk, user);
                        }
                        break;

                    default:
                        console.warn('未知的消息类型:', (chatMessage as any).type);
                }
            } catch (error) {
                console.error('处理聊天消息失败:', error);
            }
        };

        room.on('dataReceived', handleDataReceived);

        return () => {
            room.off('dataReceived', handleDataReceived);
        };
    }, [room, addMessage]);

    // 发送文本消息
    const sendTextMessage = useCallback(async (messageText: string) => {
        if (!room?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const validation = validateMessage(messageText);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 创建待发送的消息显示
        const displayMessage: DisplayMessage = {
            id: messageId,
            user: '你',
            text: messageText,
            timestamp: new Date(),
            type: 'text',
            sending: true
        };

        addMessage(displayMessage);
        pendingMessagesRef.current.set(messageId, displayMessage);

        try {
            const chatMessage = createTextMessage(messageText);
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(chatMessage));

            await room.localParticipant.publishData(data, { reliable: true });

            // 更新为发送成功
            updateMessage(messageId, { sending: false });
            pendingMessagesRef.current.delete(messageId);

        } catch (error) {
            console.error('发送文本消息失败:', error);
            
            // 更新为发送失败
            updateMessage(messageId, { 
                sending: false, 
                failed: true 
            });

            throw error;
        }
    }, [room, addMessage, updateMessage]);

    // 发送图片消息
    const sendImageMessage = useCallback(async (file: File) => {
        if (!room?.localParticipant) {
            throw new Error('未连接到房间');
        }

        const validation = validateImageFile(file, maxImageSizeMB);
        if (!validation.isValid) {
            throw new Error(validation.error);
        }

        const messageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        try {
            // 压缩图片
            const compressedImage = await compressImage(file, 2048, 0.8);
            
            // 创建待发送的消息显示
            const displayMessage: DisplayMessage = {
                id: messageId,
                user: '你',
                image: compressedImage,
                timestamp: new Date(),
                type: 'image',
                sending: true,
                progress: 0
            };

            addMessage(displayMessage);
            pendingMessagesRef.current.set(messageId, displayMessage);

            // 发送图片分片
            await sendImageInChunks(
                room,
                compressedImage,
                60000,
                (progress) => {
                    updateMessage(messageId, { progress });
                }
            );

            // 更新为发送成功
            updateMessage(messageId, { 
                sending: false, 
                progress: 100 
            });
            pendingMessagesRef.current.delete(messageId);

        } catch (error) {
            console.error('发送图片消息失败:', error);
            
            // 更新为发送失败
            updateMessage(messageId, { 
                sending: false, 
                failed: true,
                progress: 0
            });

            throw error;
        }
    }, [room, maxImageSizeMB, addMessage, updateMessage]);

    // 重试发送消息
    const retryMessage = useCallback(async (messageId: string) => {
        const message = chatState.messages.find(msg => msg.id === messageId);
        if (!message || !message.failed) {
            return;
        }

        try {
            if (message.type === 'text' && message.text) {
                updateMessage(messageId, { 
                    sending: true, 
                    failed: false 
                });

                await sendTextMessage(message.text);
            } else if (message.type === 'image') {
                updateMessage(messageId, { 
                    sending: true, 
                    failed: false,
                    progress: 0
                });

                throw new Error('图片消息重试需要重新选择文件');
            }
        } catch (error) {
            updateMessage(messageId, { 
                sending: false, 
                failed: true 
            });
            throw error;
        }
    }, [chatState.messages, updateMessage, sendTextMessage]);

    // 删除消息
    const deleteMessage = useCallback((messageId: string) => {
        setChatState((prev: ChatState) => ({
            ...prev,
            messages: prev.messages.filter((msg: DisplayMessage) => msg.id !== messageId)
        }));
        
        pendingMessagesRef.current.delete(messageId);
    }, []);

    // 切换聊天窗口
    const toggleChat = useCallback(() => {
        setChatState((prev: ChatState) => ({
            ...prev,
            isOpen: !prev.isOpen,
            unreadCount: !prev.isOpen ? 0 : prev.unreadCount
        }));
    }, []);

    // 清除未读计数
    const clearUnreadCount = useCallback(() => {
        updateChatState({ unreadCount: 0 });
    }, [updateChatState]);

    // 清除所有消息
    const clearMessages = useCallback(() => {
        updateChatState({ 
            messages: [],
            unreadCount: 0
        });
        pendingMessagesRef.current.clear();
    }, [updateChatState]);

    // 清理
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        chatState,
        sendTextMessage,
        sendImageMessage,
        toggleChat,
        clearUnreadCount,
        clearMessages,
        retryMessage,
        deleteMessage,
        markAsRead
    };
}