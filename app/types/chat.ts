export type MessageType = 'text' | 'image';

export interface ChatMessage {
    type: 'chat' | 'image' | 'image_chunk';
    message?: string;
    image?: string;
    chunk?: ImageChunk;
    timestamp: number;
}

export interface DisplayMessage {
    id: string;
    user: string;
    text?: string;
    image?: string;
    timestamp: Date;
    type: MessageType;
    sending?: boolean;
    failed?: boolean;
    progress?: number;
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