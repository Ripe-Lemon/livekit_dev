// 文件路径: app/room/page.tsx
'use client';

import {
    ControlBar,
    GridLayout,
    LiveKitRoom,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    RoomContext,
    useRoomContext,
    LayoutContextProvider,
} from '@livekit/components-react';
import {
    Room,
    Track,
    createLocalAudioTrack,
    AudioPresets,
    RoomEvent,
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AudioManager } from '../lib/audio/AudioManager';

// 分片发送相关的常量和类型
const CHUNK_SIZE = 60000; // 60KB per chunk (留一些空间给元数据)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB 最大图片大小

interface ImageChunk {
    id: string;
    type: 'image_chunk';
    chunkIndex: number;
    totalChunks: number;
    data: string;
    originalName?: string;
    mimeType?: string;
}

interface ImageComplete {
    id: string;
    type: 'image_complete';
    totalChunks: number;
}

// 图片分片管理器
class ImageChunkManager {
    private receivingImages: Map<string, { chunks: Map<number, string>; totalChunks: number; mimeType?: string }> = new Map();
    private onImageComplete: (id: string, imageData: string, user: string) => void;

    constructor(onImageComplete: (id: string, imageData: string, user: string) => void) {
        this.onImageComplete = onImageComplete;
    }

    handleChunk(chunk: ImageChunk, user: string): void {
        if (!this.receivingImages.has(chunk.id)) {
            this.receivingImages.set(chunk.id, {
                chunks: new Map(),
                totalChunks: chunk.totalChunks,
                mimeType: chunk.mimeType
            });
        }

        const imageData = this.receivingImages.get(chunk.id)!;
        imageData.chunks.set(chunk.chunkIndex, chunk.data);

        // 检查是否所有分片都已接收
        if (imageData.chunks.size === imageData.totalChunks) {
            this.reconstructImage(chunk.id, user);
        }
    }

    private reconstructImage(id: string, user: string): void {
        const imageData = this.receivingImages.get(id);
        if (!imageData) return;

        // 按顺序重组图片数据
        let completeData = '';
        for (let i = 0; i < imageData.totalChunks; i++) {
            const chunkData = imageData.chunks.get(i);
            if (chunkData) {
                completeData += chunkData;
            }
        }

        // 清理
        this.receivingImages.delete(id);

        // 通知图片接收完成
        this.onImageComplete(id, completeData, user);
    }

    cleanup(): void {
        this.receivingImages.clear();
    }
}

// 图片发送工具函数
async function sendImageInChunks(
    room: any,
    imageData: string,
    onProgress?: (progress: number) => void
): Promise<void> {
    const imageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const totalSize = imageData.length;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    try {
        // 发送分片
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, totalSize);
            const chunkData = imageData.slice(start, end);

            const chunk: ImageChunk = {
                id: imageId,
                type: 'image_chunk',
                chunkIndex: i,
                totalChunks: totalChunks,
                data: chunkData,
                mimeType: 'image/jpeg'
            };

            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(chunk));
            
            await room.localParticipant.publishData(data, { reliable: true });

            // 更新进度
            if (onProgress) {
                onProgress(((i + 1) / totalChunks) * 100);
            }

            // 添加小延迟避免网络拥塞
            if (i < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        // 发送完成信号
        const completeMessage: ImageComplete = {
            id: imageId,
            type: 'image_complete',
            totalChunks: totalChunks
        };

        const encoder = new TextEncoder();
        const completeData = encoder.encode(JSON.stringify(completeMessage));
        await room.localParticipant.publishData(completeData, { reliable: true });

    } catch (error) {
        console.error('发送图片分片失败:', error);
        throw error;
    }
}

