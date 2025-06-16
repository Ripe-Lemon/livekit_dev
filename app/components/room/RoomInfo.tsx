// filepath: /Users/hotxiang/livekit_dev/app/components/room/RoomInfo.tsx
'use client';

import React from 'react';
import { useRoomContext, useParticipants } from '@livekit/components-react';

interface RoomInfoProps {
    className?: string;
}

export default function RoomInfo({ className = '' }: RoomInfoProps) {
    // 安全地获取 room context
    let room = null;
    let participants = [];
    
    try {
        room = useRoomContext();
        participants = useParticipants();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    if (!room) {
        return (
            <div className={`p-4 ${className}`}>
                <div className="text-center text-gray-400">
                    <p>房间信息不可用</p>
                </div>
            </div>
        );
    }

    const formatUptime = (startTime: Date) => {
        const now = new Date();
        const diff = now.getTime() - startTime.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        }
        return `${minutes}分钟`;
    };

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="grid grid-cols-2 gap-4">
                {/* 房间名称 */}
                <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">房间名称</div>
                    <div className="text-white font-medium">{room.name || '未知房间'}</div>
                </div>

                {/* 参与者数量 */}
                <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">参与者</div>
                    <div className="text-white font-medium">{participants.length} 人</div>
                </div>

                {/* 本地参与者 */}
                <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">你的身份</div>
                    <div className="text-white font-medium">
                        {room.localParticipant?.identity || '未知用户'}
                    </div>
                </div>

                {/* 连接状态 */}
                <div className="bg-gray-700 p-3 rounded-lg">
                    <div className="text-sm text-gray-400 mb-1">连接状态</div>
                    <div className="flex items-center">
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                            room.state === 'connected' ? 'bg-green-400' : 'bg-red-400'
                        }`}></div>
                        <span className="text-white font-medium">
                            {room.state === 'connected' ? '已连接' : '未连接'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 设备状态 */}
            <div className="bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-3">设备状态</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                            room.localParticipant?.isMicrophoneEnabled ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {room.localParticipant?.isMicrophoneEnabled ? (
                                    <>
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                                        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                                    </>
                                ) : (
                                    <>
                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                                        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                                    </>
                                )}
                            </svg>
                        </div>
                        <div className="text-white">麦克风</div>
                        <div className="text-gray-400">
                            {room.localParticipant?.isMicrophoneEnabled ? '开启' : '关闭'}
                        </div>
                    </div>

                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                            room.localParticipant?.isCameraEnabled ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {room.localParticipant?.isCameraEnabled ? (
                                <g>
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                    <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                                </g>
                            ) : (
                                <g>
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                    <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                                    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                                </g>
                            )}
                            </svg>
                        </div>
                        <div className="text-white">摄像头</div>
                        <div className="text-gray-400">
                            {room.localParticipant?.isCameraEnabled ? '开启' : '关闭'}
                        </div>
                    </div>

                    <div className="text-center">
                        <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${
                            room.localParticipant?.isScreenShareEnabled ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="text-white">屏幕共享</div>
                        <div className="text-gray-400">
                            {room.localParticipant?.isScreenShareEnabled ? '开启' : '关闭'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 统计信息 */}
            <div className="bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-3">统计信息</div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">房间ID:</span>
                        <span className="text-white font-mono text-xs">
                            {room.name || '未知'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-gray-400">连接质量:</span>
                        <span className="text-white">
                            {room.localParticipant?.connectionQuality || '未知'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}