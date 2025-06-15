'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getImageDimensions, calculateDisplaySize, formatFileSize } from '../../utils/imageUtils';

interface ImagePreviewProps {
    src: string | null;
    onClose: () => void;
    className?: string;
}

interface ImageInfo {
    width: number;
    height: number;
    aspectRatio: number;
    displayWidth: number;
    displayHeight: number;
    scale: number;
    fileSize?: number;
}

export function ImagePreview({ src, onClose, className = "" }: ImagePreviewProps) {
    const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentScale, setCurrentScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // 重置状态
    const resetState = useCallback(() => {
        setImageInfo(null);
        setIsLoading(true);
        setError(null);
        setCurrentScale(1);
        setImagePosition({ x: 0, y: 0 });
        setIsDragging(false);
    }, []);

    // 加载图片信息
    useEffect(() => {
        if (!src) {
            resetState();
            return;
        }

        setIsLoading(true);
        setError(null);

        getImageDimensions(src)
            .then((dimensions) => {
                if (!containerRef.current) return;
                
                const containerRect = containerRef.current.getBoundingClientRect();
                const maxWidth = containerRect.width * 0.9;
                const maxHeight = containerRect.height * 0.9;
                
                const displaySize = calculateDisplaySize(
                    dimensions.width,
                    dimensions.height,
                    maxWidth,
                    maxHeight
                );

                // 估算文件大小（base64 长度的近似值）
                const estimatedSize = src.length * 0.75; // base64 to bytes 的近似转换

                setImageInfo({
                    width: dimensions.width,
                    height: dimensions.height,
                    aspectRatio: dimensions.aspectRatio,
                    displayWidth: displaySize.width,
                    displayHeight: displaySize.height,
                    scale: displaySize.scale,
                    fileSize: estimatedSize
                });
                setIsLoading(false);
            })
            .catch((err) => {
                console.error('加载图片失败:', err);
                setError('无法加载图片');
                setIsLoading(false);
            });
    }, [src, resetState]);

    // 键盘事件处理
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!src) return;

            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    handleZoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    handleZoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    handleResetZoom();
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        handleResetPosition();
                    }
                    break;
            }
        };

        if (src) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden'; // 阻止背景滚动
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = ''; // 恢复滚动
        };
    }, [src, onClose]);

    // 缩放控制
    const handleZoomIn = useCallback(() => {
        setCurrentScale(prev => Math.min(prev * 1.2, 5));
    }, []);

    const handleZoomOut = useCallback(() => {
        setCurrentScale(prev => Math.max(prev / 1.2, 0.1));
    }, []);

    const handleResetZoom = useCallback(() => {
        setCurrentScale(1);
        setImagePosition({ x: 0, y: 0 });
    }, []);

    const handleResetPosition = useCallback(() => {
        setImagePosition({ x: 0, y: 0 });
    }, []);

    // 鼠标拖拽处理
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.target === imageRef.current) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - imagePosition.x,
                y: e.clientY - imagePosition.y
            });
        }
    }, [imagePosition]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 鼠标事件监听
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // 滚轮缩放
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY;
        if (delta > 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    }, [handleZoomIn, handleZoomOut]);

    // 下载图片
    const handleDownload = useCallback(() => {
        if (!src) return;

        try {
            const link = document.createElement('a');
            link.href = src;
            link.download = `image_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('下载图片失败:', error);
            // 降级方案：在新窗口打开
            window.open(src, '_blank');
        }
    }, [src]);

    // 复制图片到剪贴板
    const handleCopy = useCallback(async () => {
        if (!src) return;

        try {
            // 将 base64 转换为 blob
            const response = await fetch(src);
            const blob = await response.blob();
            
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            
            // 可以添加成功提示
            console.log('图片已复制到剪贴板');
        } catch (error) {
            console.error('复制图片失败:', error);
            // 降级方案：复制图片链接
            try {
                await navigator.clipboard.writeText(src);
                console.log('图片链接已复制到剪贴板');
            } catch (fallbackError) {
                console.error('复制失败:', fallbackError);
            }
        }
    }, [src]);

    if (!src) return null;

    return (
        <div 
            ref={overlayRef}
            className={`fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center ${className}`}
            onClick={(e) => {
                if (e.target === overlayRef.current) {
                    onClose();
                }
            }}
        >
            {/* 工具栏 */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                {/* 图片信息 */}
                <div className="bg-black/60 rounded-lg px-3 py-2 text-white text-sm">
                    {imageInfo && (
                        <div className="flex items-center gap-4">
                            <span>{imageInfo.width} × {imageInfo.height}</span>
                            <span>缩放: {Math.round(currentScale * 100)}%</span>
                            {imageInfo.fileSize && (
                                <span>{formatFileSize(imageInfo.fileSize)}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* 控制按钮 */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleZoomOut}
                        className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                        title="缩小 (-)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>
                    
                    <button
                        onClick={handleResetZoom}
                        className="bg-black/60 hover:bg-black/80 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                        title="重置缩放 (0)"
                    >
                        100%
                    </button>
                    
                    <button
                        onClick={handleZoomIn}
                        className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                        title="放大 (+)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>

                    <div className="w-px h-6 bg-gray-600"></div>

                    <button
                        onClick={handleCopy}
                        className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                        title="复制图片"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>

                    <button
                        onClick={handleDownload}
                        className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                        title="下载图片"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </button>

                    <button
                        onClick={onClose}
                        className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors"
                        title="关闭 (Esc)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {/* 主要内容区域 */}
            <div 
                ref={containerRef}
                className="w-full h-full flex items-center justify-center p-4 overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
            >
                {isLoading && (
                    <div className="text-white text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p>正在加载图片...</p>
                    </div>
                )}

                {error && (
                    <div className="text-red-400 text-center">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p>{error}</p>
                    </div>
                )}

                {!isLoading && !error && imageInfo && (
                    <img
                        ref={imageRef}
                        src={src}
                        alt="预览图片"
                        className={`max-w-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{
                            width: `${imageInfo.displayWidth * currentScale}px`,
                            height: `${imageInfo.displayHeight * currentScale}px`,
                            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                        }}
                        draggable={false}
                        onLoad={() => setIsLoading(false)}
                        onError={() => {
                            setError('图片加载失败');
                            setIsLoading(false);
                        }}
                    />
                )}
            </div>

            {/* 快捷键提示 */}
            <div className="absolute bottom-4 left-4 bg-black/60 rounded-lg px-3 py-2 text-white text-xs">
                <div className="flex flex-col gap-1">
                    <span>快捷键:</span>
                    <span>Esc - 关闭, +/- - 缩放, 0 - 重置</span>
                    <span>Ctrl+R - 重置位置, 拖拽 - 移动图片</span>
                </div>
            </div>
        </div>
    );
}