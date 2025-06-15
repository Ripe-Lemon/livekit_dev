'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface ImagePreviewState {
    isOpen: boolean;
    src: string | null;
    loading: boolean;
    error: string | null;
}

interface ImageMetadata {
    width: number;
    height: number;
    size: number;
    type: string;
    lastModified?: number;
}

interface UseImagePreviewOptions {
    maxZoom?: number;
    minZoom?: number;
    zoomStep?: number;
    enableKeyboardShortcuts?: boolean;
    enableDownload?: boolean;
    enableCopy?: boolean;
}

interface UseImagePreviewReturn {
    previewState: ImagePreviewState;
    imageMetadata: ImageMetadata | null;
    zoom: number;
    position: { x: number; y: number };
    openPreview: (src: string) => void;
    closePreview: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    resetPosition: () => void;
    setZoom: (zoom: number) => void;
    setPosition: (position: { x: number; y: number }) => void;
    downloadImage: () => Promise<void>;
    copyImage: () => Promise<void>;
    isOpen: boolean;
}

export function useImagePreview(options: UseImagePreviewOptions = {}): UseImagePreviewReturn {
    const {
        maxZoom = 5,
        minZoom = 0.1,
        zoomStep = 0.2,
        enableKeyboardShortcuts = true,
        enableDownload = true,
        enableCopy = true
    } = options;

    // 状态
    const [previewState, setPreviewState] = useState<ImagePreviewState>({
        isOpen: false,
        src: null,
        loading: false,
        error: null
    });

    const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
    const [zoom, setZoomState] = useState(1);
    const [position, setPositionState] = useState({ x: 0, y: 0 });

    // Refs
    const imageRef = useRef<HTMLImageElement | null>(null);
    const isMountedRef = useRef(true);

    // 更新预览状态的辅助函数
    const updatePreviewState = useCallback((updates: Partial<ImagePreviewState>) => {
        if (!isMountedRef.current) return;
        setPreviewState(prev => ({ ...prev, ...updates }));
    }, []);

    // 重置所有状态
    const resetAllStates = useCallback(() => {
        setZoomState(1);
        setPositionState({ x: 0, y: 0 });
        setImageMetadata(null);
    }, []);

    // 打开图片预览
    const openPreview = useCallback((src: string) => {
        if (!src) return;

        resetAllStates();
        updatePreviewState({
            isOpen: true,
            src,
            loading: true,
            error: null
        });

        // 预加载图片以获取元数据
        const img = new Image();
        
        img.onload = () => {
            if (!isMountedRef.current) return;

            // 估算图片大小（base64 的近似转换）
            const estimatedSize = src.startsWith('data:') 
                ? src.length * 0.75 
                : 0;

            const metadata: ImageMetadata = {
                width: img.width,
                height: img.height,
                size: estimatedSize,
                type: src.startsWith('data:') 
                    ? src.split(';')[0].split(':')[1] 
                    : 'unknown'
            };

            setImageMetadata(metadata);
            updatePreviewState({
                loading: false,
                error: null
            });
        };

        img.onerror = () => {
            if (!isMountedRef.current) return;
            
            updatePreviewState({
                loading: false,
                error: '图片加载失败'
            });
        };

        img.src = src;
        imageRef.current = img;
    }, [resetAllStates, updatePreviewState]);

    // 关闭图片预览
    const closePreview = useCallback(() => {
        updatePreviewState({
            isOpen: false,
            src: null,
            loading: false,
            error: null
        });
        
        resetAllStates();
        imageRef.current = null;
    }, [updatePreviewState, resetAllStates]);

    // 缩放控制
    const zoomIn = useCallback(() => {
        setZoomState(prev => Math.min(prev + zoomStep, maxZoom));
    }, [zoomStep, maxZoom]);

    const zoomOut = useCallback(() => {
        setZoomState(prev => Math.max(prev - zoomStep, minZoom));
    }, [zoomStep, minZoom]);

    const resetZoom = useCallback(() => {
        setZoomState(1);
        setPositionState({ x: 0, y: 0 });
    }, []);

    const setZoom = useCallback((newZoom: number) => {
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
        setZoomState(clampedZoom);
    }, [minZoom, maxZoom]);

    // 位置控制
    const resetPosition = useCallback(() => {
        setPositionState({ x: 0, y: 0 });
    }, []);

    const setPosition = useCallback((newPosition: { x: number; y: number }) => {
        setPositionState(newPosition);
    }, []);

    // 下载图片
    const downloadImage = useCallback(async () => {
        if (!previewState.src || !enableDownload) {
            console.warn('无法下载图片：无图片源或下载功能被禁用');
            return;
        }

        try {
            if (previewState.src.startsWith('data:')) {
                // Base64 数据
                const link = document.createElement('a');
                link.href = previewState.src;
                link.download = `image_${Date.now()}.${imageMetadata?.type?.split('/')[1] || 'png'}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // URL 图片
                const response = await fetch(previewState.src);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                URL.revokeObjectURL(url);
            }
            
            console.log('图片下载成功');
        } catch (error) {
            console.error('下载图片失败:', error);
            
            // 降级方案：在新窗口打开
            try {
                window.open(previewState.src, '_blank');
            } catch (fallbackError) {
                console.error('打开图片失败:', fallbackError);
            }
        }
    }, [previewState.src, enableDownload, imageMetadata]);

    // 复制图片到剪贴板
    const copyImage = useCallback(async () => {
        if (!previewState.src || !enableCopy) {
            console.warn('无法复制图片：无图片源或复制功能被禁用');
            return;
        }

        try {
            if (navigator.clipboard && window.ClipboardItem) {
                let blob: Blob;
                
                if (previewState.src.startsWith('data:')) {
                    // Base64 数据转换为 blob
                    const response = await fetch(previewState.src);
                    blob = await response.blob();
                } else {
                    // URL 图片
                    const response = await fetch(previewState.src);
                    blob = await response.blob();
                }

                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                
                console.log('图片已复制到剪贴板');
            } else {
                // 降级方案：复制图片 URL
                await navigator.clipboard.writeText(previewState.src);
                console.log('图片链接已复制到剪贴板');
            }
        } catch (error) {
            console.error('复制图片失败:', error);
            
            // 进一步降级：尝试复制链接
            try {
                await navigator.clipboard.writeText(previewState.src);
                console.log('图片链接已复制到剪贴板（降级）');
            } catch (fallbackError) {
                console.error('复制失败:', fallbackError);
            }
        }
    }, [previewState.src, enableCopy]);

    // 键盘快捷键处理
    useEffect(() => {
        if (!enableKeyboardShortcuts || !previewState.isOpen) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Escape':
                    closePreview();
                    break;
                case '=':
                case '+':
                    e.preventDefault();
                    zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    resetZoom();
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        resetPosition();
                    }
                    break;
                case 's':
                    if ((e.ctrlKey || e.metaKey) && enableDownload) {
                        e.preventDefault();
                        downloadImage();
                    }
                    break;
                case 'c':
                    if ((e.ctrlKey || e.metaKey) && enableCopy) {
                        e.preventDefault();
                        copyImage();
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        
        // 阻止背景滚动
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [
        enableKeyboardShortcuts, 
        previewState.isOpen, 
        closePreview, 
        zoomIn, 
        zoomOut, 
        resetZoom, 
        resetPosition,
        downloadImage,
        copyImage,
        enableDownload,
        enableCopy
    ]);

    // 鼠标滚轮缩放
    const handleWheel = useCallback((e: WheelEvent) => {
        if (!previewState.isOpen) return;
        
        e.preventDefault();
        const delta = -e.deltaY;
        
        if (delta > 0) {
            zoomIn();
        } else {
            zoomOut();
        }
    }, [previewState.isOpen, zoomIn, zoomOut]);

    // 添加滚轮事件监听
    useEffect(() => {
        if (previewState.isOpen) {
            document.addEventListener('wheel', handleWheel, { passive: false });
            
            return () => {
                document.removeEventListener('wheel', handleWheel);
            };
        }
    }, [previewState.isOpen, handleWheel]);

    // 清理
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    return {
        previewState,
        imageMetadata,
        zoom,
        position,
        openPreview,
        closePreview,
        zoomIn,
        zoomOut,
        resetZoom,
        resetPosition,
        setZoom,
        setPosition,
        downloadImage,
        copyImage,
        isOpen: previewState.isOpen
    };
}

// 简化的图片预览 Hook
export function useSimpleImagePreview() {
    const { 
        previewState, 
        openPreview, 
        closePreview 
    } = useImagePreview({
        enableKeyboardShortcuts: true,
        enableDownload: true,
        enableCopy: true
    });

    return {
        isOpen: previewState.isOpen,
        src: previewState.src,
        loading: previewState.loading,
        error: previewState.error,
        openPreview,
        closePreview
    };
}