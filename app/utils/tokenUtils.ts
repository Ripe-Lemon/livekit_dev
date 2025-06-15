'use client';

import jwt from 'jsonwebtoken';

/**
 * LiveKit Token 工具函数
 */

// LiveKit Token 配置接口
export interface LiveKitTokenConfig {
    apiKey: string;
    apiSecret: string;
    roomName: string;
    participantName: string;
    participantIdentity?: string;
    metadata?: string;
    ttl?: number; // Token 有效期（秒）
    permissions?: {
        canPublish?: boolean;
        canSubscribe?: boolean;
        canPublishData?: boolean;
        canUpdateOwnMetadata?: boolean;
        canPublishSources?: string[];
        hidden?: boolean;
        recorder?: boolean;
        agent?: boolean;
    };
}

// Token 解析结果接口
export interface ParsedToken {
    iss: string; // API Key
    sub: string; // Participant Identity
    aud: string; // Room Name
    exp: number; // 过期时间
    nbf: number; // 生效时间
    iat: number; // 签发时间
    jti: string; // Token ID
    video?: {
        room: string;
        roomJoin: boolean;
        roomList: boolean;
        roomRecord: boolean;
        roomAdmin: boolean;
        roomCreate: boolean;
        canPublish: boolean;
        canSubscribe: boolean;
        canPublishData: boolean;
        canUpdateOwnMetadata: boolean;
        canPublishSources: string[];
        hidden: boolean;
        recorder: boolean;
        agent: boolean;
    };
    metadata?: string;
    name?: string;
}

// Token 验证结果
export interface TokenValidation {
    isValid: boolean;
    isExpired: boolean;
    expiresIn: number; // 剩余有效时间（秒）
    error?: string;
    token?: ParsedToken;
}

// 默认权限配置
const DEFAULT_PERMISSIONS = {
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
    canPublishSources: ['camera', 'microphone', 'screen_share'],
    hidden: false,
    recorder: false,
    agent: false
};

/**
 * 生成 LiveKit Access Token
 */
export function generateAccessToken(config: LiveKitTokenConfig): string {
    const {
        apiKey,
        apiSecret,
        roomName,
        participantName,
        participantIdentity = participantName,
        metadata = '',
        ttl = 3600, // 默认1小时
        permissions = DEFAULT_PERMISSIONS
    } = config;

    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttl;

    // 构建 JWT payload
    const payload = {
        iss: apiKey,
        sub: participantIdentity,
        aud: roomName,
        exp: exp,
        nbf: now,
        iat: now,
        jti: generateTokenId(),
        video: {
            room: roomName,
            roomJoin: true,
            roomList: true,
            roomRecord: false,
            roomAdmin: false,
            roomCreate: false,
            canPublish: permissions.canPublish ?? true,
            canSubscribe: permissions.canSubscribe ?? true,
            canPublishData: permissions.canPublishData ?? true,
            canUpdateOwnMetadata: permissions.canUpdateOwnMetadata ?? true,
            canPublishSources: permissions.canPublishSources ?? ['camera', 'microphone', 'screen_share'],
            hidden: permissions.hidden ?? false,
            recorder: permissions.recorder ?? false,
            agent: permissions.agent ?? false
        },
        metadata: metadata,
        name: participantName
    };

    // 生成 JWT
    return jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
}

/**
 * 解析 Access Token
 */
export function parseAccessToken(token: string, secret?: string): ParsedToken | null {
    try {
        const decoded = jwt.decode(token, { complete: true });
        
        if (!decoded || typeof decoded === 'string') {
            return null;
        }

        return decoded.payload as ParsedToken;
    } catch (error) {
        console.error('Token 解析失败:', error);
        return null;
    }
}

/**
 * 验证 Access Token
 */
export function validateAccessToken(token: string, secret?: string): TokenValidation {
    try {
        // 解析 Token（不验证签名）
        const parsed = parseAccessToken(token);
        
        if (!parsed) {
            return {
                isValid: false,
                isExpired: false,
                expiresIn: 0,
                error: 'Token 格式无效'
            };
        }

        const now = Math.floor(Date.now() / 1000);
        const isExpired = parsed.exp <= now;
        const expiresIn = Math.max(0, parsed.exp - now);

        // 如果提供了密钥，验证签名
        if (secret) {
            try {
                jwt.verify(token, secret, { algorithms: ['HS256'] });
            } catch (verifyError) {
                return {
                    isValid: false,
                    isExpired,
                    expiresIn,
                    error: 'Token 签名验证失败',
                    token: parsed
                };
            }
        }

        return {
            isValid: !isExpired,
            isExpired,
            expiresIn,
            token: parsed
        };
    } catch (error) {
        return {
            isValid: false,
            isExpired: false,
            expiresIn: 0,
            error: error instanceof Error ? error.message : 'Token 验证失败'
        };
    }
}

