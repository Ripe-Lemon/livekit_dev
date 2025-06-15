'use client';

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    color?: 'white' | 'blue' | 'gray' | 'green' | 'red';
    text?: string;
    fullScreen?: boolean;
    overlay?: boolean;
    className?: string;
}

const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
};

const colorClasses = {
    white: 'border-white border-t-transparent',
    blue: 'border-blue-500 border-t-transparent',
    gray: 'border-gray-500 border-t-transparent',
    green: 'border-green-500 border-t-transparent',
    red: 'border-red-500 border-t-transparent'
};

const textColorClasses = {
    white: 'text-white',
    blue: 'text-blue-500',
    gray: 'text-gray-500',
    green: 'text-green-500',
    red: 'text-red-500'
};

export function LoadingSpinner({ 
    size = 'md',
    color = 'white',
    text,
    fullScreen = false,
    overlay = false,
    className = ""
}: LoadingSpinnerProps) {
    const spinnerElement = (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <div 
                className={`
                    ${sizeClasses[size]} 
                    ${colorClasses[color]}
                    border-2 rounded-full animate-spin
                `}
            ></div>
            {text && (
                <p className={`mt-2 text-sm ${textColorClasses[color]}`}>
                    {text}
                </p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className={`
                fixed inset-0 z-50 flex items-center justify-center 
                ${overlay ? 'bg-black/50 backdrop-blur-sm' : 'bg-gray-900'}
            `}>
                {spinnerElement}
            </div>
        );
    }

    return spinnerElement;
}

// 预设的加载组件变体
export function PageLoadingSpinner({ text = "正在加载..." }: { text?: string }) {
    return (
        <LoadingSpinner 
            size="lg" 
            color="white" 
            text={text}
            fullScreen={true}
            overlay={false}
            className="bg-gray-900"
        />
    );
}

export function OverlayLoadingSpinner({ text = "处理中..." }: { text?: string }) {
    return (
        <LoadingSpinner 
            size="lg" 
            color="white" 
            text={text}
            fullScreen={true}
            overlay={true}
        />
    );
}

export function InlineLoadingSpinner({ size = 'sm', color = 'blue' }: { 
    size?: 'sm' | 'md';
    color?: 'white' | 'blue' | 'gray';
}) {
    return (
        <LoadingSpinner 
            size={size} 
            color={color}
            className="inline-flex"
        />
    );
}

// 带有脉冲效果的加载器
export function PulseLoader({ 
    count = 3,
    size = 'md',
    color = 'blue',
    className = ""
}: {
    count?: number;
    size?: 'sm' | 'md' | 'lg';
    color?: 'white' | 'blue' | 'gray' | 'green';
    className?: string;
}) {
    const dotSizes = {
        sm: 'w-2 h-2',
        md: 'w-3 h-3',
        lg: 'w-4 h-4'
    };

    const dotColors = {
        white: 'bg-white',
        blue: 'bg-blue-500',
        gray: 'bg-gray-500',
        green: 'bg-green-500'
    };

    return (
        <div className={`flex items-center space-x-1 ${className}`}>
            {Array.from({ length: count }).map((_, index) => (
                <div
                    key={index}
                    className={`
                        ${dotSizes[size]} 
                        ${dotColors[color]}
                        rounded-full animate-pulse
                    `}
                    style={{
                        animationDelay: `${index * 0.2}s`,
                        animationDuration: '1s'
                    }}
                ></div>
            ))}
        </div>
    );
}

// 骨架屏加载器
export function SkeletonLoader({ 
    lines = 3,
    className = ""
}: {
    lines?: number;
    className?: string;
}) {
    return (
        <div className={`animate-pulse ${className}`}>
            {Array.from({ length: lines }).map((_, index) => (
                <div key={index} className="flex space-x-4 mb-4 last:mb-0">
                    <div className="rounded-full bg-gray-300 h-10 w-10"></div>
                    <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// 进度条加载器
export function ProgressLoader({ 
    progress = 0,
    text,
    color = 'blue',
    className = ""
}: {
    progress?: number;
    text?: string;
    color?: 'blue' | 'green' | 'red';
    className?: string;
}) {
    const progressColors = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        red: 'bg-red-500'
    };

    return (
        <div className={`w-full ${className}`}>
            {text && (
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{text}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
            )}
            <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                    className={`h-2 rounded-full transition-all duration-300 ${progressColors[color]}`}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                ></div>
            </div>
        </div>
    );
}