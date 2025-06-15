import { SoundEvent } from '../types/audio';
import { ChatSettings, ChatTheme } from '../types/chat';

// 聊天消息限制
export const CHAT_LIMITS = {
    MAX_MESSAGE_LENGTH: 2000,
    MAX_MESSAGES_HISTORY: 500,
    MAX_IMAGE_SIZE_MB: 10,
    MAX_IMAGE_WIDTH: 2048,
    MAX_IMAGE_HEIGHT: 2048,
    MAX_PENDING_MESSAGES: 10,
    MAX_TYPING_INDICATORS: 5,
    MAX_RECENT_ROOMS: 20,
    MAX_PINNED_MESSAGES: 10,
    MAX_THREADS_PER_MESSAGE: 5,
    MAX_REACTIONS_PER_MESSAGE: 50,
    MAX_MENTIONS_PER_MESSAGE: 10
} as const;

// 聊天时间限制
export const CHAT_TIMEOUTS = {
    MESSAGE_SEND_TIMEOUT: 30000, // 30秒
    IMAGE_SEND_TIMEOUT: 60000, // 60秒
    TYPING_INDICATOR_TIMEOUT: 3000, // 3秒
    MESSAGE_RETRY_DELAY: 2000, // 2秒
    CONNECTION_RETRY_DELAY: 5000, // 5秒
    CHUNK_RECEIVE_TIMEOUT: 30000, // 30秒
    AUTO_CLEAR_NOTIFICATIONS: 10000, // 10秒
    DEBOUNCE_TYPING: 500, // 500毫秒
    THROTTLE_SCROLL: 100, // 100毫秒
    MESSAGE_ANIMATION_DURATION: 300 // 300毫秒
} as const;

// 支持的图片格式
export const SUPPORTED_IMAGE_FORMATS = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/svg+xml'
] as const;

// 支持的图片文件扩展名
export const SUPPORTED_IMAGE_EXTENSIONS = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.svg'
] as const;

// 聊天事件声音映射
export const CHAT_SOUNDS: Record<string, SoundEvent> = {
    MESSAGE_SENT: 'message-notification',
    MESSAGE_RECEIVED: 'message-notification',
    IMAGE_SENT: 'message-notification',
    IMAGE_RECEIVED: 'message-notification',
    USER_MENTIONED: 'message-notification',
    ERROR_OCCURRED: 'error',
    TYPING_START: 'message-notification',
    REACTION_ADDED: 'message-notification'
} as const;

// 默认聊天设置
export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
    enableSounds: true,
    maxMessages: 100,
    autoScroll: true,
    showTimestamps: true,
    compressImages: true,
    maxImageSize: 10
};

// 消息状态样式
export const MESSAGE_STATUS_STYLES = {
    sending: {
        opacity: 0.7,
        icon: '⏳',
        color: 'text-yellow-500'
    },
    sent: {
        opacity: 1,
        icon: '✓',
        color: 'text-green-500'
    },
    failed: {
        opacity: 0.5,
        icon: '✗',
        color: 'text-red-500'
    },
    delivered: {
        opacity: 1,
        icon: '✓✓',
        color: 'text-blue-500'
    }
} as const;

// 聊天主题配置
export const CHAT_THEMES: Record<string, ChatTheme> = {
    dark: {
        id: 'dark',
        name: '深色主题',
        colors: {
            primary: '#3B82F6',
            secondary: '#6B7280',
            background: '#111827',
            surface: '#1F2937',
            text: '#F9FAFB',
            textSecondary: '#9CA3AF',
            border: '#374151',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444'
        },
        fonts: {
            primary: 'Inter, system-ui, sans-serif',
            secondary: 'Inter, system-ui, sans-serif',
            mono: 'Monaco, "Cascadia Code", "Roboto Mono", monospace'
        },
        spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '3rem'
        },
        borderRadius: {
            sm: '0.25rem',
            md: '0.5rem',
            lg: '0.75rem'
        }
    },
    light: {
        id: 'light',
        name: '浅色主题',
        colors: {
            primary: '#3B82F6',
            secondary: '#6B7280',
            background: '#FFFFFF',
            surface: '#F9FAFB',
            text: '#111827',
            textSecondary: '#6B7280',
            border: '#E5E7EB',
            success: '#10B981',
            warning: '#F59E0B',
            error: '#EF4444'
        },
        fonts: {
            primary: 'Inter, system-ui, sans-serif',
            secondary: 'Inter, system-ui, sans-serif',
            mono: 'Monaco, "Cascadia Code", "Roboto Mono", monospace'
        },
        spacing: {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '3rem'
        },
        borderRadius: {
            sm: '0.25rem',
            md: '0.5rem',
            lg: '0.75rem'
        }
    }
} as const;

