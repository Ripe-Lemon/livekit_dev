'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Types
interface Notification {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    duration?: number;
    persistent?: boolean;
    actions?: Array<{
        label: string;
        action: () => void;
        style?: 'primary' | 'secondary' | 'danger';
    }>;
}

interface NotificationCenterProps {
    notifications: Notification[];
    onDismiss: (id: string) => void;
    maxNotifications?: number;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    className?: string;
}

interface NotificationItemProps {
    notification: Notification;
    onDismiss: (id: string) => void;
    onAction?: (action: () => void) => void;
}

// 通知类型配置
const NOTIFICATION_CONFIGS = {
    info: {
        icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        bgColor: 'bg-blue-500',
        borderColor: 'border-blue-400',
        textColor: 'text-blue-50',
        titleColor: 'text-white'
    },
    success: {
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        bgColor: 'bg-green-500',
        borderColor: 'border-green-400',
        textColor: 'text-green-50',
        titleColor: 'text-white'
    },
    warning: {
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
        bgColor: 'bg-yellow-500',
        borderColor: 'border-yellow-400',
        textColor: 'text-yellow-50',
        titleColor: 'text-white'
    },
    error: {
        icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        bgColor: 'bg-red-500',
        borderColor: 'border-red-400',
        textColor: 'text-red-50',
        titleColor: 'text-white'
    }
};

// 位置样式配置
const POSITION_STYLES = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
};

// 通知项组件
function NotificationItem({ notification, onDismiss, onAction }: NotificationItemProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);
    const [progress, setProgress] = useState(100);

    const config = NOTIFICATION_CONFIGS[notification.type];
    const duration = notification.duration || 5000;
    const isPersistent = notification.persistent;

    // 显示动画
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
    }, []);

    // 自动消失
    useEffect(() => {
        if (isPersistent) return;

        const startTime = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, duration - elapsed);
            setProgress((remaining / duration) * 100);

            if (remaining <= 0) {
                handleDismiss();
            }
        }, 100);

        return () => clearInterval(interval);
    }, [duration, isPersistent]);

    // 处理消失
    const handleDismiss = useCallback(() => {
        setIsRemoving(true);
        setTimeout(() => {
            onDismiss(notification.id);
        }, 300);
    }, [notification.id, onDismiss]);

    // 处理动作点击
    const handleActionClick = useCallback((action: () => void) => {
        if (onAction) {
            onAction(action);
        } else {
            action();
        }
        handleDismiss();
    }, [onAction, handleDismiss]);

    // 格式化时间
    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div
            className={`
                relative max-w-sm w-full bg-gray-800 border-l-4 ${config.borderColor} 
                rounded-lg shadow-lg overflow-hidden transition-all duration-300 ease-in-out
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
                ${isRemoving ? 'translate-x-full opacity-0 scale-95' : ''}
                ${notification.type === 'error' ? 'ring-1 ring-red-500/50' : ''}
            `}
        >
            {/* 进度条 */}
            {!isPersistent && (
                <div className="absolute top-0 left-0 h-1 bg-gray-700">
                    <div
                        className={`h-full ${config.bgColor} transition-all duration-100 ease-linear`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            <div className="p-4">
                {/* 头部 */}
                <div className="flex items-start space-x-3">
                    {/* 图标 */}
                    <div className={`flex-shrink-0 w-6 h-6 ${config.textColor}`}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} />
                        </svg>
                    </div>

                    {/* 内容 */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h4 className={`text-sm font-medium ${config.titleColor} truncate`}>
                                {notification.title}
                            </h4>
                            <button
                                onClick={handleDismiss}
                                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className="mt-1 text-sm text-gray-300 leading-relaxed">
                            {notification.message}
                        </p>

                        <div className="mt-2 text-xs text-gray-400">
                            {formatTime(notification.timestamp)}
                        </div>

                        {/* 操作按钮 */}
                        {notification.actions && notification.actions.length > 0 && (
                            <div className="mt-3 flex space-x-2">
                                {notification.actions.map((action, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleActionClick(action.action)}
                                        className={`
                                            px-3 py-1 text-xs font-medium rounded transition-colors
                                            ${action.style === 'primary' 
                                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                                : action.style === 'danger'
                                                ? 'bg-red-600 text-white hover:bg-red-700'
                                                : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                                            }
                                        `}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 主组件
export function NotificationCenter({
    notifications = [],
    onDismiss,
    maxNotifications = 5,
    position = 'top-right',
    className = ''
}: NotificationCenterProps) {
    const [mounted, setMounted] = useState(false);

    // 确保只在客户端渲染
    useEffect(() => {
        setMounted(true);
    }, []);

    // 限制显示的通知数量
    const visibleNotifications = notifications
        .slice(0, maxNotifications)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (!mounted || visibleNotifications.length === 0) {
        return null;
    }

    const content = (
        <div className={`fixed ${POSITION_STYLES[position]} z-50 space-y-3 ${className}`}>
            {visibleNotifications.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onDismiss={onDismiss}
                />
            ))}
        </div>
    );

    return createPortal(content, document.body);
}

// 创建通知的工具函数
export function createNotification(
    type: Notification['type'],
    title: string,
    message: string,
    options: Partial<Omit<Notification, 'id' | 'type' | 'title' | 'message' | 'timestamp'>> = {}
): Notification {
    return {
        id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        title,
        message,
        timestamp: new Date(),
        duration: 5000,
        persistent: false,
        ...options
    };
}

// 通知管理器类
export class NotificationManager {
    private static instance: NotificationManager;
    private listeners: Set<(notifications: Notification[]) => void> = new Set();
    private notifications: Notification[] = [];

    static getInstance(): NotificationManager {
        if (!NotificationManager.instance) {
            NotificationManager.instance = new NotificationManager();
        }
        return NotificationManager.instance;
    }

    subscribe(listener: (notifications: Notification[]) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    add(notification: Notification): void {
        this.notifications = [notification, ...this.notifications];
        this.notify();
    }

    remove(id: string): void {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.notify();
    }

    clear(): void {
        this.notifications = [];
        this.notify();
    }

    getAll(): Notification[] {
        return [...this.notifications];
    }

    private notify(): void {
        this.listeners.forEach(listener => listener(this.notifications));
    }

    // 便捷方法
    info(title: string, message: string, options?: Partial<Notification>): void {
        this.add(createNotification('info', title, message, options));
    }

    success(title: string, message: string, options?: Partial<Notification>): void {
        this.add(createNotification('success', title, message, options));
    }

    warning(title: string, message: string, options?: Partial<Notification>): void {
        this.add(createNotification('warning', title, message, options));
    }

    error(title: string, message: string, options?: Partial<Notification>): void {
        this.add(createNotification('error', title, message, options));
    }
}

export default NotificationCenter;