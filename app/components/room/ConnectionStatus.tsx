'use client';

import React, { useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { ConnectionQuality } from 'livekit-client';

interface ConnectionStatusProps {
    compact?: boolean;
    showDetails?: boolean;
    className?: string;
}

export default function ConnectionStatus({ 
    compact = false, 
    showDetails = false, 
    className = '' 
}: ConnectionStatusProps) {
    const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    // 安全地获取 room context
    let room = null;
    try {
        room = useRoomContext();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    // 监听连接状态变化
    useEffect(() => {
        if (!room) {
            setIsConnected(false);
            return;
        }

        setIsConnected(room.state === 'connected');

        const handleStateChange = () => {
            setIsConnected(room.state === 'connected');
        };

        const handleConnectionQualityChanged = (quality: ConnectionQuality) => {
            setConnectionQuality(quality);
        };

        const handleReconnecting = () => {
            setReconnectAttempts(prev => prev + 1);
        };

        const handleReconnected = () => {
            setReconnectAttempts(0);
        };

        room.on('connectionStateChanged', handleStateChange);
        room.on('connectionQualityChanged', handleConnectionQualityChanged);
        room.on('reconnecting', handleReconnecting);
        room.on('reconnected', handleReconnected);

        // 获取初始状态
        if (room.localParticipant) {
            setConnectionQuality(room.localParticipant.connectionQuality);
        }

        return () => {
            room.off('connectionStateChanged', handleStateChange);
            room.off('connectionQualityChanged', handleConnectionQualityChanged);
            room.off('reconnecting', handleReconnecting);
            room.off('reconnected', handleReconnected);
        };
    }, [room]);

    const getQualityColor = (quality: ConnectionQuality | null) => {
        switch (quality) {
            case 'excellent':
                return 'text-green-400';
            case 'good':
                return 'text-yellow-400';
            case 'poor':
                return 'text-orange-400';
            case 'lost':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };

    const getQualityText = (quality: ConnectionQuality | null) => {
        switch (quality) {
            case 'excellent':
                return '优秀';
            case 'good':
                return '良好';
            case 'poor':
                return '较差';
            case 'lost':
                return '丢失';
            default:
                return '未知';
        }
    };

    const getStatusIcon = () => {
        if (!room) {
            return (
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
            );
        }

        if (reconnectAttempts > 0) {
            return (
                <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            );
        }

        if (isConnected) {
            return (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            );
        }

        return (
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        );
    };

    const getSignalBars = () => {
        const bars = [];
        const qualityLevel = connectionQuality === 'excellent' ? 4 : 
                           connectionQuality === 'good' ? 3 :
                           connectionQuality === 'poor' ? 2 : 1;

        for (let i = 1; i <= 4; i++) {
            bars.push(
                <div
                    key={i}
                    className={`w-1 rounded-full ${
                        i <= qualityLevel ? getQualityColor(connectionQuality) : 'bg-gray-600'
                    }`}
                    style={{ height: `${i * 3 + 2}px` }}
                />
            );
        }

        return bars;
    };

    if (compact) {
        return (
            <div className={`flex items-center space-x-2 ${className}`}>
                {getStatusIcon()}
                <div className="flex items-end space-x-0.5">
                    {getSignalBars()}
                </div>
                {reconnectAttempts > 0 && (
                    <span className="text-xs text-yellow-400">
                        重连中...
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={`p-4 bg-gray-700 rounded-lg ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-white">连接状态</h4>
                {getStatusIcon()}
            </div>

            <div className="space-y-3">
                {/* 连接状态 */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">状态:</span>
                    <span className={`text-sm font-medium ${
                        isConnected ? 'text-green-400' : 'text-red-400'
                    }`}>
                        {!room ? '未连接' : 
                         reconnectAttempts > 0 ? '重连中...' :
                         isConnected ? '已连接' : '断开连接'}
                    </span>
                </div>

                {/* 连接质量 */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">质量:</span>
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${getQualityColor(connectionQuality)}`}>
                            {getQualityText(connectionQuality)}
                        </span>
                        <div className="flex items-end space-x-0.5">
                            {getSignalBars()}
                        </div>
                    </div>
                </div>

                {/* 重连次数 */}
                {reconnectAttempts > 0 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">重连次数:</span>
                        <span className="text-sm text-yellow-400">{reconnectAttempts}</span>
                    </div>
                )}

                {/* 详细信息 */}
                {showDetails && room && (
                    <>
                        <div className="border-t border-gray-600 pt-3 mt-3">
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">房间状态:</span>
                                    <span className="text-white">{room.state}</span>
                                </div>
                                {room.engine && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">引擎状态:</span>
                                        <span className="text-white">{room.state}</span>
                                    </div>
                                )}
                                {room.localParticipant && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">参与者ID:</span>
                                        <span className="text-white font-mono text-xs">
                                            {room.localParticipant.sid}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}