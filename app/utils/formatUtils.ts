'use client';

/**
 * 时间格式化工具函数
 */

// 格式化时间戳为可读时间
export function formatTime(timestamp: number | Date | string): string {
    let date: Date;
    
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        date = timestamp;
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
        return '无效时间';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // 如果是今天
    if (days === 0) {
        if (hours === 0) {
            if (minutes === 0) {
                return seconds < 30 ? '刚刚' : `${seconds}秒前`;
            }
            return `${minutes}分钟前`;
        }
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 如果是昨天
    if (days === 1) {
        return `昨天 ${date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }

    // 如果是本周内
    if (days <= 7) {
        return `${days}天前`;
    }

    // 如果是本年内
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('zh-CN', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 超过一年
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    });
}

// 格式化详细时间
export function formatDetailedTime(timestamp: number | Date | string): string {
    let date: Date;
    
    if (typeof timestamp === 'number') {
        date = new Date(timestamp);
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else {
        date = timestamp;
    }

    if (isNaN(date.getTime())) {
        return '无效时间';
    }

    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 格式化持续时间
export function formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}天 ${hours % 24}小时`;
    }
    if (hours > 0) {
        return `${hours}小时 ${minutes % 60}分钟`;
    }
    if (minutes > 0) {
        return `${minutes}分钟 ${seconds % 60}秒`;
    }
    return `${seconds}秒`;
}

/**
 * 文件大小格式化工具函数
 */

export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatBandwidth(bytesPerSecond: number): string {
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * 数字格式化工具函数
 */

export function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

export function formatPercent(value: number, total: number): string {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
}

export function formatLatency(ms: number): string {
    if (ms < 1) {
        return '<1ms';
    }
    if (ms >= 1000) {
        return (ms / 1000).toFixed(2) + 's';
    }
    return Math.round(ms) + 'ms';
}

/**
 * 文本格式化工具函数
 */

export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

export function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatUsername(username: string): string {
    // 移除特殊字符，只保留字母数字和下划线
    return username.replace(/[^a-zA-Z0-9_]/g, '');
}

export function formatDisplayName(name: string): string {
    if (!name) return '匿名用户';
    return name.trim().substring(0, 50); // 限制显示名长度
}

/**
 * URL 和链接格式化
 */

export function formatUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    return url;
}

export function getDomainFromUrl(url: string): string {
    try {
        const urlObj = new URL(formatUrl(url));
        return urlObj.hostname;
    } catch (error) {
        return url;
    }
}

/**
 * 货币和价格格式化
 */

export function formatCurrency(amount: number, currency = 'CNY'): string {
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

export function formatPrice(price: number): string {
    if (price === 0) return '免费';
    return formatCurrency(price);
}

/**
 * 日期范围格式化
 */

export function formatDateRange(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString('zh-CN');
    const endStr = end.toLocaleDateString('zh-CN');
    
    if (startStr === endStr) {
        return startStr;
    }
    
    return `${startStr} - ${endStr}`;
}

export function formatTimeRange(start: Date, end: Date): string {
    const startTime = start.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    const endTime = end.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `${startTime} - ${endTime}`;
}

/**
 * 版本号格式化
 */

export function formatVersion(version: string): string {
    // 清理版本号字符串
    const cleanVersion = version.replace(/[^0-9.]/g, '');
    const parts = cleanVersion.split('.');
    
    // 确保至少有三个部分 (major.minor.patch)
    while (parts.length < 3) {
        parts.push('0');
    }
    
    return parts.slice(0, 3).join('.');
}

/**
 * 电话号码格式化
 */

export function formatPhoneNumber(phone: string): string {
    // 移除所有非数字字符
    const cleaned = phone.replace(/\D/g, '');
    
    // 中国手机号格式化
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    
    // 其他格式保持原样
    return phone;
}

/**
 * 地址格式化
 */

export function formatAddress(address: {
    province?: string;
    city?: string;
    district?: string;
    street?: string;
}): string {
    const parts = [address.province, address.city, address.district, address.street];
    return parts.filter(Boolean).join(' ');
}

/**
 * 分辨率格式化
 */

export function formatResolution(width: number, height: number): string {
    return `${width}×${height}`;
}

export function formatAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
}

/**
 * 质量等级格式化
 */

export function formatQuality(quality: number): string {
    if (quality >= 0.9) return '极高';
    if (quality >= 0.7) return '高';
    if (quality >= 0.5) return '中等';
    if (quality >= 0.3) return '低';
    return '极低';
}

/**
 * 网络状态格式化
 */

export function formatConnectionState(state: string): string {
    const stateMap: Record<string, string> = {
        'connected': '已连接',
        'connecting': '连接中',
        'disconnected': '已断开',
        'reconnecting': '重连中',
        'failed': '连接失败'
    };
    
    return stateMap[state] || state;
}

/**
 * 错误消息格式化
 */

export function formatErrorMessage(error: Error | string): string {
    if (typeof error === 'string') {
        return error;
    }
    
    // 常见错误消息本地化
    const errorMap: Record<string, string> = {
        'Network Error': '网络错误',
        'Timeout': '连接超时',
        'Permission denied': '权限被拒绝',
        'Not found': '未找到',
        'Internal Server Error': '服务器内部错误'
    };
    
    return errorMap[error.message] || error.message || '未知错误';
}

/**
 * 设备信息格式化
 */

export function formatDeviceInfo(device: {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
}): string {
    if (device.label) {
        return device.label;
    }
    
    const kindMap: Record<MediaDeviceKind, string> = {
        'audioinput': '麦克风',
        'audiooutput': '扬声器',
        'videoinput': '摄像头'
    };
    
    const kindName = kindMap[device.kind] || device.kind;
    const shortId = device.deviceId.substring(0, 8);
    
    return `${kindName} (${shortId})`;
}

/**
 * 数据使用量格式化
 */

export function formatDataUsage(bytes: number): {
    value: number;
    unit: string;
    formatted: string;
} {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    let index = 0;
    let value = bytes;
    
    while (value >= 1024 && index < sizes.length - 1) {
        value /= 1024;
        index++;
    }
    
    const formatted = value.toFixed(index === 0 ? 0 : 2) + ' ' + sizes[index];
    
    return {
        value: parseFloat(value.toFixed(2)),
        unit: sizes[index],
        formatted
    };
}

/**
 * 统计数据格式化
 */

export function formatStatistic(
    value: number, 
    type: 'count' | 'percentage' | 'bytes' | 'duration' | 'latency'
): string {
    switch (type) {
        case 'count':
            return formatNumber(value);
        case 'percentage':
            return value.toFixed(1) + '%';
        case 'bytes':
            return formatFileSize(value);
        case 'duration':
            return formatDuration(value);
        case 'latency':
            return formatLatency(value);
        default:
            return value.toString();
    }
}

// 导出默认格式化配置
export const DEFAULT_FORMAT_OPTIONS = {
    time: {
        locale: 'zh-CN',
        timeZone: 'Asia/Shanghai'
    },
    number: {
        locale: 'zh-CN',
        currency: 'CNY'
    },
    file: {
        unit: 'binary' as const, // 使用1024作为基数
        precision: 2
    }
};