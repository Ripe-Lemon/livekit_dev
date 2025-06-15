'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRoomContext, useConnectionState } from '@livekit/components-react';
import { ConnectionQuality, ConnectionState } from 'livekit-client';

// Components
import { LoadingSpinner } from '../ui/LoadingSpinner';

// Types
interface ConnectionStatusProps {
    className?: string;
    showDetails?: boolean;
    compact?: boolean;
}

interface ConnectionMetrics {
    quality: ConnectionQuality;
    state: ConnectionState;
    latency: number;
    jitter: number;
    packetLoss: number;
    bitrate: {
        audio: number;
        video: number;
    };
    lastUpdated: Date;
}

interface QualityConfig {
    label: string;
    color: string;
    bgColor: string;
    icon: string;
    description: string;
}

const QUALITY_CONFIGS: Record<ConnectionQuality, QualityConfig> = {
    [ConnectionQuality.Excellent]: {
        label: '优秀',
        color: 'text-green-400',
        bgColor: 'bg-green-500',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        description: '连接质量优秀'
    },
    [ConnectionQuality.Good]: {
        label: '良好',
        color: 'text-blue-400',
        bgColor: 'bg-blue-500',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        description: '连接质量良好'
    },
    [ConnectionQuality.Poor]: {
        label: '较差',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500',
        icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z',
        description: '连接质量较差'
    },
    [ConnectionQuality.Lost]: {
        label: '断开',
        color: 'text-red-400',
        bgColor: 'bg-red-500',
        icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
        description: '连接已断开'
    },
    [ConnectionQuality.Unknown]: {
        label: '未知',
        color: 'text-gray-400',
        bgColor: 'bg-gray-500',
        icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        description: '连接状态未知'
    }
};

const STATE_CONFIGS: Record<ConnectionState, { label: string; color: string }> = {
    [ConnectionState.Disconnected]: { label: '已断开', color: 'text-red-400' },
    [ConnectionState.Connecting]: { label: '连接中', color: 'text-yellow-400' },
    [ConnectionState.Connected]: { label: '已连接', color: 'text-green-400' },
    [ConnectionState.Reconnecting]: { label: '重连中', color: 'text-yellow-400' },
    [ConnectionState.SignalReconnecting]: { label: '信号重连中', color: 'text-yellow-400' }
};

export function ConnectionStatus({ 
    className = '', 
    showDetails = false,
    compact = false 
}: ConnectionStatusProps) {
    const room = useRoomContext();
    const connectionState = useConnectionState();
    
    const [metrics, setMetrics] = useState<ConnectionMetrics>({
        quality: ConnectionQuality.Unknown,
        state: ConnectionState.Disconnected,
        latency: 0,
        jitter: 0,
        packetLoss: 0,
        bitrate: { audio: 0, video: 0 },
        lastUpdated: new Date()
    });

    const [showTooltip, setShowTooltip] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // 更新连接指标
    const updateMetrics = useCallback(() => {
        if (!room) return;

        setMetrics(prev => ({
            ...prev,
            quality: ConnectionQuality.Unknown, // Will need to implement quality detection logic
            state: connectionState || ConnectionState.Disconnected,
            lastUpdated: new Date()
        }));
    }, [room, connectionState]);

    // 获取详细统计信息
    const getDetailedStats = useCallback(async () => {
        if (!room || room.state !== ConnectionState.Connected) return;

        try {
            const stats = await room.engine.getConnectedServerAddress();
            // 这里可以获取更详细的统计信息
            // 实际实现需要根据 LiveKit 的 API 来获取统计数据
        } catch (error) {
            console.warn('获取连接统计失败:', error);
        }
    }, [room]);

    // 定期更新指标
    useEffect(() => {
        updateMetrics();
        
        const interval = setInterval(() => {
            updateMetrics();
            if (showDetails) {
                getDetailedStats();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [updateMetrics, getDetailedStats, showDetails]);

    // 监听房间状态变化
    useEffect(() => {
        if (!room) return;

        const handleStateChanged = () => updateMetrics();
        
        room.on('connectionStateChanged', handleStateChanged);
        
        return () => {
            room.off('connectionStateChanged', handleStateChanged);
        };
    }, [room, updateMetrics]);

    // 格式化比特率
    const formatBitrate = (bitrate: number): string => {
        if (bitrate < 1000) return `${bitrate}bps`;
        if (bitrate < 1000000) return `${(bitrate / 1000).toFixed(1)}kbps`;
        return `${(bitrate / 1000000).toFixed(1)}Mbps`;
    };

    // 格式化延迟
    const formatLatency = (latency: number): string => {
        return `${latency}ms`;
    };

    // 格式化丢包率
    const formatPacketLoss = (loss: number): string => {
        return `${(loss * 100).toFixed(1)}%`;
    };

    // 获取连接质量配置
    const qualityConfig = QUALITY_CONFIGS[metrics.quality];
    const stateConfig = STATE_CONFIGS[metrics.state];

    // 紧凑模式渲染
    if (compact) {
        return (
            <div 
                className={`relative ${className}`}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <div className="flex items-center space-x-1">
                    <div className={`w-3 h-3 rounded-full ${qualityConfig.bgColor}`} />
                    {metrics.state === ConnectionState.Connecting && (
                        <LoadingSpinner size="sm" />
                    )}
                </div>

                {/* 工具提示 */}
                {showTooltip && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50">
                        <div className="text-center">
                            <div className={qualityConfig.color}>{qualityConfig.label}</div>
                            <div className={stateConfig.color}>{stateConfig.label}</div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                    </div>
                )}
            </div>
        );
    }

    // 标准模式渲染
    return (
        <div className={`bg-gray-800 rounded-lg ${className}`}>
            {/* 基本状态 */}
            <div 
                className="flex items-center space-x-3 p-3 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${qualityConfig.bgColor}`} />
                    <svg className={`w-4 h-4 ${qualityConfig.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={qualityConfig.icon} />
                    </svg>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${qualityConfig.color}`}>
                            {qualityConfig.label}
                        </span>
                        <span className={`text-xs ${stateConfig.color}`}>
                            {stateConfig.label}
                        </span>
                        {metrics.state === ConnectionState.Connecting && (
                            <LoadingSpinner size="sm" />
                        )}
                    </div>
                    <div className="text-xs text-gray-400">
                        更新于 {metrics.lastUpdated.toLocaleTimeString()}
                    </div>
                </div>

                {showDetails && (
                    <svg 
                        className={`w-4 h-4 text-gray-400 transform transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </div>

            {/* 详细信息 */}
            {showDetails && isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-700">
                    <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-400">延迟:</span>
                                <span className="text-white">{formatLatency(metrics.latency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">抖动:</span>
                                <span className="text-white">{formatLatency(metrics.jitter)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">丢包率:</span>
                                <span className="text-white">{formatPacketLoss(metrics.packetLoss)}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-400">音频:</span>
                                <span className="text-white">{formatBitrate(metrics.bitrate.audio)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">视频:</span>
                                <span className="text-white">{formatBitrate(metrics.bitrate.video)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">参与者:</span>
                                <span className="text-white">{room?.numParticipants || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* 连接质量指示器 */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="text-xs text-gray-400 mb-2">连接质量</div>
                        <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((level) => (
                                <div
                                    key={level}
                                    className={`h-2 flex-1 rounded ${
                                        level <= (Number(metrics.quality) + 1)
                                            ? qualityConfig.bgColor
                                            : 'bg-gray-600'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ConnectionStatus;