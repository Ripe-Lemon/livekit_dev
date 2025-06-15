import { ImageChunk, ImageComplete } from '../../types/chat';

// 图片重组状态接口
interface ImageReassembly {
    id: string;
    chunks: Map<number, string>; // chunkIndex -> data
    totalChunks: number;
    receivedChunks: number;
    originalSize?: number;
    startTime: number;
    lastChunkTime: number;
    user: string;
}

// 图片分片管理器配置
interface ImageChunkManagerConfig {
    maxPendingImages: number;    // 最大同时处理的图片数量
    chunkTimeout: number;        // 分片超时时间（毫秒）
    cleanupInterval: number;     // 清理间隔（毫秒）
    maxImageAge: number;         // 图片最大存活时间（毫秒）
}

export class ImageChunkManager {
    private pendingImages: Map<string, ImageReassembly> = new Map();
    private cleanupTimer: NodeJS.Timeout | null = null;
    private config: ImageChunkManagerConfig;
    private onImageComplete: (id: string, imageData: string, user: string) => void;
    private onProgress?: (id: string, progress: number) => void;
    private onError?: (id: string, error: string) => void;

    constructor(
        onImageComplete: (id: string, imageData: string, user: string) => void,
        config: Partial<ImageChunkManagerConfig> = {}
    ) {
        this.onImageComplete = onImageComplete;
        
        // 默认配置
        this.config = {
            maxPendingImages: 10,
            chunkTimeout: 30000,      // 30秒超时
            cleanupInterval: 5000,    // 5秒清理一次
            maxImageAge: 60000,       // 60秒最大存活时间
            ...config
        };

        this.startCleanupTimer();
    }

    // 设置进度回调
    setProgressCallback(callback: (id: string, progress: number) => void): void {
        this.onProgress = callback;
    }

    // 设置错误回调
    setErrorCallback(callback: (id: string, error: string) => void): void {
        this.onError = callback;
    }

    // 处理接收到的图片分片
    handleChunk(chunk: ImageChunk, user: string): void {
        const { id, chunkIndex, totalChunks, data, originalSize } = chunk;

        try {
            // 验证分片数据
            if (!this.validateChunk(chunk)) {
                this.handleError(id, '无效的图片分片数据');
                return;
            }

            // 检查是否超过最大处理数量
            if (this.pendingImages.size >= this.config.maxPendingImages && !this.pendingImages.has(id)) {
                this.handleError(id, '同时处理的图片数量过多，请稍后重试');
                return;
            }

            // 获取或创建图片重组对象
            let imageReassembly = this.pendingImages.get(id);
            
            if (!imageReassembly) {
                imageReassembly = {
                    id,
                    chunks: new Map(),
                    totalChunks,
                    receivedChunks: 0,
                    originalSize,
                    startTime: Date.now(),
                    lastChunkTime: Date.now(),
                    user
                };
                this.pendingImages.set(id, imageReassembly);
                console.log(`开始接收图片: ${id}, 总分片数: ${totalChunks}`);
            }

            // 检查分片是否已存在（防重复）
            if (imageReassembly.chunks.has(chunkIndex)) {
                console.warn(`分片 ${chunkIndex} 已存在，跳过重复分片`);
                return;
            }

            // 验证总分片数一致性
            if (imageReassembly.totalChunks !== totalChunks) {
                this.handleError(id, `分片总数不一致: 期望 ${imageReassembly.totalChunks}, 收到 ${totalChunks}`);
                return;
            }

            // 存储分片
            imageReassembly.chunks.set(chunkIndex, data);
            imageReassembly.receivedChunks++;
            imageReassembly.lastChunkTime = Date.now();

            // 计算进度
            const progress = (imageReassembly.receivedChunks / totalChunks) * 100;
            this.onProgress?.(id, progress);

            console.log(`接收分片 ${chunkIndex + 1}/${totalChunks} (${progress.toFixed(1)}%)`);

            // 检查是否接收完所有分片
            if (imageReassembly.receivedChunks === totalChunks) {
                this.assembleImage(imageReassembly);
            }

        } catch (error) {
            console.error('处理图片分片时出错:', error);
            this.handleError(id, `处理分片失败: ${error}`);
        }
    }

    // 验证分片数据
    private validateChunk(chunk: ImageChunk): boolean {
        // 检查必需字段
        if (!chunk.id || typeof chunk.chunkIndex !== 'number' || 
            typeof chunk.totalChunks !== 'number' || !chunk.data) {
            return false;
        }

        // 检查索引范围
        if (chunk.chunkIndex < 0 || chunk.chunkIndex >= chunk.totalChunks) {
            return false;
        }

        // 检查总分片数合理性
        if (chunk.totalChunks <= 0 || chunk.totalChunks > 1000) { // 最多1000个分片
            return false;
        }

        // 检查数据长度
        if (chunk.data.length === 0 || chunk.data.length > 100000) { // 最大100KB per chunk
            return false;
        }

        return true;
    }

