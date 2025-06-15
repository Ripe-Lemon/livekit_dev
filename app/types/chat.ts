export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface ChatMessage {
    id: string;
    type: 'chat' | 'image' | 'image_chunk' | MessageType;
    // 消息内容 - 支持多种属性名
    message?: string;
    text?: string;
    content?: string;
    // 发送者信息 - 支持多种属性名
    senderName?: string;
    sender?: string;
    author?: string;
    participantName?: string;
    user?: string; // 保持兼容性
    // 其他属性
    image?: string;
    imageUrl?: string;
    chunk?: ImageChunk;
    timestamp: number | Date;
    // 消息状态和元数据
    status?: MessageStatus;
    reactions?: MessageReaction[];
    replyTo?: string; // 回复的消息ID
    edited?: boolean;
    editedAt?: Date;
    canDelete?: boolean;
    fileInfo?: FileInfo;
    // 显示相关
    sending?: boolean;
    failed?: boolean;
    progress?: number;
}

export interface DisplayMessage {
    id: string;
    user: string;
    senderName?: string;
    sender?: string;
    author?: string;
    participantName?: string;
    text?: string;
    content?: string;
    message?: string;
    image?: string;
    imageUrl?: string;
    timestamp: Date;
    type: MessageType;
    sending?: boolean;
    failed?: boolean;
    progress?: number;
    status?: MessageStatus;
    reactions?: MessageReaction[];
    replyTo?: string;
    edited?: boolean;
    editedAt?: Date;
    canDelete?: boolean;
    fileInfo?: FileInfo;
}

export enum MessageStatus {
    SENDING = 'sending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    READ = 'read',
    FAILED = 'failed'
}

export interface FileInfo {
    name: string;
    size: number;
    type: string;
    url?: string;
}

export interface ImageChunk {
    id: string;
    chunkIndex: number;
    totalChunks: number;
    data: string;
    originalSize?: number;
}

export interface ImageComplete {
    id: string;
    data: string;
    totalSize: number;
    chunksReceived: number;
    user: string;
}

export interface ChatState {
    messages: DisplayMessage[];
    isOpen: boolean;
    unreadCount: number;
    isDragging: boolean;
    isImageDragging: boolean;
}

export enum DragState {
    NONE = 'none',
    DRAGGING_FILE = 'dragging_file',
    DRAGGING_IMAGE = 'dragging_image'
}

export type ImageProgressCallback = (progress: number) => void;

export interface ChatSettings {
    enableSounds: boolean;
    maxMessages: number;
    autoScroll: boolean;
    showTimestamps: boolean;
    compressImages: boolean;
    maxImageSize: number; // MB
}

export interface ChatEvents {
    onMessageSent?: (message: DisplayMessage) => void;
    onMessageReceived?: (message: DisplayMessage) => void;
    onImageSent?: (message: DisplayMessage) => void;
    onImageReceived?: (message: DisplayMessage) => void;
    onError?: (error: Error) => void;
    onUserTyping?: (user: string) => void;
    onUserStoppedTyping?: (user: string) => void;
}

export interface ChatFilters {
    showImages: boolean;
    showText: boolean;
    userFilter?: string[];
    timeFilter?: {
        start: Date;
        end: Date;
    };
}

export interface ChatExportOptions {
    format: 'json' | 'txt' | 'html';
    includeImages: boolean;
    includeTimestamps: boolean;
    dateRange?: {
        start: Date;
        end: Date;
    };
}

export interface TypingIndicator {
    user: string;
    isTyping: boolean;
    timestamp: number;
}

export interface ChatStats {
    totalMessages: number;
    textMessages: number;
    imageMessages: number;
    totalUsers: number;
    messagesPerUser: Record<string, number>;
    averageMessageLength: number;
    peakMessageTime?: Date;
}

export interface MessageReaction {
    id: string;
    messageId: string;
    emoji: string;
    user: string;
    count: number;
    timestamp: Date;
}

export interface ChatNotification {
    id: string;
    type: 'mention' | 'reply' | 'reaction' | 'system';
    message: string;
    timestamp: Date;
    read: boolean;
    actionUrl?: string;
}

export interface ChatMention {
    id: string;
    messageId: string;
    mentionedUser: string;
    mentionedBy: string;
    timestamp: Date;
    text: string;
}

