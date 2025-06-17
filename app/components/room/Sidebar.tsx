'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Button } from '../ui/Button';
import { RoomInfo, RoomTag } from '../../types/room';

interface SidebarProps {
    currentRoomName: string;
    onRoomSwitch: (roomName: string) => void;
    className?: string;
    username?: string; // 添加用户名属性
}

export function Sidebar({ currentRoomName, onRoomSwitch, className = '', username }: SidebarProps) {
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'participants' | 'rooms'>('participants');
    const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [roomsError, setRoomsError] = useState<string | null>(null);
    
    // 安全地获取当前房间信息
    let room = null;
    let currentParticipants: any[] = [];
    
    try {
        room = useRoomContext();
        currentParticipants = useParticipants();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    // 加载公开房间列表
    const loadPublicRooms = useCallback(async () => {
        setIsLoadingRooms(true);
        setRoomsError(null);
        
        try {
            const response = await fetch('https://livekit-api.2k2.cc/api/rooms');
            if (!response.ok) {
                throw new Error(`获取房间列表失败: ${response.statusText}`);
            }
            
            const responseData = await response.json();
            const roomList = responseData.rooms;

            if (Array.isArray(roomList)) {
                // 过滤出公开或持久的房间
                const filteredRooms = roomList
                    .filter((room: any) => 
                        room.tags?.includes(RoomTag.PUBLIC) || 
                        room.tags?.includes(RoomTag.PERSISTENT) ||
                        room.participantCount > 0
                    )
                    .map((room: any) => ({
                        ...room,
                        createdAt: room.createdAt || new Date().toISOString(),
                        tags: room.tags || [RoomTag.PUBLIC]
                    }));
                
                setPublicRooms(filteredRooms);
                console.log('✅ 公开房间列表加载成功:', filteredRooms.length, '个房间');
            } else {
                throw new Error('API响应格式错误');
            }
        } catch (error) {
            console.error('❌ 加载房间列表失败:', error);
            setRoomsError(error instanceof Error ? error.message : '加载失败');
        } finally {
            setIsLoadingRooms(false);
        }
    }, []);

    // 初始加载和定时刷新
    useEffect(() => {
        loadPublicRooms();
        
        // 每30秒刷新一次房间列表
        const interval = setInterval(loadPublicRooms, 30000);
        return () => clearInterval(interval);
    }, [loadPublicRooms]);

    // 跳转到房间
    const handleJoinRoom = useCallback((roomName: string) => {
        if (!username) {
            alert('请先在主页面输入用户名');
            return;
        }
        
        if (roomName === currentRoomName) {
            console.log('已在当前房间');
            return;
        }
        
        const roomUrl = `/room?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`;
        console.log('🚀 跳转到房间:', roomName);
        window.location.href = roomUrl;
    }, [username, currentRoomName]);

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

    // 房间卡片组件
    const RoomCard = ({ room }: { room: RoomInfo }) => {
        const isCurrentRoom = room.name === currentRoomName;
        const isPersistent = room.tags?.includes(RoomTag.PERSISTENT);
        const isPublic = room.tags?.includes(RoomTag.PUBLIC);

        return (
            <div 
                className={`
                    p-3 rounded-lg border transition-all duration-200 cursor-pointer
                    ${isCurrentRoom 
                        ? 'bg-blue-900/30 border-blue-500' 
                        : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 hover:border-gray-500'
                    }
                `}
                onClick={() => handleJoinRoom(room.name)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <h4 className={`font-medium text-sm ${isCurrentRoom ? 'text-blue-300' : 'text-white'}`}>
                            {room.name}
                        </h4>
                        {isCurrentRoom && (
                            <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
                                当前
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* 参与者数量 */}
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            room.participantCount > 0 
                                ? 'bg-green-900 text-green-300' 
                                : 'bg-gray-700 text-gray-400'
                        }`}>
                            {room.participantCount}人
                        </span>
                        
                        {/* 密码保护图标 */}
                        {room.isPasswordProtected && (
                            <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                </div>
                
                {/* 房间描述 */}
                {room.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                        {room.description}
                    </p>
                )}
                
                {/* 房间标签 */}
                <div className="flex items-center justify-between text-xs">
                    <div className="flex gap-1">
                        {isPersistent && (
                            <span className="px-2 py-0.5 bg-blue-800 text-blue-300 rounded">
                                持久
                            </span>
                        )}
                        {isPublic && (
                            <span className="px-2 py-0.5 bg-green-800 text-green-300 rounded">
                                公开
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`bg-gray-900 border-r border-gray-700 flex flex-col h-full ${className}`}>
            {/* 房间信息头部 */}
            <div className="p-4 border-b border-gray-700">
                <div className="text-xs text-gray-400 mb-1">
                    当前房间: <span className="text-blue-400 font-medium">{currentRoomName}</span>
                </div>
                {username && (
                    <div className="text-xs text-gray-400">
                        用户: <span className="text-green-400 font-medium">{username}</span>
                    </div>
                )}
            </div>

            {/* 标签页导航 */}
            <div className="border-b border-gray-700">
                <nav className="flex">
                    <button
                        onClick={() => setActiveTab('participants')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium
                            border-b-2 transition-colors duration-200
                            ${activeTab === 'participants'
                                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                            }
                        `}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <span>参与者</span>
                        <span className={`
                            text-xs px-2 py-0.5 rounded-full
                            ${activeTab === 'participants' 
                                ? 'bg-blue-800 text-blue-300' 
                                : 'bg-gray-700 text-gray-400'
                            }
                        `}>
                            {currentParticipants.length}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('rooms')}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium
                            border-b-2 transition-colors duration-200
                            ${activeTab === 'rooms'
                                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                                : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                            }
                        `}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>房间</span>
                        <span className={`
                            text-xs px-2 py-0.5 rounded-full
                            ${activeTab === 'rooms' 
                                ? 'bg-blue-800 text-blue-300' 
                                : 'bg-gray-700 text-gray-400'
                            }
                        `}>
                            {publicRooms.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* 标签页内容 */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'participants' && (
                    <div className="h-full overflow-y-auto p-4">
                        <h3 className="text-sm font-medium text-white mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            当前参与者 ({currentParticipants.length})
                        </h3>
                        <div className="space-y-2">
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
                            
                            {currentParticipants.length === 0 && (
                                <div className="text-center py-8 text-gray-400">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                    </svg>
                                    <p className="text-sm">暂无参与者</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div className="h-full flex flex-col">
                        {/* 房间列表头部 */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                            <h3 className="text-sm font-medium text-white">公开房间</h3>
                            <button
                                onClick={loadPublicRooms}
                                disabled={isLoadingRooms}
                                className="p-1.5 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
                                title="刷新房间列表"
                            >
                                <svg 
                                    className={`w-4 h-4 text-gray-400 ${isLoadingRooms ? 'animate-spin' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>

                        {/* 房间列表内容 */}
                        <div className="flex-1 overflow-y-auto p-3">
                            {roomsError ? (
                                <div className="text-center py-8">
                                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                                        <p className="text-red-400 text-sm">加载房间列表失败</p>
                                        <p className="text-red-300 text-xs mt-1">{roomsError}</p>
                                        <button 
                                            onClick={loadPublicRooms}
                                            className="mt-2 text-red-400 text-xs underline hover:no-underline"
                                        >
                                            重试
                                        </button>
                                    </div>
                                </div>
                            ) : isLoadingRooms && publicRooms.length === 0 ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span className="text-sm">加载中...</span>
                                    </div>
                                </div>
                            ) : publicRooms.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p className="text-sm">暂无公开房间</p>
                                    <p className="text-xs mt-1">创建一个新房间开始聊天吧！</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {publicRooms.map((room) => (
                                        <RoomCard key={room.id} room={room} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 房间统计 */}
                        {publicRooms.length > 0 && (
                            <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                                <div className="flex items-center justify-between text-xs text-gray-400">
                                    <span>共 {publicRooms.length} 个房间</span>
                                    <span>
                                        {publicRooms.reduce((sum, room) => sum + room.participantCount, 0)} 人在线
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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