// 自定义音频处理控件的属性类型
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
    const [showOperationTips, setShowOperationTips] = useState(true);
    const [showImageInfo, setShowImageInfo] = useState(true);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const tipsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const imageInfoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        // 显示操作提示，3秒后自动隐藏
        tipsTimeoutRef.current = setTimeout(() => {
            setShowOperationTips(false);
        }, 3000);

        // 显示图片信息，2秒后自动隐藏
        imageInfoTimeoutRef.current = setTimeout(() => {
            setShowImageInfo(false);
        }, 2000);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (scaleTimeoutRef.current) {
                clearTimeout(scaleTimeoutRef.current);
            }
            if (tipsTimeoutRef.current) {
                clearTimeout(tipsTimeoutRef.current);
            }
            if (imageInfoTimeoutRef.current) {
                clearTimeout(imageInfoTimeoutRef.current);
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
            const scaleX = (windowWidth * 0.9) / img.width; // 留10%边距
            const scaleY = (windowHeight * 0.9) / img.height; // 留10%边距
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

    // 修复：以鼠标绝对位置为中心的缩放
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        
        if (!imageRef.current) return;

        // 获取容器中心点（屏幕中心）
        const containerCenter = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        };

        // 计算鼠标相对于容器中心的偏移
        const mouseOffset = {
            x: e.clientX - containerCenter.x,
            y: e.clientY - containerCenter.y
        };

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(scale * delta, 5));
        
        // 计算缩放后需要调整的位置
        // 使鼠标在图片上的点在缩放后保持在相同的屏幕位置
        const scaleDiff = newScale / scale;
        const newPosition = {
            x: position.x + mouseOffset.x * (1 - scaleDiff),
            y: position.y + mouseOffset.y * (1 - scaleDiff)
        };

        setScale(newScale);
        setPosition(newPosition);
        showScaleInfoTemporarily();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) { // 只响应左键
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
            e.preventDefault();
        }
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

    // 点击操作提示重新显示
    const handleTipsClick = () => {
        setShowOperationTips(true);
        if (tipsTimeoutRef.current) {
            clearTimeout(tipsTimeoutRef.current);
        }
        tipsTimeoutRef.current = setTimeout(() => {
            setShowOperationTips(false);
        }, 3000);
    };

    // 点击图片信息重新显示
    const handleImageInfoClick = () => {
        setShowImageInfo(true);
        if (imageInfoTimeoutRef.current) {
            clearTimeout(imageInfoTimeoutRef.current);
        }
        imageInfoTimeoutRef.current = setTimeout(() => {
            setShowImageInfo(false);
        }, 2000);
    };

    return (
        <>
            {typeof window !== 'undefined' && (
                <div 
                    className="fixed bg-black/95 overflow-hidden"
                    style={{ 
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 9999,
                        margin: 0,
                        padding: 0
                    }}
                    onClick={onClose}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* 完全居中的容器 */}
                    <div className="w-full h-full flex items-center justify-center relative">
                        {/* 关闭按钮 */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
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
                            <div className="absolute top-6 left-6 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm transition-opacity backdrop-blur-sm">
                                缩放: {Math.round(scale * 100)}%
                            </div>
                        )}

                        {/* 图片信息显示 - 2秒后自动隐藏，点击可重新显示 */}
                        <div 
                            className={`absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm cursor-pointer transition-opacity duration-500 ${
                                showImageInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'
                            }`}
                            onClick={handleImageInfoClick}
                        >
                            {imageSize.width > 0 && imageSize.height > 0 && (
                                <span>{imageSize.width} × {imageSize.height} 像素</span>
                            )}
                        </div>

                        {/* 重新显示图片信息的按钮（当信息隐藏时） */}
                        {!showImageInfo && (
                            <button
                                onClick={handleImageInfoClick}
                                className="absolute top-6 left-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                                title="显示图片信息"
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
                        )}

                        {/* 操作提示 - 3秒后自动消失，点击可重新显示 */}
                        <div 
                            className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm cursor-pointer transition-opacity duration-500 ${
                                showOperationTips ? 'opacity-100' : 'opacity-0 pointer-events-none'
                            }`}
                            onClick={handleTipsClick}
                        >
                            滚轮缩放 • 拖拽移动 • ESC 或点击背景关闭
                        </div>

                        {/* 重新显示提示的按钮（当提示隐藏时） */}
                        {!showOperationTips && (
                            <button
                                onClick={handleTipsClick}
                                className="absolute bottom-6 right-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                                title="显示操作提示"
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
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 16v-4"/>
                                    <path d="M12 8h.01"/>
                                </svg>
                            </button>
                        )}

                        {/* 图片 - 完全居中显示 */}
                        <img
                            ref={imageRef}
                            src={src}
                            alt="预览图片"
                            className={`select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            style={{
                                transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                                transformOrigin: 'center center',
                                maxWidth: 'none',
                                maxHeight: 'none',
                                width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
                                height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
                                position: 'relative',
                                zIndex: 1
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            draggable={false}
                            onLoad={() => {
                                // 图片加载完成后确保正确的初始位置
                                setPosition({ x: 0, y: 0 });
                            }}
                        />
                    </div>
                </div>
            )}
        </>
    );
}