// 表情符号配置
export const CHAT_EMOJIS = {
    reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡', '🎉'],
    categories: {
        smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇'],
        gestures: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉'],
        hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'],
        objects: ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🎯', '⭐', '💫', '✨']
    }
} as const;

// 聊天命令配置
export const CHAT_COMMANDS = {
    help: {
        command: '/help',
        description: '显示可用命令列表',
        usage: '/help [命令名]',
        adminOnly: false
    },
    clear: {
        command: '/clear',
        description: '清除聊天历史',
        usage: '/clear',
        adminOnly: false
    },
    mute: {
        command: '/mute',
        description: '静音用户',
        usage: '/mute @用户名',
        adminOnly: true
    },
    kick: {
        command: '/kick',
        description: '踢出用户',
        usage: '/kick @用户名',
        adminOnly: true
    },
    ban: {
        command: '/ban',
        description: '封禁用户',
        usage: '/ban @用户名 [时长]',
        adminOnly: true
    },
    announce: {
        command: '/announce',
        description: '发布公告',
        usage: '/announce 消息内容',
        adminOnly: true
    }
} as const;

// 文件类型图标映射
export const FILE_TYPE_ICONS = {
    'image/jpeg': '🖼️',
    'image/png': '🖼️',
    'image/gif': '🎞️',
    'image/webp': '🖼️',
    'video/mp4': '🎥',
    'video/webm': '🎥',
    'audio/mp3': '🎵',
    'audio/wav': '🎵',
    'application/pdf': '📄',
    'text/plain': '📝',
    'application/zip': '📦',
    'application/json': '📋',
    default: '📎'
} as const;

// 快捷键配置
export const CHAT_SHORTCUTS = {
    SEND_MESSAGE: 'Enter',
    NEW_LINE: 'Shift+Enter',
    CLEAR_INPUT: 'Escape',
    SCROLL_TO_BOTTOM: 'Ctrl+End',
    SCROLL_TO_TOP: 'Ctrl+Home',
    FOCUS_INPUT: 'Ctrl+/',
    TOGGLE_EMOJI: 'Ctrl+E',
    UPLOAD_FILE: 'Ctrl+U',
    SEARCH_MESSAGES: 'Ctrl+F'
} as const;

// 消息过滤器
export const MESSAGE_FILTERS = {
    ALL: 'all',
    TEXT: 'text',
    IMAGES: 'images',
    FILES: 'files',
    MENTIONS: 'mentions',
    REACTIONS: 'reactions',
    SYSTEM: 'system'
} as const;

// 聊天室状态
export const ROOM_STATUS = {
    ACTIVE: 'active',
    IDLE: 'idle',
    LOCKED: 'locked',
    ARCHIVED: 'archived',
    MAINTENANCE: 'maintenance'
} as const;

// 用户角色权限
export const USER_ROLES = {
    GUEST: {
        name: 'guest',
        permissions: {
            canSendMessages: true,
            canSendImages: true,
            canDeleteOwnMessages: false,
            canDeleteAnyMessage: false,
            canMentionAll: false,
            canCreateThreads: false,
            isAdmin: false,
            isModerator: false
        }
    },
    MEMBER: {
        name: 'member',
        permissions: {
            canSendMessages: true,
            canSendImages: true,
            canDeleteOwnMessages: true,
            canDeleteAnyMessage: false,
            canMentionAll: false,
            canCreateThreads: true,
            isAdmin: false,
            isModerator: false
        }
    },
    MODERATOR: {
        name: 'moderator',
        permissions: {
            canSendMessages: true,
            canSendImages: true,
            canDeleteOwnMessages: true,
            canDeleteAnyMessage: true,
            canMentionAll: true,
            canCreateThreads: true,
            isAdmin: false,
            isModerator: true
        }
    },
    ADMIN: {
        name: 'admin',
        permissions: {
            canSendMessages: true,
            canSendImages: true,
            canDeleteOwnMessages: true,
            canDeleteAnyMessage: true,
            canMentionAll: true,
            canCreateThreads: true,
            isAdmin: true,
            isModerator: true
        }
    }
} as const;

