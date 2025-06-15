'use client';

import React from 'react';

/**
 * 消息内容处理工具函数
 */

// URL 正则表达式
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

// 提及用户正则表达式
const MENTION_REGEX = /@([a-zA-Z0-9_]+)/g;

// 表情符号正则表达式
const EMOJI_REGEX = /:([a-zA-Z0-9_+\-]+):/g;

// 邮箱正则表达式
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// 电话号码正则表达式
const PHONE_REGEX = /(\+?86)?[\s-]?1[3-9]\d{9}/g;

/**
 * 检查字符串是否为图片URL
 */
export function isImageUrl(url: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowercaseUrl = url.toLowerCase();
    
    // 检查文件扩展名
    const hasImageExtension = imageExtensions.some(ext => 
        lowercaseUrl.includes(ext)
    );
    
    // 检查是否包含图片相关的查询参数或路径
    const hasImageIndicators = /\b(image|img|photo|picture|pic)\b/i.test(url);
    
    return hasImageExtension || hasImageIndicators;
}

/**
 * 检查字符串是否为视频URL
 */
export function isVideoUrl(url: string): boolean {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
    const lowercaseUrl = url.toLowerCase();
    
    return videoExtensions.some(ext => lowercaseUrl.includes(ext)) ||
           /\b(video|movie|film)\b/i.test(url);
}

/**
 * 从文本中提取所有URL
 */
export function extractUrls(text: string): string[] {
    const matches = text.match(URL_REGEX);
    return matches ? [...new Set(matches)] : []; // 去重
}

/**
 * 从文本中提取所有提及的用户
 */
export function extractMentions(text: string): string[] {
    const matches = text.match(MENTION_REGEX);
    return matches ? matches.map(match => match.substring(1)) : []; // 移除@符号
}

/**
 * 从文本中提取所有表情符号代码
 */
export function extractEmojis(text: string): string[] {
    const matches = text.match(EMOJI_REGEX);
    return matches ? matches.map(match => match.slice(1, -1)) : []; // 移除冒号
}

/**
 * 从文本中提取邮箱地址
 */
export function extractEmails(text: string): string[] {
    const matches = text.match(EMAIL_REGEX);
    return matches ? [...new Set(matches)] : [];
}

/**
 * 从文本中提取电话号码
 */
export function extractPhoneNumbers(text: string): string[] {
    const matches = text.match(PHONE_REGEX);
    return matches ? [...new Set(matches)] : [];
}

/**
 * 格式化消息中的提及用户
 */
export function formatMentions(
    text: string, 
    onMentionClick?: (username: string) => void
): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // 查找所有提及
    let match;
    MENTION_REGEX.lastIndex = 0; // 重置正则表达式
    
    while ((match = MENTION_REGEX.exec(text)) !== null) {
        const [fullMatch, username] = match;
        const startIndex = match.index!;
        
        // 添加提及前的文本
        if (startIndex > lastIndex) {
            parts.push(text.substring(lastIndex, startIndex));
        }
        
        // 添加格式化的提及
        parts.push(
            React.createElement(
                'button',
                {
                    key: `mention-${startIndex}`,
                    className: 'text-blue-400 hover:text-blue-300 underline cursor-pointer',
                    onClick: () => onMentionClick?.(username)
                },
                fullMatch
            )
        );
        
        lastIndex = startIndex + fullMatch.length;
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : [text];
}

/**
 * 格式化消息中的URL链接
 */
export function formatUrls(
    text: string,
    onUrlClick?: (url: string) => void
): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    let match;
    URL_REGEX.lastIndex = 0;
    
    while ((match = URL_REGEX.exec(text)) !== null) {
        const url = match[0];
        const startIndex = match.index!;
        
        // 添加URL前的文本
        if (startIndex > lastIndex) {
            parts.push(text.substring(lastIndex, startIndex));
        }
        
        // 添加格式化的链接
        parts.push(
            React.createElement(
                'button',
                {
                    key: `url-${startIndex}`,
                    className: 'text-blue-400 hover:text-blue-300 underline cursor-pointer break-all',
                    onClick: () => onUrlClick?.(url)
                },
                url
            )
        );
        
        lastIndex = startIndex + url.length;
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : [text];
}

/**
 * 格式化完整的消息文本（包含提及、URL等）
 */
export function formatMessageText(
    text: string,
    options: {
        onMentionClick?: (username: string) => void;
        onUrlClick?: (url: string) => void;
        enableEmojis?: boolean;
        maxLength?: number;
    } = {}
): React.ReactNode[] {
    let processedText = text;
    
    // 截断文本（如果需要）
    if (options.maxLength && processedText.length > options.maxLength) {
        processedText = processedText.substring(0, options.maxLength) + '...';
    }
    
    // 首先处理URL
    let parts = formatUrls(processedText, options.onUrlClick);
    
    // 然后处理提及（对于非链接的文本部分）
    const finalParts: React.ReactNode[] = [];
    
    parts.forEach((part, index) => {
        if (typeof part === 'string') {
            const mentionParts = formatMentions(part, options.onMentionClick);
            finalParts.push(...mentionParts);
        } else {
            finalParts.push(part);
        }
    });
    
    return finalParts;
}

/**
 * 清理和验证消息文本
 */
export function sanitizeMessageText(text: string): string {
    return text
        .trim() // 移除首尾空白
        .replace(/\s+/g, ' ') // 将多个空白字符替换为单个空格
        .replace(/\n{3,}/g, '\n\n') // 限制连续换行数量
        .substring(0, 2000); // 限制最大长度
}

/**
 * 检查消息是否包含敏感内容
 */