    // 组装完整图片
    private assembleImage(imageReassembly: ImageReassembly): void {
        try {
            const { id, chunks, totalChunks, user } = imageReassembly;
            
            // 按索引顺序组装数据
            const orderedChunks: string[] = [];
            for (let i = 0; i < totalChunks; i++) {
                const chunkData = chunks.get(i);
                if (!chunkData) {
                    throw new Error(`缺少分片 ${i}`);
                }
                orderedChunks.push(chunkData);
            }

            // 合并所有分片
            const completeImageData = orderedChunks.join('');
            
            // 验证图片数据
            if (!this.validateImageData(completeImageData)) {
                throw new Error('重组后的图片数据无效');
            }

            // 计算接收耗时
            const receiveTime = Date.now() - imageReassembly.startTime;
            console.log(`图片接收完成: ${id}, 耗时: ${receiveTime}ms, 大小: ${completeImageData.length} 字符`);

            // 清理该图片的数据
            this.pendingImages.delete(id);

            // 触发完成回调
            this.onImageComplete(id, completeImageData, user);

        } catch (error) {
            console.error('组装图片失败:', error);
            this.handleError(imageReassembly.id, `图片组装失败: ${error}`);
        }
    }

    // 验证完整图片数据
    private validateImageData(imageData: string): boolean {
        try {
            // 检查是否为有效的 base64 图片数据
            if (!imageData.startsWith('data:image/')) {
                return false;
            }

            // 尝试提取 base64 部分
            const base64Part = imageData.split(',')[1];
            if (!base64Part) {
                return false;
            }

            // 验证 base64 格式
            atob(base64Part);
            return true;

        } catch (error) {
            console.error('图片数据验证失败:', error);
            return false;
        }
    }

    // 处理错误
    private handleError(id: string, error: string): void {
        console.error(`图片 ${id} 处理错误:`, error);
        
        // 清理相关数据
        this.pendingImages.delete(id);
        
        // 触发错误回调
        this.onError?.(id, error);
    }

    // 启动清理定时器
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredImages();
        }, this.config.cleanupInterval);
    }

    // 清理过期的图片数据
    private cleanupExpiredImages(): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [id, imageReassembly] of this.pendingImages) {
            const age = now - imageReassembly.startTime;
            const timeSinceLastChunk = now - imageReassembly.lastChunkTime;

            // 检查是否超时
            if (age > this.config.maxImageAge || timeSinceLastChunk > this.config.chunkTimeout) {
                console.warn(`清理超时图片: ${id}, 年龄: ${age}ms, 最后分片: ${timeSinceLastChunk}ms 前`);
                toDelete.push(id);
                this.handleError(id, '图片接收超时');
            }
        }

        // 删除超时的图片
        toDelete.forEach(id => this.pendingImages.delete(id));

        // 打印状态信息
        if (this.pendingImages.size > 0) {
            console.log(`当前待处理图片数量: ${this.pendingImages.size}`);
        }
    }

    // 获取待处理图片状态
    getPendingImageStatus(): Array<{
        id: string;
        progress: number;
        user: string;
        elapsedTime: number;
        receivedChunks: number;
        totalChunks: number;
    }> {
        const now = Date.now();
        const status: Array<any> = [];

        for (const [id, imageReassembly] of this.pendingImages) {
            status.push({
                id,
                progress: (imageReassembly.receivedChunks / imageReassembly.totalChunks) * 100,
                user: imageReassembly.user,
                elapsedTime: now - imageReassembly.startTime,
                receivedChunks: imageReassembly.receivedChunks,
                totalChunks: imageReassembly.totalChunks
            });
        }

        return status;
    }

    // 取消特定图片的接收
    cancelImage(id: string): boolean {
        if (this.pendingImages.has(id)) {
            this.pendingImages.delete(id);
            console.log(`已取消图片接收: ${id}`);
            return true;
        }
        return false;
    }

    // 清理所有待处理的图片
    clearAll(): void {
        const count = this.pendingImages.size;
        this.pendingImages.clear();
        console.log(`已清理所有待处理图片 (${count} 个)`);
    }

    // 销毁管理器
    cleanup(): void {
        // 停止清理定时器
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        // 清理所有数据
        this.clearAll();
        
        console.log('图片分片管理器已销毁');
    }

    // 获取统计信息
    getStats(): {
        pendingCount: number;
        totalMemoryUsage: number; // 估算的内存使用量（字符数）
        oldestImageAge: number;
    } {
        const now = Date.now();
        let totalMemoryUsage = 0;
        let oldestImageAge = 0;

        for (const [id, imageReassembly] of this.pendingImages) {
            // 计算内存使用量
            for (const chunkData of imageReassembly.chunks.values()) {
                totalMemoryUsage += chunkData.length;
            }

            // 找到最老的图片
            const age = now - imageReassembly.startTime;
            if (age > oldestImageAge) {
                oldestImageAge = age;
            }
        }

        return {
            pendingCount: this.pendingImages.size,
            totalMemoryUsage,
            oldestImageAge
        };
    }
}