// 通知类型
export const NOTIFICATION_TYPES = {
    MESSAGE: 'message',
    MENTION: 'mention',
    REPLY: 'reply',
    REACTION: 'reaction',
    SYSTEM: 'system',
    JOIN: 'join',
    LEAVE: 'leave',
    ERROR: 'error'
} as const;

// API 端点
export const CHAT_API_ENDPOINTS = {
    SEND_MESSAGE: '/api/chat/send',
    GET_MESSAGES: '/api/chat/messages',
    DELETE_MESSAGE: '/api/chat/delete',
    REACT_MESSAGE: '/api/chat/react',
    UPLOAD_IMAGE: '/api/chat/upload',
    GET_HISTORY: '/api/chat/history',
    SEARCH_MESSAGES: '/api/chat/search',
    EXPORT_CHAT: '/api/chat/export'
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
    CHAT_SETTINGS: 'livekit_chat_settings',
    RECENT_ROOMS: 'livekit_recent_rooms',
    DRAFT_MESSAGES: 'livekit_draft_messages',
    CUSTOM_EMOJIS: 'livekit_custom_emojis',
    BLOCKED_USERS: 'livekit_blocked_users',
    NOTIFICATION_SETTINGS: 'livekit_notification_settings',
    THEME_PREFERENCE: 'livekit_theme_preference'
} as const;

// 正则表达式模式
export const CHAT_REGEX = {
    MENTION: /@(\w+)/g,
    URL: /(https?:\/\/[^\s]+)/g,
    EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    PHONE: /\b\d{3}-\d{3}-\d{4}\b/g,
    HASHTAG: /#(\w+)/g,
    EMOJI_SHORTCODE: /:(\w+):/g
} as const;

// 消息模板
export const MESSAGE_TEMPLATES = {
    WELCOME: '欢迎 {username} 加入房间！',
    USER_LEFT: '{username} 离开了房间',
    USER_JOINED: '{username} 加入了房间',
    ROOM_CREATED: '房间 {roomName} 已创建',
    ROOM_LOCKED: '房间已被锁定',
    ROOM_UNLOCKED: '房间已解锁',
    FILE_SHARED: '{username} 分享了文件: {filename}',
    SCREEN_SHARE_START: '{username} 开始了屏幕共享',
    SCREEN_SHARE_STOP: '{username} 结束了屏幕共享'
} as const;

// 错误消息
export const ERROR_MESSAGES = {
    MESSAGE_TOO_LONG: `消息长度不能超过 ${CHAT_LIMITS.MAX_MESSAGE_LENGTH} 字符`,
    IMAGE_TOO_LARGE: `图片大小不能超过 ${CHAT_LIMITS.MAX_IMAGE_SIZE_MB}MB`,
    UNSUPPORTED_FORMAT: '不支持的文件格式',
    NETWORK_ERROR: '网络连接失败，请检查网络设置',
    PERMISSION_DENIED: '您没有权限执行此操作',
    USER_NOT_FOUND: '用户不存在',
    MESSAGE_NOT_FOUND: '消息不存在',
    ROOM_FULL: '房间已满，无法加入',
    ROOM_LOCKED: '房间已锁定，无法发送消息',
    USER_MUTED: '您已被静音，无法发送消息',
    RATE_LIMITED: '发送消息过于频繁，请稍后再试'
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
    MESSAGE_SENT: '消息发送成功',
    IMAGE_UPLOADED: '图片上传成功',
    USER_MUTED: '用户已静音',
    USER_UNMUTED: '用户已解除静音',
    MESSAGE_DELETED: '消息已删除',
    CHAT_CLEARED: '聊天记录已清除',
    SETTINGS_SAVED: '设置已保存'
} as const;