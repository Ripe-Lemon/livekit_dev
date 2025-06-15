// 文件路径: app/room/page.tsx
'use client';

import {
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    RoomContext,
    useRoomContext,
    Chat, LayoutContextProvider, // 导入 Chat 组件
} from '@livekit/components-react';
import {
    Room,
    Track,
    createLocalAudioTrack,
    AudioPresets,
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// =======================================================================
//     ↓↓↓ 修改点: 将音频控制组件重构为 ControlBar 的一部分 ↓↓↓
// =======================================================================
interface AudioProcessingControlsProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => void;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => void;
}

// 自定义音频控制按钮 (不再是悬浮组件)
function AudioProcessingControls({
                                     isNoiseSuppressionEnabled,
                                     onToggleNoiseSuppression,
                                     isEchoCancellationEnabled,
                                     onToggleEchoCancellation,
                                 }: AudioProcessingControlsProps) {
    // 按钮的基础样式 (适配 ControlBar)
    const baseButtonStyles = "lk-button";
    // 激活状态的样式
    const enabledStyles = "lk-button-primary";

    return (
        <>
            <button
                onClick={onToggleNoiseSuppression}
                className={`${baseButtonStyles} ${isNoiseSuppressionEnabled ? enabledStyles : ''}`}
            >
                降噪 {isNoiseSuppressionEnabled ? '开' : '关'}
            </button>
            <button
                onClick={onToggleEchoCancellation}
                className={`${baseButtonStyles} ${isEchoCancellationEnabled ? enabledStyles : ''}`}
            >
                回声消除 {isEchoCancellationEnabled ? '开' : '关'}
            </button>
        </>
    );
}

// 房间信息
function RoomInfo() {
    const room = useRoomContext();
    const [participantCount, setParticipantCount] = useState(room.numParticipants);

    // 监听参与者加入和离开事件
    useEffect(() => {
        const updateParticipantCount = () => {
            setParticipantCount(room.numParticipants);
        };

        // 监听参与者连接事件
        const handleParticipantConnected = () => {
            updateParticipantCount();
        };

        // 监听参与者断开连接事件
        const handleParticipantDisconnected = () => {
            updateParticipantCount();
        };

        // 添加事件监听器
        room.on('participantConnected', handleParticipantConnected);
        room.on('participantDisconnected', handleParticipantDisconnected);

        // 初始化时更新一次
        updateParticipantCount();

        // 清理事件监听器
        return () => {
            room.off('participantConnected', handleParticipantConnected);
            room.off('participantDisconnected', handleParticipantDisconnected);
        };
    }, [room]);

    return (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800/60 text-white">
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                <span className="text-sm font-medium">{room.name}</span>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="m22 21-2-2"/>
                    <circle cx="16" cy="11" r="3"/>
                </svg>
                <span className="text-sm font-medium">{room.numParticipants}</span>
            </div>
        </div>
    );
}

// 图片压缩函数
function compressImage(file: File, maxSizeKB: number = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // 计算合适的尺寸，保持宽高比
            let { width, height } = img;
            const maxDimension = 1920; // 最大尺寸
            
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = (height * maxDimension) / width;
                    width = maxDimension;
                } else {
                    width = (width * maxDimension) / height;
                    height = maxDimension;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 绘制图片
            ctx?.drawImage(img, 0, 0, width, height);
            
            // 尝试不同的质量级别直到满足大小要求
            let quality = 0.9;
            let result = canvas.toDataURL('image/jpeg', quality);
            
            while (result.length > maxSizeKB * 1024 * 4/3 && quality > 0.1) { // base64大约比原文件大1/3
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }
            
            resolve(result);
        };
        
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

