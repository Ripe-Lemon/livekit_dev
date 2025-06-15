import { 
    ChatMessage, 
    DisplayMessage, 
    MessageType,
    ImageChunk,
    ImageProgressCallback 
} from '../types/chat';
import { splitImageIntoChunks } from './imageUtils';

// 创建文本消息数据
export function createTextMessage(message: string): ChatMessage {
    return {
        type: 'chat',
        message: message.trim(),
        timestamp: Date.now()
    };
}

// 创建图片消息数据
export function createImageMessage(imageData: string): ChatMessage {
    return {
        type: 'image',
        image: imageData,
        timestamp: Date.now()
    };
}

// 创建图片分片消息数据
export function createImageChunkMessage(chunk: ImageChunk): ChatMessage {
    return {
        type: 'image_chunk',
        chunk,
        timestamp: Date.now()
    };
}

// 将聊天消息转换为显示消息
export function convertToDisplayMessage(
    chatMessage: ChatMessage,
    user: string,
    id?: string
): DisplayMessage {
    const displayId = id || generateMessageId();
    
    switch (chatMessage.type) {
        case 'chat':
            return {
                id: displayId,
                user,
                text: chatMessage.message,
                timestamp: new Date(chatMessage.timestamp),
                type: 'text' as MessageType
            };
        
        case 'image':
            return {
                id: displayId,
                user,
                image: chatMessage.image,
                timestamp: new Date(chatMessage.timestamp),
                type: 'image' as MessageType
            };
        
        default:
            throw new Error(`不支持的消息类型: ${(chatMessage as any).type}`);
    }
}

// 生成唯一的消息ID
export function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 验证消息内容
export function validateMessage(message: string): {
    isValid: boolean;
    error?: string;
} {
    // 检查是否为空
    if (!message || !message.trim()) {
        return {
            isValid: false,
            error: '消息内容不能为空'
        };
    }

    // 检查长度限制
    const maxLength = 2000; // 最大字符数
    if (message.length > maxLength) {
        return {
            isValid: false,
            error: `消息长度不能超过 ${maxLength} 个字符`
        };
    }

    // 检查是否包含禁用字符（可根据需要自定义）
    const forbiddenPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // 脚本标签
        /javascript:/gi, // JavaScript 协议
        /on\w+\s*=/gi   // 事件处理器
    ];

    for (const pattern of forbiddenPatterns) {
        if (pattern.test(message)) {
            return {
                isValid: false,
                error: '消息包含不允许的内容'
            };
        }
    }

    return { isValid: true };
}

// 转义 HTML 字符
export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 检测并转换链接为可点击链接
export function linkifyText(text: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">$1</a>');
}

// 格式化时间戳
export function formatMessageTime(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
        return '刚刚';
    } else if (diffMinutes < 60) {
        return `${diffMinutes}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else {
        return timestamp.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// 格式化消息显示时间
export function formatDisplayTime(timestamp: Date): string {
    return timestamp.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 限制消息数组长度
export function limitMessages<T>(messages: T[], maxCount: number = 100): T[] {
    return messages.length > maxCount 
        ? messages.slice(-maxCount) 
        : messages;
}

// 发送图片分片
export async function sendImageInChunks(
    room: any,
    imageData: string,
    chunkSize: number = 60000,
    onProgress?: ImageProgressCallback
): Promise<void> {
    const chunks = splitImageIntoChunks(imageData, chunkSize);
    const totalChunks = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
        const chunkMessage = createImageChunkMessage(chunks[i]);
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(chunkMessage));

        try {
            await room.localParticipant.publishData(data, { reliable: true });
            
            // 更新进度
            const progress = ((i + 1) / totalChunks) * 100;
            onProgress?.(progress);
            
            // 在分片之间添加小延迟，避免网络拥塞
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        } catch (error) {
            throw new Error(`发送图片分片 ${i + 1}/${totalChunks} 失败: ${error}`);
        }
    }
}

// 解析聊天数据
export function parseChatData(data: Uint8Array): ChatMessage | null {
    try {
        const decoder = new TextDecoder();
        const message = decoder.decode(data);
        const chatMessage = JSON.parse(message);
        
        // 验证消息格式
        if (!chatMessage.type || !chatMessage.timestamp) {
            console.warn('无效的聊天消息格式:', chatMessage);
            return null;
        }
        
        return chatMessage as ChatMessage;
    } catch (error) {
        console.error('解析聊天数据失败:', error);
        return null;
    }
}

// 创建自定义事件
export function dispatchNewMessageEvent(): void {
    const event = new CustomEvent('newChatMessage');
    window.dispatchEvent(event);
}

// 处理粘贴事件
export function handlePasteEvent(
    event: ClipboardEvent,
    onImagePaste: (file: File) => void,
    onTextPaste?: (text: string) => void
): boolean {
    const items = event.clipboardData?.items;
    if (!items) return false;

    // 查找图片文件
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                onImagePaste(file);
                return true;
            }
        }
    }

    // 处理文本粘贴
    if (onTextPaste) {
        const text = event.clipboardData?.getData('text');
        if (text) {
            onTextPaste(text);
            return true;
        }
    }

    return false;
}

// 检查拖拽事件是否包含文件
export function isDragEventWithFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes('Files') || false;
}

// 从拖拽事件中提取图片文件
export function extractImageFromDrop(event: DragEvent): File | null {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return null;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            return file;
        }
    }

    return null;
}

// 滚动到消息列表底部
export function scrollToBottom(element: HTMLElement | null, smooth: boolean = true): void {
    if (!element) return;
    
    element.scrollTo({
        top: element.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
    });
}

// 检查是否应该自动滚动（用户是否在底部附近）
export function shouldAutoScroll(element: HTMLElement | null, threshold: number = 100): boolean {
    if (!element) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = element;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    return distanceFromBottom <= threshold;
}

// 清理消息中的敏感信息（如果需要）
export function sanitizeMessage(message: string): string {
    // 移除或替换敏感内容
    return message
        .replace(/password\s*[:=]\s*\S+/gi, 'password: ***') // 隐藏密码
        .replace(/token\s*[:=]\s*\S+/gi, 'token: ***')       // 隐藏令牌
        .trim();
}