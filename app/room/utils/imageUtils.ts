// 文件路径: app/room/utils/imageUtils.ts
// @/app/room/utils/imageUtils.ts

import { Room } from 'livekit-client';

// 分片发送相关的常量和类型
export const CHUNK_SIZE = 60000; // 每个分片 60KB (为元数据留出空间)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB 最大图片大小

export interface ImageChunk {
    id: string;
    type: 'image_chunk';
    chunkIndex: number;
    totalChunks: number;
    data: string;
    originalName?: string;
    mimeType?: string;
}

export interface ImageComplete {
    id: string;
    type: 'image_complete';
    totalChunks: number;
}

/**
 * 图片分片管理器 - 负责接收和重组图片分片
 */
export class ImageChunkManager {
    private receivingImages: Map<string, { chunks: Map<number, string>; totalChunks: number; mimeType?: string }> = new Map();
    private onImageComplete: (id: string, imageData: string, user: string) => void;

    constructor(onImageComplete: (id: string, imageData: string, user: string) => void) {
        this.onImageComplete = onImageComplete;
    }

    /**
     * 处理接收到的单个分片
     * @param chunk - 图片分片数据
     * @param user - 发送者
     */
    public handleChunk(chunk: ImageChunk, user: string): void {
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

    /**
     * 重组图片
     * @param id - 图片 ID
     * @param user - 发送者
     */
    private reconstructImage(id: string, user: string): void {
        const imageData = this.receivingImages.get(id);
        if (!imageData) return;

        let completeData = '';
        for (let i = 0; i < imageData.totalChunks; i++) {
            const chunkData = imageData.chunks.get(i);
            if (chunkData) {
                completeData += chunkData;
            }
        }

        this.receivingImages.delete(id); // 清理内存
        this.onImageComplete(id, completeData, user); // 通知上层组件图片已完成
    }

    /**
     * 清理所有正在接收的图片数据
     */
    public cleanup(): void {
        this.receivingImages.clear();
    }
}

/**
 * 将图片数据分片并通过 LiveKit DataChannel 发送
 * @param room - LiveKit Room 实例
 * @param imageData - Base64 格式的图片数据
 * @param onProgress - 发送进度回调函数
 */
export async function sendImageInChunks(
    room: Room,
    imageData: string,
    onProgress?: (progress: number) => void
): Promise<void> {
    const imageId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const totalSize = imageData.length;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const encoder = new TextEncoder();

    try {
        // 循环发送分片
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

            const data = encoder.encode(JSON.stringify(chunk));
            await room.localParticipant.publishData(data, { reliable: true });

            onProgress?.(((i + 1) / totalChunks) * 100);

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
        const completeData = encoder.encode(JSON.stringify(completeMessage));
        await room.localParticipant.publishData(completeData, { reliable: true });

    } catch (error) {
        console.error('发送图片分片失败:', error);
        throw error;
    }
}

/**
 * 压缩图片文件到指定大小以下
 * @param file - 图片文件 File 对象
 * @param maxSizeKB - 最大大小 (KB)
 * @returns - 返回 Promise<string>，内容为 Base64 格式的图片数据
 */
export function compressImage(file: File, maxSizeKB: number = 2048): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            let { width, height } = img;
            const maxDimension = 1920;

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
            ctx?.drawImage(img, 0, 0, width, height);

            let quality = 0.9;
            let result = canvas.toDataURL('image/jpeg', quality);

            while (result.length > maxSizeKB * 1024 * 4/3 && quality > 0.1) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(result);
        };

        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}