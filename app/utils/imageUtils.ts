import { ImageChunk, ImageProgressCallback } from '../types/chat';

// 图片压缩函数
export async function compressImage(
    file: File, 
    maxSizeKB: number = 2048,
    quality: number = 0.8
): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            try {
                // 计算压缩后的尺寸
                const maxDimension = 1920; // 最大尺寸
                let { width, height } = img;

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
                ctx!.drawImage(img, 0, 0, width, height);

                // 尝试不同的质量设置直到满足大小要求
                let currentQuality = quality;
                let dataUrl: string;

                do {
                    dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
                    const sizeKB = (dataUrl.length * 3) / 4 / 1024; // 估算大小
                    
                    if (sizeKB <= maxSizeKB || currentQuality <= 0.1) {
                        break;
                    }
                    
                    currentQuality -= 0.1;
                } while (currentQuality > 0.1);

                resolve(dataUrl);
            } catch (error) {
                reject(new Error(`图片压缩失败: ${error}`));
            }
        };

        img.onerror = () => {
            reject(new Error('无法加载图片文件'));
        };

        img.src = URL.createObjectURL(file);
    });
}

// 将 base64 图片数据分片
export function splitImageIntoChunks(
    imageData: string, 
    chunkSize: number = 60000
): ImageChunk[] {
    const id = generateImageId();
    const chunks: ImageChunk[] = [];
    const totalLength = imageData.length;
    const totalChunks = Math.ceil(totalLength / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalLength);
        const data = imageData.slice(start, end);

        const chunk: ImageChunk = {
            id,
            chunkIndex: i,
            totalChunks,
            data,
            ...(i === 0 && { originalSize: totalLength }) // 只在第一个分片包含原始大小
        };

        chunks.push(chunk);
    }

    return chunks;
}

// 生成唯一的图片ID
export function generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 验证图片文件
export function validateImageFile(file: File, maxSizeMB: number = 10): {
    isValid: boolean;
    error?: string;
} {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
        return {
            isValid: false,
            error: '请选择图片文件'
        };
    }

    // 检查文件大小
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return {
            isValid: false,
            error: `图片文件大小不能超过 ${maxSizeMB}MB`
        };
    }

    // 检查支持的格式
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
        return {
            isValid: false,
            error: '不支持的图片格式，请使用 JPEG、PNG、GIF 或 WebP 格式'
        };
    }

    return { isValid: true };
}

// 获取图片尺寸信息
export function getImageDimensions(src: string): Promise<{
    width: number;
    height: number;
    aspectRatio: number;
}> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height,
                aspectRatio: img.width / img.height
            });
        };
        
        img.onerror = () => {
            reject(new Error('无法加载图片'));
        };
        
        img.src = src;
    });
}

// 计算显示尺寸（保持宽高比）
export function calculateDisplaySize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number; scale: number } {
    const scaleX = maxWidth / originalWidth;
    const scaleY = maxHeight / originalHeight;
    const scale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小

    return {
        width: originalWidth * scale,
        height: originalHeight * scale,
        scale
    };
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

// 检查是否为有效的 base64 图片数据
export function isValidBase64Image(data: string): boolean {
    try {
        // 检查是否以 data:image/ 开头
        if (!data.startsWith('data:image/')) {
            return false;
        }

        // 尝试解析 base64 数据
        const base64Data = data.split(',')[1];
        if (!base64Data) {
            return false;
        }

        // 验证 base64 格式
        const binaryString = atob(base64Data);
        return binaryString.length > 0;
    } catch {
        return false;
    }
}

// 从 base64 数据中提取 MIME 类型
export function extractMimeType(base64Data: string): string | null {
    const match = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    return match ? match[1] : null;
}

// 创建图片缩略图
export async function createThumbnail(
    file: File,
    maxSize: number = 200
): Promise<string> {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            try {
                const { width, height } = calculateDisplaySize(
                    img.width,
                    img.height,
                    maxSize,
                    maxSize
                );

                canvas.width = width;
                canvas.height = height;

                ctx!.drawImage(img, 0, 0, width, height);
                const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                resolve(thumbnail);
            } catch (error) {
                reject(new Error(`创建缩略图失败: ${error}`));
            }
        };

        img.onerror = () => {
            reject(new Error('无法加载图片文件'));
        };

        img.src = URL.createObjectURL(file);
    });
}

// 检查浏览器是否支持图片格式
export function isSupportedImageFormat(mimeType: string): boolean {
    const supportedFormats = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml'
    ];
    
    return supportedFormats.includes(mimeType.toLowerCase());
}

// 从文件名中提取扩展名
export function getFileExtension(filename: string): string {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
}

// 根据扩展名获取 MIME 类型
export function getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
}