export function containsSensitiveContent(text: string): boolean {
    // 这里可以添加敏感词检测逻辑
    // 敏感词列表类型
    interface SensitiveWord {
        word: string;
        severity: 'low' | 'medium' | 'high';
    }

    // 简单的敏感词数组，可以扩展为更复杂的结构
    const sensitiveWords: string[] = [
        // 添加需要过滤的敏感词
    ];
    
    const lowerText = text.toLowerCase();
    return sensitiveWords.some(word => lowerText.includes(word.toLowerCase()));
}

/**
 * 生成消息摘要
 */
export function generateMessageSummary(text: string, maxLength = 50): string {
    let summary = text.replace(/\n/g, ' ').trim();
    
    if (summary.length <= maxLength) {
        return summary;
    }
    
    // 尝试在单词边界截断
    const truncated = summary.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxLength * 0.8) {
        return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
}

/**
 * 检查消息是否为命令
 */
export function isCommand(text: string): boolean {
    return text.startsWith('/');
}

/**
 * 解析命令
 */
export function parseCommand(text: string): {
    command: string;
    args: string[];
    fullText: string;
} {
    if (!isCommand(text)) {
        return { command: '', args: [], fullText: text };
    }
    
    const parts = text.substring(1).split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    return { command, args, fullText: text };
}

/**
 * 格式化代码块
 */
export function formatCodeBlock(text: string): React.ReactNode {
    // 检查是否为代码块（用```包围）
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;
    
    let result = text;
    
    // 处理代码块
    result = result.replace(codeBlockRegex, (match, language, code) => {
        return `<pre class="bg-gray-800 p-3 rounded text-green-400 overflow-x-auto"><code${language ? ` class="language-${language}"` : ''}>${code.trim()}</code></pre>`;
    });
    
    // 处理内联代码
    result = result.replace(inlineCodeRegex, (match, code) => {
        return `<code class="bg-gray-700 px-1 rounded text-green-400">${code}</code>`;
    });
    
    return React.createElement('div', {
        dangerouslySetInnerHTML: { __html: result }
    });
}

/**
 * 计算消息相似度
 */
export function calculateMessageSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
}

/**
 * 消息搜索和高亮
 */
export function highlightSearchTerms(
    text: string, 
    searchTerms: string[],
    className = 'bg-yellow-300 text-black'
): React.ReactNode {
    if (searchTerms.length === 0) {
        return text;
    }
    
    let result = text;
    
    searchTerms.forEach((term, index) => {
        const regex = new RegExp(`(${term})`, 'gi');
        result = result.replace(regex, `<mark class="${className}" data-term="${index}">$1</mark>`);
    });
    
    return React.createElement('span', {
        dangerouslySetInnerHTML: { __html: result }
    });
}

/**
 * 消息加密/解密（简单示例）
 */
export function encodeMessage(text: string, key = 'default'): string {
    // 简单的Base64编码示例
    return btoa(encodeURIComponent(text));
}

export function decodeMessage(encodedText: string): string {
    try {
        return decodeURIComponent(atob(encodedText));
    } catch (error) {
        console.error('消息解码失败:', error);
        return encodedText;
    }
}

/**
 * 消息统计
 */
export function getMessageStats(text: string): {
    characters: number;
    words: number;
    lines: number;
    urls: number;
    mentions: number;
    emojis: number;
} {
    return {
        characters: text.length,
        words: text.split(/\s+/).filter(word => word.length > 0).length,
        lines: text.split('\n').length,
        urls: extractUrls(text).length,
        mentions: extractMentions(text).length,
        emojis: extractEmojis(text).length
    };
}

/**
 * 消息类型检测
 */
export function detectMessageType(text: string): 'text' | 'command' | 'url' | 'mention' | 'mixed' {
    if (isCommand(text)) return 'command';
    
    const hasUrls = extractUrls(text).length > 0;
    const hasMentions = extractMentions(text).length > 0;
    
    if (hasUrls && hasMentions) return 'mixed';
    if (hasUrls) return 'url';
    if (hasMentions) return 'mention';
    
    return 'text';
}

/**
 * 消息验证
 */
export function validateMessage(text: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 检查长度
    if (text.length === 0) {
        errors.push('消息不能为空');
    } else if (text.length > 2000) {
        errors.push('消息长度不能超过2000字符');
    }
    
    // 检查敏感内容
    if (containsSensitiveContent(text)) {
        warnings.push('消息可能包含敏感内容');
    }
    
    // 检查过多的大写字母
    const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (uppercaseRatio > 0.5 && text.length > 10) {
        warnings.push('消息包含过多大写字母');
    }
    
    // 检查重复字符
    if (/(.)\1{4,}/.test(text)) {
        warnings.push('消息包含重复字符');
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

// 导出常用的正则表达式
export const MESSAGE_PATTERNS = {
    URL: URL_REGEX,
    MENTION: MENTION_REGEX,
    EMOJI: EMOJI_REGEX,
    EMAIL: EMAIL_REGEX,
    PHONE: PHONE_REGEX,
    CODE_BLOCK: /```(\w+)?\n?([\s\S]*?)```/g,
    INLINE_CODE: /`([^`]+)`/g,
    HASHTAG: /#([a-zA-Z0-9_]+)/g,
    BOLD: /\*\*(.*?)\*\*/g,
    ITALIC: /\*(.*?)\*/g,
    STRIKETHROUGH: /~~(.*?)~~/g
};

// 导出默认配置
export const DEFAULT_MESSAGE_CONFIG = {
    maxLength: 2000,
    enableMentions: true,
    enableUrls: true,
    enableEmojis: true,
    enableFormatting: true,
    sanitizeHtml: true,
    detectCommands: true
};