// 添加悬浮聊天组件
function FloatingChatWithPreview({ setPreviewImage, previewImage }: { setPreviewImage: (src: string | null) => void; previewImage: string | null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [audioManager] = useState(() => AudioManager.getInstance());

    // 监听新消息事件
    useEffect(() => {
        const handleNewMessage = () => {
            // 播放消息通知音效
            audioManager.playSound('message-notification');

            // 如果悬浮窗关闭，增加未读数量
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };

        window.addEventListener('newChatMessage', handleNewMessage);
        
        return () => {
            window.removeEventListener('newChatMessage', handleNewMessage);
        };
    }, [isOpen, audioManager]);

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
                    
                    {/* 聊天内容区域 */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <CustomChatWithPreview setPreviewImage={setPreviewImage} previewImage={previewImage} />
                    </div>
                </div>
            </div>

            {/* 聊天按钮 */}
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
function CustomChatWithPreview({ setPreviewImage, previewImage }: { setPreviewImage: (src: string | null) => void; previewImage: string | null }) {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Array<{
        id: string;
        user: string;
        text?: string;
        image?: string;
        timestamp: Date;
        type: 'text' | 'image';
        sending?: boolean;
        progress?: number;
    }>>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isImageDragging, setIsImageDragging] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const room = useRoomContext();
    
    // 图片分片管理器
    const chunkManagerRef = useRef<ImageChunkManager | null>(null);

    // 初始化分片管理器
    useEffect(() => {
        const handleImageComplete = (id: string, imageData: string, user: string) => {
            setMessages(prev => {
                const newMessages = [...prev, {
                    id: id,
                    user: user,
                    image: imageData,
                    timestamp: new Date(),
                    type: 'image' as const
                }];
                
                // 触发新消息事件
                const event = new CustomEvent('newChatMessage');
                window.dispatchEvent(event);
                
                return newMessages.slice(-100);
            });
        };

        chunkManagerRef.current = new ImageChunkManager(handleImageComplete);

        return () => {
            chunkManagerRef.current?.cleanup();
        };
    }, []);

    // 滚动到最新消息
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 处理图片文件 - 修改为支持分片发送
    const handleImageFile = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('请选择图片文件');
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            alert(`图片文件大小不能超过 ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
            return;
        }

        // 创建临时消息显示发送进度
        const tempId = Date.now().toString();

        try {
            // 压缩图片，但保持更高的质量
            const compressedBase64 = await compressImage(file, 2048); // 压缩到约2MB
            
            setMessages(prev => [...prev, {
                id: tempId,
                user: '我',
                image: compressedBase64,
                timestamp: new Date(),
                type: 'image' as const,
                sending: true,
                progress: 0
            }]);

            // 分片发送图片
            await sendImageInChunks(
                room,
                compressedBase64,
                (progress) => {
                    setMessages(prev => prev.map(msg => 
                        msg.id === tempId 
                            ? { ...msg, progress }
                            : msg
                    ));
                }
            );

            // 发送完成，更新消息状态
            setMessages(prev => prev.map(msg => 
                msg.id === tempId 
                    ? { ...msg, sending: false, progress: 100 }
                    : msg
            ));

        } catch (error) {
            console.error('处理图片失败:', error);
            alert('发送图片失败，请尝试其他图片');
            
            // 移除失败的消息
            setMessages(prev => prev.filter(msg => msg.id !== tempId));
        }
    }, [room]);

    // 监听聊天消息 - 支持分片图片消息
    useEffect(() => {
        const handleDataReceived = (payload: Uint8Array, participant: any) => {
            const decoder = new TextDecoder();
            const message = decoder.decode(payload);
            
            try {
                const chatMessage = JSON.parse(message);
                const userName = participant?.name || participant?.identity || '未知用户';
                
                if (chatMessage.type === 'chat') {
                    setMessages(prev => {
                        const newMessages = [...prev, {
                            id: Date.now().toString(),
                            user: userName,
                            text: chatMessage.message,
                            timestamp: new Date(),
                            type: 'text' as const
                        }];
                        
                        // 触发新消息事件
                        const event = new CustomEvent('newChatMessage');
                        window.dispatchEvent(event);
                        
                        return newMessages.slice(-100);
                    });
                } else if (chatMessage.type === 'image_chunk') {
                    // 处理图片分片
                    chunkManagerRef.current?.handleChunk(chatMessage, userName);
                } else if (chatMessage.type === 'image') {
                    // 兼容旧的单片图片消息
                    setMessages(prev => {
                        const newMessages = [...prev, {
                            id: Date.now().toString(),
                            user: userName,
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

    // 检查拖拽的目标是否是聊天容器内部
    const isDropTargetInChatContainer = useCallback((target: EventTarget | null): boolean => {
        if (!target || !chatContainerRef.current) return false;
        return chatContainerRef.current.contains(target as Node);
    }, []);

    // 处理外部文件拖拽事件
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        // 只有在拖拽文件时才显示拖拽提示
        if (e.dataTransfer?.types.includes('Files') && !isImageDragging) {
            setIsDragging(true);
        }
    }, [isImageDragging]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        // 只有当拖拽离开聊天容器时才隐藏提示
        if (!isDropTargetInChatContainer(e.relatedTarget)) {
            setIsDragging(false);
        }
    }, [isDropTargetInChatContainer]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        // 检查是否是聊天图片的拖拽
        if (isImageDragging) {
            // 不允许图片拖回聊天框
            return;
        }
        
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            handleImageFile(file);
        }
    }, [handleImageFile, isImageDragging]);

    // 处理聊天图片的拖拽开始
    const handleImageDragStart = useCallback((e: React.DragEvent) => {
        setIsImageDragging(true);
        // 允许图片拖拽到聊天框外部
        e.dataTransfer.effectAllowed = 'copy';
    }, []);

    // 处理聊天图片的拖拽结束
    const handleImageDragEnd = useCallback(() => {
        setIsImageDragging(false);
    }, []);

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
            ref={chatContainerRef}
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* 拖拽覆盖层 - 只在拖拽外部文件时显示 */}
            {isDragging && !isImageDragging && (
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
                        <p className="text-sm opacity-75">支持最大 {MAX_IMAGE_SIZE / 1024 / 1024}MB 的图片文件</p>
                    </div>
                </div>
            )}

            {/* 聊天图片拖拽提示层 */}
            {isImageDragging && (
                <div className="absolute inset-0 bg-red-500/20 border-2 border-dashed border-red-500 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center text-red-400">
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
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <p className="text-lg font-medium">不能拖回聊天框</p>
                        <p className="text-sm opacity-75">请拖拽到聊天框外部</p>
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
                        <p className="text-xs mt-2 text-gray-500">支持发送文字和图片（最大{MAX_IMAGE_SIZE / 1024 / 1024}MB）</p>
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
                                <div className="bg-gray-800/50 rounded-lg p-2 max-w-xs relative">
                                    <img
                                        src={msg.image}
                                        alt="聊天图片"
                                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-80 transition-opacity"
                                        onDoubleClick={() => setPreviewImage(msg.image!)}
                                        onDragStart={handleImageDragStart}
                                        onDragEnd={handleImageDragEnd}
                                        style={{ maxHeight: '200px' }}
                                        title="双击全屏查看，可拖拽到聊天框外部"
                                        draggable={true}
                                    />
                                    {/* 发送进度条 */}
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
                        placeholder="输入消息..."
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
                        title={`发送图片 (最大${MAX_IMAGE_SIZE / 1024 / 1024}MB)`}
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
                
                {/* 简化提示文字 */}
                <div className="text-xs text-gray-500 mt-2">
                    Enter 发送，支持粘贴/拖拽图片
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
function LiveKitRoomWithPreview({ setPreviewImage }: { setPreviewImage: (src: string | null) => void }) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewImage, setPreviewImageLocal] = useState<string | null>(null);
    const [audioManager] = useState(() => AudioManager.getInstance());

    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
    const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);

    const searchParams = useSearchParams();

    // 初始化音效管理器
    useEffect(() => {
        audioManager.initialize();
    }, [audioManager]);

    // 监听房间事件
    useEffect(() => {
        const handleParticipantConnected = (participant: any) => {
            console.log('用户加入:', participant.name || participant.identity);
            audioManager.playSound('user-join');
        };

        const handleParticipantDisconnected = (participant: any) => {
            console.log('用户离开:', participant.name || participant.identity);
            audioManager.playSound('user-leave');
        };

        room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

        return () => {
            room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
            room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        };
    }, [room, audioManager]);

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
    }, [room, searchParams, publishAudioTrack, isNoiseSuppressionEnabled, isEchoCancellationEnabled]);

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
                    <div className="flex-1 flex flex-col">
                        <MyVideoConference />
                        <RoomAudioRenderer />
                    </div>

                    {/* 统一的底部控制栏 */}
                    <div className="flex flex-col gap-3 p-4 bg-gray-900/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            <RoomInfo />
                            
                            <div className="flex items-center gap-2">
                                <AudioProcessingControls
                                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                                    onToggleEchoCancellation={handleToggleEchoCancellation}
                                />
                                
                                {/* 添加音效控制按钮 */}
                                <button
                                    onClick={() => audioManager.setEnabled(!audioManager.isAudioEnabled())}
                                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                                        audioManager.isAudioEnabled()
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                                    }`}
                                    title={audioManager.isAudioEnabled() ? '关闭音效' : '开启音效'}
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
                                        {audioManager.isAudioEnabled() ? (
                                            <>
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                            </>
                                        ) : (
                                            <>
                                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                                <line x1="17" y1="9" x2="23" y2="15"></line>
                                            </>
                                        )}
                                    </svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-center gap-4">
                            <ControlBar
                                variation="minimal"
                                controls={{
                                    microphone: true,
                                    camera: true,
                                    screenShare: true,
                                    leave: true,
                                }}
                            />
                        </div>
                    </div>
                </div>
                <FloatingChatWithPreview setPreviewImage={setPreviewImageLocal} previewImage={previewImage} />
                <FloatingChatWithPreview setPreviewImage={setPreviewImage} previewImage={previewImage} />
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
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    return (
        <div>
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">加载中...</div>}>
                <LiveKitRoomWithPreview setPreviewImage={setPreviewImage} />
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

            {/* 图片预览模态框 - 移到最外层 */}
            {previewImage && (
                <ImagePreview
                    src={previewImage}
                    onClose={() => setPreviewImage(null)}
                />
            )}
        </div>
    );
}

