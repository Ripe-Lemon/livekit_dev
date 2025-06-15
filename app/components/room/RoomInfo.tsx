'use client';

import React, { useState, useEffect } from 'react';
import { useRoomContext, useParticipants } from '@livekit/components-react';
import { formatDisplayTime } from '../../utils/chatUtils';

interface RoomInfoProps {
    className?: string;
}

export default function RoomInfo({ className = '' }: RoomInfoProps) {
    const room = useRoomContext();
    const participants = useParticipants();
    const [connectionTime, setConnectionTime] = useState<Date | null>(null);
    const [duration, setDuration] = useState<string>('00:00');
    const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown');

    // 格式化持续时间
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // 监听房间连接状态
    useEffect(() => {
        if (room.state === 'connected' && !connectionTime) {
            setConnectionTime(new Date());
        }
    }, [room.state, connectionTime]);

    // 更新持续时间
    useEffect(() => {
        if (!connectionTime) return;

        const updateDuration = () => {
            const now = new Date();
            const diffSeconds = Math.floor((now.getTime() - connectionTime.getTime()) / 1000);
            setDuration(formatDuration(diffSeconds));
        };

        updateDuration();
        const interval = setInterval(updateDuration, 1000);

        return () => clearInterval(interval);
    }, [connectionTime]);

    // 监听连接质量
    useEffect(() => {
        const updateConnectionQuality = async () => {
            // 这里可以根据实际的连接统计数据来判断质量
            // 目前使用简单的逻辑
            if (room.engine) {
                const serverAddress = await room.engine.getConnectedServerAddress();
                if (serverAddress) {
                    // 可以基于 ping、丢包率等数据来判断
                    setConnectionQuality('good');
                } else {
                    setConnectionQuality('unknown');
                }
            }
        };

        updateConnectionQuality();
        const interval = setInterval(updateConnectionQuality, 5000);

        return () => clearInterval(interval);
    }, [room]);

    // 获取连接质量颜色
    const getQualityColor = (quality: typeof connectionQuality) => {
        switch (quality) {
            case 'excellent':
                return 'text-green-400';
            case 'good':
                return 'text-yellow-400';
            case 'poor':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };

    // 获取连接质量图标
    const getQualityIcon = (quality: typeof connectionQuality) => {
        const baseClass = "w-4 h-4";
        
        switch (quality) {
            case 'excellent':
                return (
                    <svg className={`${baseClass} text-green-400`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v8h10V6H5z" clipRule="evenodd"/>
                        <circle cx="10" cy="10" r="3" fill="currentColor"/>
                    </svg>
                );
            case 'good':
                return (
                    <svg className={`${baseClass} text-yellow-400`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v8h10V6H5z" clipRule="evenodd"/>
                        <circle cx="10" cy="10" r="2" fill="currentColor"/>
                    </svg>
                );
            case 'poor':
                return (
                    <svg className={`${baseClass} text-red-400`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v8h10V6H5z" clipRule="evenodd"/>
                        <circle cx="10" cy="10" r="1" fill="currentColor"/>
                    </svg>
                );
            default:
                return (
                    <svg className={`${baseClass} text-gray-400`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2v8h10V6H5z" clipRule="evenodd"/>
                    </svg>
                );
        }
    };

    return (
        <div className={`flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300 ${className}`}>
            {/* 房间名称 */}
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-400"
                >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73L12 2L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                <span className="font-medium text-white">
                    {room.name || '会议室'}
                </span>
            </div>

            {/* 分隔符 */}
            <div className="h-4 w-px bg-gray-600" />

            {/* 参与者数量 */}
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-green-400"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>
                    {participants.length} 人在线
                </span>
            </div>

            {/* 分隔符 */}
            <div className="h-4 w-px bg-gray-600" />

            {/* 持续时间 */}
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-400"
                >
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                </svg>
                <span className="font-mono">
                    {duration}
                </span>
            </div>

            {/* 分隔符 */}
            <div className="h-4 w-px bg-gray-600" />

            {/* 连接状态 */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                    {getQualityIcon(connectionQuality)}
                    <span className={getQualityColor(connectionQuality)}>
                        {room.state === 'connected' ? '已连接' : '连接中...'}
                    </span>
                </div>
            </div>

            {/* 连接时间（仅在较大屏幕显示） */}
            {connectionTime && (
                <>
                    <div className="hidden md:block h-4 w-px bg-gray-600" />
                    <div className="hidden md:flex items-center gap-2">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-orange-400"
                        >
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span className="text-xs">
                            {formatDisplayTime(connectionTime)} 加入
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}