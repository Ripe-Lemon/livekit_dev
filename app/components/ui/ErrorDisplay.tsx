'use client';

import React from 'react';
import Link from 'next/link';

interface ErrorDisplayProps {
    title?: string;
    message: string;
    details?: string;
    showRetry?: boolean;
    onRetry?: () => void;
    showHome?: boolean;
    homeUrl?: string;
    type?: 'error' | 'warning' | 'info';
    fullScreen?: boolean;
    className?: string;
}

const typeConfig = {
    error: {
        icon: (
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        iconColor: 'text-red-500',
        titleColor: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200'
    },
    warning: {
        icon: (
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
        ),
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
    },
    info: {
        icon: (
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
        ),
        iconColor: 'text-blue-500',
        titleColor: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
    }
};

export function ErrorDisplay({
    title,
    message,
    details,
    showRetry = false,
    onRetry,
    showHome = true,
    homeUrl = '/',
    type = 'error',
    fullScreen = false,
    className = ""
}: ErrorDisplayProps) {
    const config = typeConfig[type];
    
    const content = (
        <div className={`
            flex flex-col items-center justify-center text-center p-8
            ${fullScreen ? 'min-h-screen' : 'min-h-[400px]'}
            ${className}
        `}>
            {/* 错误图标 */}
            <div className={`mb-4 ${config.iconColor}`}>
                {config.icon}
            </div>

            {/* 标题 */}
            <h1 className={`text-2xl font-bold mb-4 ${config.titleColor}`}>
                {title || (type === 'error' ? '出现错误' : type === 'warning' ? '警告' : '提示')}
            </h1>

            {/* 主要错误信息 */}
            <div className={`
                max-w-md mx-auto p-4 rounded-lg border
                ${config.bgColor} ${config.borderColor}
            `}>
                <p className="text-gray-700 text-lg leading-relaxed">
                    {message}
                </p>
            </div>

            {/* 详细信息 */}
            {details && (
                <details className="mt-4 max-w-lg mx-auto">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800 text-sm">
                        查看详细信息
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 rounded border text-left">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto">
                            {details}
                        </pre>
                    </div>
                </details>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-8">
                {showRetry && onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        重试
                    </button>
                )}

                {showHome && (
                    <Link
                        href={homeUrl}
                        className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                        <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        返回首页
                    </Link>
                )}
            </div>

            {/* 帮助文本 */}
            <div className="mt-8 text-sm text-gray-500 max-w-md">
                <p>如果问题持续存在，请：</p>
                <ul className="mt-2 text-left list-disc list-inside space-y-1">
                    <li>检查网络连接</li>
                    <li>刷新页面重试</li>
                    <li>清除浏览器缓存</li>
                    <li>联系技术支持</li>
                </ul>
            </div>
        </div>
    );

    if (fullScreen) {
        return (
            <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto">
                {content}
            </div>
        );
    }

    return content;
}

// 预设的错误组件变体
export function ConnectionError({ 
    onRetry, 
    details 
}: { 
    onRetry?: () => void; 
    details?: string;
}) {
    return (
        <ErrorDisplay
            title="连接失败"
            message="无法连接到服务器，请检查网络连接后重试"
            details={details}
            showRetry={true}
            onRetry={onRetry}
            type="error"
            fullScreen={true}
        />
    );
}

export function RoomNotFound({ roomName }: { roomName?: string }) {
    return (
        <ErrorDisplay
            title="房间不存在"
            message={roomName ? `房间 "${roomName}" 不存在或已关闭` : "请求的房间不存在"}
            showRetry={false}
            type="warning"
            fullScreen={true}
        />
    );
}

export function PermissionDenied({ 
    permission = "摄像头和麦克风"
}: { 
    permission?: string;
}) {
    return (
        <ErrorDisplay
            title="权限被拒绝"
            message={`需要${permission}权限才能加入房间，请在浏览器设置中允许该权限`}
            showRetry={false}
            type="warning"
            fullScreen={true}
        />
    );
}

export function InlineError({ 
    message, 
    onDismiss 
}: { 
    message: string; 
    onDismiss?: () => void;
}) {
    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
                <div className="text-red-500 mr-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-red-700 text-sm">{message}</p>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-red-400 hover:text-red-600 ml-2"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    );
}