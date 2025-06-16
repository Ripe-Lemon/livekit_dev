'use client';

import React, { useState, useCallback } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Button } from '../ui/Button';

interface RoomInfo {
    id: string;
    name: string;
    participantCount: number;
    participants: string[];
    isActive: boolean;
}

interface SidebarProps {
    currentRoomName: string;
    onRoomSwitch: (roomName: string) => void;
    className?: string;
}

export function Sidebar({ currentRoomName, onRoomSwitch, className = '' }: SidebarProps) {
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
    
    // 安全地获取当前房间信息
    let room = null;
    let currentParticipants: any[] = [];
    
    try {
        room = useRoomContext();
        currentParticipants = useParticipants();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    // 模拟其他房间数据（实际项目中应该从API获取）
    const [availableRooms] = useState<RoomInfo[]>([
        {
            id: '1',
            name: 'room1',
            participantCount: 3,
            participants: ['Alice', 'Bob', 'Charlie'],
            isActive: currentRoomName === 'room1'
        },
        {
            id: '2',
            name: 'room2',
            participantCount: 2,
            participants: ['David', 'Eve'],
            isActive: currentRoomName === 'room2'
        },
        {
            id: '3',
            name: 'meeting-room',
            participantCount: 5,
            participants: ['Frank', 'Grace', 'Henry', 'Ivy', 'Jack'],
            isActive: currentRoomName === 'meeting-room'
        }
    ]);

    const toggleRoomExpanded = useCallback((roomId: string) => {
        setExpandedRoom(prev => prev === roomId ? null : roomId);
    }, []);

    const handleRoomSwitch = useCallback((roomName: string) => {
        if (roomName !== currentRoomName) {
            onRoomSwitch(roomName);
        }
    }, [currentRoomName, onRoomSwitch]);

    // 获取当前房间的参与者信息
    const getCurrentRoomParticipants = () => {
        return currentParticipants.map(p => ({
            identity: p.identity,
            isMicEnabled: p.isMicrophoneEnabled,
            isCameraEnabled: p.isCameraEnabled,
            isScreenSharing: p.isScreenShareEnabled,
            isLocal: p.isLocal,
            connectionQuality: p.connectionQuality as 'excellent' | 'good' | 'poor' | 'unknown'
        }));
    };

    return (
        <div className={`bg-gray-900 border-r border-gray-700 flex flex-col h-full ${className}`}>
            {/* 房间信息头部 */}
            <div className="p-4 border-b border-gray-700">
                <div className="text-xs text-gray-400 mb-1">
                    当前房间: <span className="text-blue-400 font-medium">{currentRoomName}</span>
                </div>
            </div>

            {/* 当前房间参与者 */}
            <div className="p-4 border-b border-gray-700">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    当前参与者 ({currentParticipants.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    {getCurrentRoomParticipants().map((participant, index) => (
                        <div
                            key={index}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                                participant.isLocal ? 'bg-blue-900/30' : 'bg-gray-800'
                            }`}
                        >
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                    {participant.identity.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-white">
                                        {participant.identity}
                                        {participant.isLocal && <span className="text-blue-400 ml-1">(你)</span>}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        {/* 连接质量 */}
                                        <div className={`w-2 h-2 rounded-full ${
                                            participant.connectionQuality === 'excellent' ? 'bg-green-400' :
                                            participant.connectionQuality === 'good' ? 'bg-yellow-400' :
                                            participant.connectionQuality === 'poor' ? 'bg-orange-400' : 'bg-red-400'
                                        }`} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1">
                                {/* 麦克风状态 */}
                                <div className={`w-4 h-4 ${participant.isMicEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {participant.isMicEnabled ? (
                                            <>
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                            </>
                                        ) : (
                                            <>
                                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                            </>
                                        )}
                                    </svg>
                                </div>
                                {/* 摄像头状态 */}
                                <div className={`w-4 h-4 ${participant.isCameraEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {participant.isCameraEnabled ? (
                                            <>
                                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                            </>
                                        ) : (
                                            <>
                                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeWidth={2}/>
                                            </>
                                        )}
                                    </svg>
                                </div>
                                {/* 屏幕共享状态 */}
                                {participant.isScreenSharing && (
                                    <div className="w-4 h-4 text-blue-400">
                                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 其他房间列表 */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                    <h3 className="text-sm font-medium text-white mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        可用房间
                    </h3>
                    <div className="space-y-2">
                        {availableRooms.map((roomInfo) => (
                            <div key={roomInfo.id} className="bg-gray-800 rounded-lg overflow-hidden">
                                <div 
                                    className={`p-3 cursor-pointer hover:bg-gray-700 transition-colors ${
                                        roomInfo.isActive ? 'bg-blue-900/30 border-l-4 border-blue-500' : ''
                                    }`}
                                    onClick={() => toggleRoomExpanded(roomInfo.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                            <span className="text-sm font-medium text-white">{roomInfo.name}</span>
                                            {roomInfo.isActive && (
                                                <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded-full">
                                                    当前
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-400">
                                                {roomInfo.participantCount} 人
                                            </span>
                                            <svg 
                                                className={`w-4 h-4 text-gray-400 transition-transform ${
                                                    expandedRoom === roomInfo.id ? 'rotate-180' : ''
                                                }`} 
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {/* 展开的参与者列表 */}
                                {expandedRoom === roomInfo.id && (
                                    <div className="px-3 pb-3 border-t border-gray-700">
                                        <div className="space-y-2 mt-2">
                                            {roomInfo.participants.map((participant, index) => (
                                                <div key={index} className="flex items-center space-x-2 text-sm">
                                                    <div className="w-4 h-4 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs">
                                                        {participant.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-gray-300">{participant}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {!roomInfo.isActive && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRoomSwitch(roomInfo.name)}
                                                className="w-full mt-3 text-xs"
                                            >
                                                加入房间
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 底部状态信息 */}
            <div className="p-4 border-t border-gray-700">
                <div className="text-xs text-gray-400 space-y-1">
                    <div className="flex justify-between">
                        <span>连接状态:</span>
                        <span className={room?.state === 'connected' ? 'text-green-400' : 'text-red-400'}>
                            {room?.state === 'connected' ? '已连接' : '未连接'}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span>房间ID:</span>
                        <span className="font-mono truncate ml-2">{room?.name || '未知'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}