export interface ChatThread {
    id: string;
    parentMessageId: string;
    messages: DisplayMessage[];
    participants: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ChatDraft {
    text: string;
    timestamp: Date;
    attachments?: File[];
}

export interface ChatRoom {
    id: string;
    name: string;
    description?: string;
    participants: string[];
    createdAt: Date;
    settings: ChatSettings;
    lastActivity: Date;
}

export interface ChatPermissions {
    canSendMessages: boolean;
    canSendImages: boolean;
    canDeleteOwnMessages: boolean;
    canDeleteAnyMessage: boolean;
    canMentionAll: boolean;
    canCreateThreads: boolean;
    isAdmin: boolean;
    isModerator: boolean;
}

export interface ChatSearchOptions {
    query: string;
    messageType?: MessageType;
    user?: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
    caseSensitive?: boolean;
    wholeWords?: boolean;
}

export interface ChatSearchResult {
    message: DisplayMessage;
    matchText: string;
    relevanceScore: number;
}

export interface ChatBackup {
    version: string;
    timestamp: Date;
    roomId: string;
    messages: DisplayMessage[];
    participants: string[];
    settings: ChatSettings;
    metadata: Record<string, any>;
}

export interface MessageDeliveryStatus {
    messageId: string;
    status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp: Date;
    error?: string;
}

export interface ChatModeration {
    bannedWords: string[];
    maxMessageLength: number;
    cooldownPeriod: number; // seconds
    autoModeration: boolean;
    requireApproval: boolean;
}

export interface ChatEmoji {
    id: string;
    shortcode: string;
    url: string;
    category: string;
    keywords: string[];
    custom: boolean;
}

export interface ChatCommand {
    command: string;
    description: string;
    usage: string;
    adminOnly: boolean;
    handler: (args: string[], user: string) => Promise<void>;
}

export interface ChatBotMessage {
    id: string;
    type: 'welcome' | 'help' | 'error' | 'info';
    content: string;
    timestamp: Date;
    actions?: Array<{
        label: string;
        action: string;
        data?: any;
    }>;
}

export interface ChatIntegration {
    id: string;
    name: string;
    type: 'webhook' | 'bot' | 'plugin';
    enabled: boolean;
    config: Record<string, any>;
    events: string[];
}

export interface ChatAnalytics {
    dailyMessages: Record<string, number>;
    hourlyActivity: Record<string, number>;
    topUsers: Array<{
        user: string;
        messageCount: number;
        lastSeen: Date;
    }>;
    messageTypes: Record<MessageType, number>;
    averageResponseTime: number;
    peakConcurrentUsers: number;
}

export interface ChatTheme {
    id: string;
    name: string;
    colors: {
        primary: string;
        secondary: string;
        background: string;
        surface: string;
        text: string;
        textSecondary: string;
        border: string;
        success: string;
        warning: string;
        error: string;
    };
    fonts: {
        primary: string;
        secondary: string;
        mono: string;
    };
    spacing: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
    };
    borderRadius: {
        sm: string;
        md: string;
        lg: string;
    };
}

// 添加常量定义
export const CHAT_LIMITS = {
    MAX_MESSAGE_LENGTH: 2000,
    MAX_IMAGE_SIZE: 10, // MB
    MAX_FILE_SIZE: 50, // MB
    MAX_MESSAGES_HISTORY: 1000
};

export const SUPPORTED_IMAGE_FORMATS = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
];

export const SUPPORTED_IMAGE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp'
];

export const CHAT_SHORTCUTS = {
    SEND_MESSAGE: 'Enter',
    NEW_LINE: 'Shift+Enter',
    EMOJI_PICKER: 'Ctrl+E',
    FILE_UPLOAD: 'Ctrl+U',
    CLEAR_INPUT: 'Escape'
};

export const CHAT_EMOJIS = {
    reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉'],
    categories: {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣'],
        gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙'],
        hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍'],
        symbols: ['🎉', '🎊', '🎈', '🎁', '🏆', '⭐', '🌟', '💫']
    }
};

export const MESSAGE_STATUS_STYLES = {
    [MessageStatus.SENDING]: {
        icon: '⏳',
        color: 'text-yellow-400',
        opacity: 0.7
    },
    [MessageStatus.SENT]: {
        icon: '✓',
        color: 'text-gray-400',
        opacity: 1
    },
    [MessageStatus.DELIVERED]: {
        icon: '✓✓',
        color: 'text-blue-400',
        opacity: 1
    },
    [MessageStatus.READ]: {
        icon: '✓✓',
        color: 'text-green-400',
        opacity: 1
    },
    [MessageStatus.FAILED]: {
        icon: '⚠️',
        color: 'text-red-400',
        opacity: 1
    }
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
    enableSounds: true,
    maxMessages: 1000,
    autoScroll: true,
    showTimestamps: true,
    compressImages: true,
    maxImageSize: 10
};

// 兼容性类型别名
export type ChatMessageCompat = DisplayMessage;

// 工具函数类型
export type MessageFormatter = (message: DisplayMessage) => string;
export type MessageValidator = (content: string) => { isValid: boolean; error?: string };
export type ImageProcessor = (file: File) => Promise<File>;

// 消息内容和发送者信息的工具函数
export const getMessageContent = (message: ChatMessage | DisplayMessage): string => {
    return message.text || message.content || message.message || '';
};

export const getSenderName = (message: ChatMessage | DisplayMessage): string => {
    return message.senderName || message.sender || message.author || message.participantName || message.user || '未知用户';
};

export const createMessage = (
    content: string,
    sender: string,
    type: MessageType = 'text'
): ChatMessage => {
    const timestamp = new Date();
    return {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        text: content,
        content: content,
        message: content,
        senderName: sender,
        sender: sender,
        author: sender,
        participantName: sender,
        user: sender,
        timestamp,
        status: MessageStatus.SENDING,
        canDelete: true
    };
};