/**
 * 检查 Token 是否即将过期
 */
export function isTokenExpiringSoon(token: string, thresholdSeconds = 300): boolean {
    const validation = validateAccessToken(token);
    return validation.isValid && validation.expiresIn <= thresholdSeconds;
}

/**
 * 刷新 Token（如果需要）
 */
export async function refreshTokenIfNeeded(
    currentToken: string,
    config: LiveKitTokenConfig,
    thresholdSeconds = 300
): Promise<string> {
    if (isTokenExpiringSoon(currentToken, thresholdSeconds)) {
        return generateAccessToken(config);
    }
    return currentToken;
}

/**
 * 生成唯一的 Token ID
 */
function generateTokenId(): string {
    return `tk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 从 Token 中提取房间信息
 */
export function extractRoomInfo(token: string): {
    roomName?: string;
    participantName?: string;
    participantIdentity?: string;
    metadata?: string;
    permissions?: any;
} {
    const parsed = parseAccessToken(token);
    
    if (!parsed) {
        return {};
    }

    return {
        roomName: parsed.aud,
        participantName: parsed.name,
        participantIdentity: parsed.sub,
        metadata: parsed.metadata,
        permissions: parsed.video
    };
}

/**
 * 检查 Token 权限
 */
export function checkTokenPermissions(token: string): {
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData: boolean;
    canUpdateOwnMetadata: boolean;
    canPublishSources: string[];
    isHidden: boolean;
    isRecorder: boolean;
    isAgent: boolean;
} {
    const parsed = parseAccessToken(token);
    
    if (!parsed || !parsed.video) {
        return {
            canPublish: false,
            canSubscribe: false,
            canPublishData: false,
            canUpdateOwnMetadata: false,
            canPublishSources: [],
            isHidden: false,
            isRecorder: false,
            isAgent: false
        };
    }

    const video = parsed.video;
    
    return {
        canPublish: video.canPublish ?? false,
        canSubscribe: video.canSubscribe ?? false,
        canPublishData: video.canPublishData ?? false,
        canUpdateOwnMetadata: video.canUpdateOwnMetadata ?? false,
        canPublishSources: video.canPublishSources ?? [],
        isHidden: video.hidden ?? false,
        isRecorder: video.recorder ?? false,
        isAgent: video.agent ?? false
    };
}

/**
 * JWT 工具函数
 */

// 生成管理员 Token
export function generateAdminToken(config: {
    apiKey: string;
    apiSecret: string;
    ttl?: number;
}): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (config.ttl ?? 3600);

    const payload = {
        iss: config.apiKey,
        exp: exp,
        nbf: now,
        iat: now,
        jti: generateTokenId(),
        video: {
            roomAdmin: true,
            roomCreate: true,
            roomList: true,
            roomRecord: true
        }
    };

    return jwt.sign(payload, config.apiSecret, { algorithm: 'HS256' });
}

// 生成房间创建 Token
export function generateRoomToken(config: {
    apiKey: string;
    apiSecret: string;
    roomName: string;
    ttl?: number;
}): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (config.ttl ?? 3600);

    const payload = {
        iss: config.apiKey,
        exp: exp,
        nbf: now,
        iat: now,
        jti: generateTokenId(),
        video: {
            room: config.roomName,
            roomCreate: true,
            roomAdmin: true
        }
    };

    return jwt.sign(payload, config.apiSecret, { algorithm: 'HS256' });
}

// 生成只读 Token
export function generateViewerToken(config: LiveKitTokenConfig): string {
    return generateAccessToken({
        ...config,
        permissions: {
            canPublish: false,
            canSubscribe: true,
            canPublishData: false,
            canUpdateOwnMetadata: false,
            canPublishSources: [],
            hidden: true,
            recorder: false,
            agent: false
        }
    });
}

// 生成录制 Token
export function generateRecorderToken(config: LiveKitTokenConfig): string {
    return generateAccessToken({
        ...config,
        participantIdentity: `recorder_${config.participantIdentity || config.participantName}`,
        permissions: {
            canPublish: false,
            canSubscribe: true,
            canPublishData: false,
            canUpdateOwnMetadata: false,
            canPublishSources: [],
            hidden: true,
            recorder: true,
            agent: false
        }
    });
}

/**
 * Token 缓存管理
 */
class TokenCache {
    private cache: Map<string, { token: string; expires: number }> = new Map();

    set(key: string, token: string, ttl: number): void {
        const expires = Date.now() + (ttl * 1000);
        this.cache.set(key, { token, expires });
    }

    get(key: string): string | null {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }

        return entry.token;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // 清理过期的 Token
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expires) {
                this.cache.delete(key);
            }
        }
    }
}

// 全局 Token 缓存实例
export const tokenCache = new TokenCache();

/**
 * 带缓存的 Token 生成
 */
export function getCachedToken(
    cacheKey: string,
    config: LiveKitTokenConfig,
    useCache = true
): string {
    if (useCache) {
        const cached = tokenCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }

    const token = generateAccessToken(config);
    
    if (useCache) {
        tokenCache.set(cacheKey, token, config.ttl ?? 3600);
    }

    return token;
}

/**
 * Token 安全工具
 */

// 掩码显示 Token（用于日志）
export function maskToken(token: string): string {
    if (token.length <= 20) {
        return '*'.repeat(token.length);
    }
    
    const start = token.substring(0, 8);
    const end = token.substring(token.length - 8);
    const middle = '*'.repeat(token.length - 16);
    
    return `${start}${middle}${end}`;
}

// 验证 Token 格式
export function isValidTokenFormat(token: string): boolean {
    // JWT 格式检查：header.payload.signature
    const parts = token.split('.');
    
    if (parts.length !== 3) {
        return false;
    }

    try {
        // 验证每个部分都是有效的 Base64
        parts.forEach(part => {
            atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        });
        return true;
    } catch (error) {
        return false;
    }
}

// 获取 Token 的哈希值（用于比较）
export function getTokenHash(token: string): string {
    // 简单的哈希实现（生产环境建议使用更强的哈希算法）
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
        const char = token.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
}

/**
 * Token 监控和分析
 */
export interface TokenUsageStats {
    totalGenerated: number;
    totalValidated: number;
    totalExpired: number;
    averageTTL: number;
    mostUsedRoom: string;
    recentActivity: Array<{
        action: 'generate' | 'validate' | 'expire';
        timestamp: number;
        roomName?: string;
        participantName?: string;
    }>;
}

class TokenMonitor {
    private stats: TokenUsageStats = {
        totalGenerated: 0,
        totalValidated: 0,
        totalExpired: 0,
        averageTTL: 0,
        mostUsedRoom: '',
        recentActivity: []
    };

    recordGeneration(config: LiveKitTokenConfig): void {
        this.stats.totalGenerated++;
        this.addActivity('generate', {
            roomName: config.roomName,
            participantName: config.participantName
        });
    }

    recordValidation(token: string): void {
        this.stats.totalValidated++;
        const info = extractRoomInfo(token);
        this.addActivity('validate', {
            roomName: info.roomName,
            participantName: info.participantName
        });
    }

    recordExpiration(token: string): void {
        this.stats.totalExpired++;
        const info = extractRoomInfo(token);
        this.addActivity('expire', {
            roomName: info.roomName,
            participantName: info.participantName
        });
    }

    getStats(): TokenUsageStats {
        return { ...this.stats };
    }

    resetStats(): void {
        this.stats = {
            totalGenerated: 0,
            totalValidated: 0,
            totalExpired: 0,
            averageTTL: 0,
            mostUsedRoom: '',
            recentActivity: []
        };
    }

    private addActivity(
        action: 'generate' | 'validate' | 'expire',
        data: { roomName?: string; participantName?: string }
    ): void {
        this.stats.recentActivity.push({
            action,
            timestamp: Date.now(),
            ...data
        });

        // 保持最近100条记录
        if (this.stats.recentActivity.length > 100) {
            this.stats.recentActivity.shift();
        }
    }
}

// 全局 Token 监控实例
export const tokenMonitor = new TokenMonitor();

/**
 * Token 批量管理
 */
export function generateBatchTokens(
    baseConfig: Omit<LiveKitTokenConfig, 'participantName'>,
    participants: string[]
): Record<string, string> {
    const tokens: Record<string, string> = {};
    
    participants.forEach(participantName => {
        const config: LiveKitTokenConfig = {
            ...baseConfig,
            participantName
        };
        
        tokens[participantName] = generateAccessToken(config);
        tokenMonitor.recordGeneration(config);
    });
    
    return tokens;
}

// 导出默认配置
export const DEFAULT_TOKEN_CONFIG = {
    ttl: 3600, // 1小时
    permissions: DEFAULT_PERMISSIONS,
    algorithm: 'HS256' as const,
    cacheEnabled: true,
    monitoringEnabled: true
};

// 工具函数：从环境变量获取配置
export function getTokenConfigFromEnv(): Pick<LiveKitTokenConfig, 'apiKey' | 'apiSecret'> {
    const apiKey = process.env.LIVEKIT_API_KEY || process.env.NEXT_PUBLIC_LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
        throw new Error('LiveKit API Key 和 Secret 必须通过环境变量配置');
    }

    return { apiKey, apiSecret };
}

export default {
    generateAccessToken,
    parseAccessToken,
    validateAccessToken,
    refreshTokenIfNeeded,
    extractRoomInfo,
    checkTokenPermissions,
    generateAdminToken,
    generateViewerToken,
    generateRecorderToken,
    getCachedToken,
    maskToken,
    isValidTokenFormat,
    tokenCache,
    tokenMonitor
};