// 图片放大预览组件
function ImagePreview({ src, onClose }: { src: string; onClose: () => void }) {
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [showScaleInfo, setShowScaleInfo] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const scaleTimeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (scaleTimeoutRef.current) {
                clearTimeout(scaleTimeoutRef.current);
            }
        };
    }, [onClose]);

    // 加载图片并获取原始尺寸
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
            
            // 计算初始缩放比例以适应屏幕
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            const scaleX = windowWidth / img.width;
            const scaleY = windowHeight / img.height;
            const initialScale = Math.min(scaleX, scaleY, 1); // 不超过原始大小
            
            setScale(initialScale);
        };
        img.src = src;
    }, [src]);

    const showScaleInfoTemporarily = () => {
        setShowScaleInfo(true);
        if (scaleTimeoutRef.current) {
            clearTimeout(scaleTimeoutRef.current);
        }
        scaleTimeoutRef.current = setTimeout(() => {
            setShowScaleInfo(false);
        }, 1500);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(scale * delta, 5));
        setScale(newScale);
        showScaleInfoTemporarily();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div 
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center overflow-hidden"
            onClick={onClose}
        >
            <div className="relative w-full h-full flex items-center justify-center">
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* 缩放提示 - 只在调整时显示 */}
                {showScaleInfo && (
                    <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-3 py-2 rounded-lg text-sm transition-opacity">
                        缩放: {Math.round(scale * 100)}%
                    </div>
                )}

                {/* 操作提示 */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm">
                    滚轮缩放 • 拖拽移动 • ESC 或点击关闭
                </div>

                {/* 图片容器 - 修复边界问题 */}
                <div 
                    className="relative overflow-visible"
                    style={{
                        width: '100vw',
                        height: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <img
                        src={src}
                        alt="预览图片"
                        className={`select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{
                            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                            transformOrigin: 'center center',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                            height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        draggable={false}
                    />
                </div>
            </div>
        </div>
    );
}

// 添加悬浮聊天组件
function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // 创建音频元素用于播放提示音
    useEffect(() => {
        // 创建一个简单的提示音
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const createNotificationSound = () => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        };

        audioRef.current = { play: createNotificationSound } as any;
    }, []);

    // 监听新消息事件
    useEffect(() => {
        const handleNewMessage = () => {
            // 播放提示音
            if (audioRef.current) {
                try {
                    audioRef.current.play();
                } catch (e) {
                    console.log('无法播放提示音:', e);
                }
            }

            // 如果悬浮窗关闭，增加未读数量
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };

        // 监听自定义事件
        window.addEventListener('newChatMessage', handleNewMessage);
        
        return () => {
            window.removeEventListener('newChatMessage', handleNewMessage);
        };
    }, [isOpen]);

    // 打开悬浮窗时清除未读数量
    const handleToggleChat = () => {
        if (!isOpen) {
            setUnreadCount(0);
        }
        setIsOpen(!isOpen);
    };

    return (
        <>
            {/* 悬浮聊天面板 */}
            <div
                className={`
                    fixed top-6 right-20 z-40 h-[500px] w-80 
                    transform transition-all duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
                `}
            >
                <div className="h-full rounded-lg bg-gray-900/95 backdrop-blur-sm shadow-2xl border border-gray-700 flex flex-col">
                    {/* 聊天头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                        <h3 className="text-lg font-medium text-white">聊天</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    {/* 聊天内容区域 - 使用自定义聊天组件 */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <CustomChat />
                    </div>
                </div>
            </div>

            {/* 聊天按钮 - 添加未读消息气泡 */}
            <div className="fixed top-6 right-6 z-50">
                <button
                    onClick={handleToggleChat}
                    className={`
                        flex h-12 w-12 items-center justify-center 
                        rounded-full shadow-lg backdrop-blur-sm transition-all
                        ${isOpen 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-black/60 text-white hover:bg-black/80 hover:scale-105'
                        }
                    `}
                    aria-label={isOpen ? "关闭聊天" : "打开聊天"}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>

                {/* 未读消息气泡 */}
                {unreadCount > 0 && !isOpen && (
                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                )}
            </div>
        </>
    );
}

// 自定义聊天组件
function CustomChat() {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Array<{
        id: string;
        user: string;
        text?: string;
        image?: string;
        timestamp: Date;
        type: 'text' | 'image';
    }>>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const room = useRoomContext();

    // 滚动到最新消息
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 处理图片文件
    const handleImageFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        if (file.size > 20 * 1024 * 1024) { // 20MB 原始文件限制
            alert('图片文件大小不能超过 20MB');
            return;
        }

        try {
            // 压缩图片
            const compressedBase64 = await compressImage(file, 1024); // 压缩到约1MB
            
            const chatMessage = {
                type: 'image',
                image: compressedBase64,
                timestamp: Date.now()
            };

            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(chatMessage));
            
            try {
                await room.localParticipant.publishData(data, { reliable: true });
                
                // 添加自己的图片消息到本地显示
                setMessages(prev => {
                    const newMessages = [...prev, {
                        id: Date.now().toString(),
                        user: '我',
                        image: compressedBase64,
                        timestamp: new Date(),
                        type: 'image' as const
                    }];
                    return newMessages.slice(-100);
                });
            } catch (e) {
                console.error('发送图片失败:', e);
                alert('发送图片失败，可能是图片太大');
            }
        } catch (error) {
            console.error('处理图片失败:', error);
            alert('处理图片失败，请尝试其他图片');
        }
    }, [room]);

    // 监听聊天消息 - 支持图片消息
    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            const decoder = new TextDecoder();
            const message = decoder.decode(payload);
            
            try {
                const chatMessage = JSON.parse(message);
                if (chatMessage.type === 'chat') {
                    setMessages(prev => {
                        const newMessages = [...prev, {
                            id: Date.now().toString(),
                            user: participant?.name || participant?.identity || '未知用户',
                            text: chatMessage.message,
                            timestamp: new Date(),
                            type: 'text' as const
                        }];
                        
                        // 触发新消息事件
                        const event = new CustomEvent('newChatMessage');
                        window.dispatchEvent(event);
                        
                        return newMessages.slice(-100);
                    });
                } else if (chatMessage.type === 'image') {
                    setMessages(prev => {
                        const newMessages = [...prev, {
                            id: Date.now().toString(),
                            user: participant?.name || participant?.identity || '未知用户',
                            image: chatMessage.image,
                            timestamp: new Date(),
                            type: 'image' as const
                        }];
                        
                        // 触发新消息事件
                        const event = new CustomEvent('newChatMessage');
                        window.dispatchEvent(event);
                        
                        return newMessages.slice(-100);
                    });
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

    // 处理粘贴事件
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
                break;
            }
        }
    }, [handleImageFile]);

    // 处理拖拽事件
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            handleImageFile(file);
        }
    }, [handleImageFile]);

    // 发送文本消息
    const sendMessage = useCallback(async () => {
        if (!message.trim()) return;

        const chatMessage = {
            type: 'chat',
            message: message.trim(),
            timestamp: Date.now()
        };

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(chatMessage));
        
        try {
            await room.localParticipant.publishData(data, { reliable: true });
            
            // 添加自己的消息到本地显示
            setMessages(prev => {
                const newMessages = [...prev, {
                    id: Date.now().toString(),
                    user: '我',
                    text: message.trim(),
                    timestamp: new Date(),
                    type: 'text' as const
                }];
                return newMessages.slice(-100);
            });
            
            setMessage('');
        } catch (e) {
            console.error('发送消息失败:', e);
        }
    }, [message, room]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div 
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* 拖拽覆盖层 */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center text-blue-400">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto mb-2"
                        >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                        <p className="text-lg font-medium">拖拽图片到这里发送</p>
                        <p className="text-sm opacity-75">支持最大 20MB 的图片文件</p>
                    </div>
                </div>
            )}

            {/* 消息列表区域 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-8">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto mb-4 opacity-50"
                        >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1-2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p className="text-sm">还没有消息，开始聊天吧！</p>
                        <p className="text-xs mt-2 text-gray-500">支持发送文字和图片（最大20MB）</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="break-words">
                            <div className="text-xs text-gray-400 mb-1">
                                <span className="font-medium text-blue-400">{msg.user}</span>
                                <span className="ml-2">{msg.timestamp.toLocaleTimeString()}</span>
                            </div>
                            {msg.type === 'text' ? (
                                <div className="text-sm text-gray-200 bg-gray-800/50 rounded-lg p-3">
                                    {msg.text}
                                </div>
                            ) : (
                                <div className="bg-gray-800/50 rounded-lg p-2 max-w-xs">
                                    <img
                                        src={msg.image}
                                        alt="聊天图片"
                                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-80 transition-opacity"
                                        onDoubleClick={() => setPreviewImage(msg.image!)}
                                        style={{ maxHeight: '200px' }}
                                        title="双击查看大图"
                                    />
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 发送消息区域 */}
            <div className="border-t border-gray-700 p-4 flex-shrink-0">
                <div className="flex gap-2">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        onPaste={handlePaste}
                        placeholder="输入消息... (支持粘贴图片)"
                        className="flex-1 resize-none bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 max-h-20"
                        rows={1}
                        style={{
                            minHeight: '38px',
                            maxHeight: '80px'
                        }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 80) + 'px';
                        }}
                    />
                    
                    {/* 图片上传按钮 */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex-shrink-0 self-end"
                        title="发送图片 (最大20MB)"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                            <circle cx="9" cy="9" r="2"/>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                    </button>

                    {/* 发送按钮 */}
                    <button
                        onClick={sendMessage}
                        disabled={!message.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
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
                        e.target.value = ''; // 重置输入
                    }}
                    className="hidden"
                />
                
                <div className="text-xs text-gray-500 mt-2">
                    Enter 发送，Shift + Enter 换行，支持粘贴/拖拽图片（最大20MB）
                </div>
            </div>

            {/* 图片预览模态框 */}
            {previewImage && (
                <ImagePreview
                    src={previewImage}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </div>
    );
}


// 核心房间逻辑
function LiveKitRoom() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
    const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);

    const searchParams = useSearchParams();

    const publishAudioTrack = useCallback(async (noiseSuppression: boolean, echoCancellation: boolean) => {
        const existingTrackPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (existingTrackPublication && existingTrackPublication.track) {
            existingTrackPublication.track.stop();
            await room.localParticipant.unpublishTrack(existingTrackPublication.track);
        }

        console.log(`正在创建音轨, 降噪: ${noiseSuppression}, 回声消除: ${echoCancellation}`);
        try {
            const audioTrack = await createLocalAudioTrack({
                channelCount: 2,
                echoCancellation: echoCancellation,
                noiseSuppression: noiseSuppression,
            });

            await room.localParticipant.publishTrack(audioTrack, {
                audioPreset: AudioPresets.musicHighQualityStereo,
                dtx: false,
                red: false,
                source: Track.Source.Microphone
            });
            console.log('新的音频轨道发布成功。');
        } catch (e) {
            console.error("创建或发布音频轨道失败:", e);
            setError(`无法应用音频设置: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [room]);

    useEffect(() => {
        let mounted = true;
        const roomName = searchParams.get('roomName');
        const participantName = searchParams.get('participantName');

        if (!roomName || !participantName) {
            setError('缺少房间名或用户名参数。');
            setIsLoading(false);
            return;
        }

        const connectToRoom = async () => {
            try {
                const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
                if (!livekitUrl) {
                    throw new Error('服务器配置错误: 未找到 LiveKit URL。');
                }

                const apiUrl = `https://livekit-api.2k2.cc/api/room?room=${roomName}&identity=${participantName}&name=${participantName}`;
                const resp = await fetch(apiUrl);
                if (!mounted) return;

                const data = await resp.json();
                if (data.token) {
                    await room.connect(livekitUrl, data.token);
                    if (!mounted) return;
                    console.log(`成功连接到 LiveKit 房间: ${roomName}`);
                    await publishAudioTrack(isNoiseSuppressionEnabled, isEchoCancellationEnabled);
                } else {
                    throw new Error(data.error || '无法从服务器获取 Token');
                }
            } catch (e: any) {
                console.error(e);
                if (mounted) {
                    setError(`连接失败: ${e.message}`);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        connectToRoom();

        return () => {
            mounted = false;
            room.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room, searchParams]);

    const handleToggleNoiseSuppression = async () => {
        const newValue = !isNoiseSuppressionEnabled;
        setIsNoiseSuppressionEnabled(newValue);
        await publishAudioTrack(newValue, isEchoCancellationEnabled);
    };

    const handleToggleEchoCancellation = async () => {
        const newValue = !isEchoCancellationEnabled;
        setIsEchoCancellationEnabled(newValue);
        await publishAudioTrack(isNoiseSuppressionEnabled, newValue);
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">正在连接房间...</div>;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-900">
                <p className="text-xl font-bold text-red-500">连接错误</p>
                <div className="text-lg text-gray-300">{error}</div>
                <Link href="/" className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-lg text-white shadow-sm hover:bg-blue-700">
                    返回大厅
                </Link>
            </div>
        );
    }

    return (
        <RoomContext.Provider value={room}>
            <LayoutContextProvider>
                <div data-lk-theme="default" className="flex h-screen flex-col bg-gray-900">
                    {/* 移除左侧聊天面板，现在整个区域都是视频 */}
                    <div className="flex-1 flex flex-col">
                        <MyVideoConference />
                        <RoomAudioRenderer />
                    </div>

                    {/* 统一的底部控制栏 - 移除聊天按钮 */}
                    <div className="flex flex-col gap-3 p-4 bg-gray-900/80 backdrop-blur-sm">
                        {/* 第一行：房间信息和音频处理控制 */}
                        <div className="flex items-center justify-between">
                            {/* 左侧：房间信息 */}
                            <RoomInfo />
                            
                            {/* 右侧：音频处理控制 */}
                            <div className="flex items-center gap-2">
                                <AudioProcessingControls
                                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                                    onToggleEchoCancellation={handleToggleEchoCancellation}
                                />
                            </div>
                        </div>
                        
                        {/* 第二行：主要控制按钮居中 - 移除聊天按钮 */}
                        <div className="flex items-center justify-center gap-4">
                            <ControlBar
                                variation="minimal"
                                controls={{
                                    microphone: true,
                                    camera: true,
                                    screenShare: true,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* 悬浮聊天组件 */}
                <FloatingChat />
            </LayoutContextProvider>
        </RoomContext.Provider>
    );
}

function MyVideoConference() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );
    return (
        // 中文注释: 高度现在由 flex-1 自动管理，无需手动计算
        <GridLayout tracks={tracks} className="flex-1">
            <ParticipantTile />
        </GridLayout>
    );
}

// 页面入口组件
export default function Page() {
    return (
        <div>
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">加载中...</div>}>
                <LiveKitRoom />
            </Suspense>

            {/* 回到大厅的悬浮按钮 - 调整位置避免与聊天按钮重叠 */}
            <Link
                href="/"
                className="fixed top-20 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-105"
                aria-label="返回大厅"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </Link>
        </div>
    );
}

