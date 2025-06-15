'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';

// 图片预览组件的属性
interface ImagePreviewProps {
    src: string;
    onClose: () => void;
}

// 图片放大预览组件
export default function ImagePreview({ src, onClose }: ImagePreviewProps) {
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [showScaleInfo, setShowScaleInfo] = useState(false);
    const [showOperationTips, setShowOperationTips] = useState(true);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const tipsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    // 处理键盘事件和提示信息
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        tipsTimeoutRef.current = setTimeout(() => setShowOperationTips(false), 3000);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
            if (tipsTimeoutRef.current) clearTimeout(tipsTimeoutRef.current);
        };
    }, [onClose]);

    // 加载图片并计算初始缩放比例
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImageSize({ width: img.width, height: img.height });
            const initialScale = Math.min(
                (window.innerWidth * 0.9) / img.width,
                (window.innerHeight * 0.9) / img.height,
                1
            );
            setScale(initialScale);
        };
        img.src = src;
    }, [src]);

    // 临时显示缩放信息
    const showScaleInfoTemporarily = () => {
        setShowScaleInfo(true);
        if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
        scaleTimeoutRef.current = setTimeout(() => setShowScaleInfo(false), 1500);
    };

    // 处理滚轮缩放
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (!imageRef.current) return;

        const rect = imageRef.current.getBoundingClientRect();
        const imageCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const mouseOffset = { x: e.clientX - imageCenter.x, y: e.clientY - imageCenter.y };

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(scale * delta, 5));
        const scaleDiff = newScale / scale;

        const newPosition = {
            x: position.x - mouseOffset.x * (scaleDiff - 1) / newScale,
            y: position.y - mouseOffset.y * (scaleDiff - 1) / newScale
        };

        setScale(newScale);
        setPosition(newPosition);
        showScaleInfoTemporarily();
    };

    // 处理拖拽
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        e.preventDefault();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
    };
    const handleMouseUp = () => setIsDragging(false);

    // 重新显示操作提示
    const handleTipsClick = () => {
        setShowOperationTips(true);
        if (tipsTimeoutRef.current) clearTimeout(tipsTimeoutRef.current);
        tipsTimeoutRef.current = setTimeout(() => setShowOperationTips(false), 3000);
    };

    return (
        <div
            className="fixed inset-0 bg-black/95 overflow-hidden z-[9999] flex items-center justify-center"
            onClick={onClose}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* 关闭按钮 */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            {/* 缩放及图片信息提示 */}
            <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm flex items-center gap-4">
                {imageSize.width > 0 && <span>{imageSize.width} × {imageSize.height}</span>}
                {showScaleInfo && <span className="transition-opacity">缩放: {Math.round(scale * 100)}%</span>}
            </div>

            {/* 操作提示 */}
            <div
                className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-lg text-sm backdrop-blur-sm cursor-pointer transition-opacity duration-500 ${showOperationTips ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={handleTipsClick}
            >
                滚轮缩放 • 拖拽移动 • ESC 或点击背景关闭
            </div>

            {/* 图片本体 */}
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
                    width: imageSize.width || 'auto',
                    height: imageSize.height || 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                draggable={false}
            />
        </div>
    );
}