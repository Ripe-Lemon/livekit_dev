'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { Button } from '../ui/Button';
import { RoomInfo, RoomTag } from '../../types/room';

interface SidebarProps {
    currentRoomName: string;
    onRoomSwitch: (roomName: string) => void;
    className?: string;
    username?: string;
}

export function Sidebar({ currentRoomName, onRoomSwitch, className = '', username }: SidebarProps) {
    const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'participants' | 'rooms'>('participants');
    const [activeRooms, setActiveRooms] = useState<RoomInfo[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [roomsError, setRoomsError] = useState<string | null>(null);
    
    // 常驻房间配置（与主页保持一致）
    const PERMANENT_ROOMS = [
        { name: '大厅聊天室', description: '欢迎来到公共聊天大厅', icon: '💬', color: 'bg-blue-600' },
        { name: '游戏讨论区', description: '游戏爱好者的聚集地', icon: '🎮', color: 'bg-purple-600' },
        { name: '技术交流室', description: '程序员和技术爱好者的讨论空间', icon: '💻', color: 'bg-green-600' },
        { name: '音乐分享厅', description: '分享音乐、讨论音乐的地方', icon: '🎵', color: 'bg-pink-600' },
        { name: '学习讨论组', description: '一起学习、互相监督的学习空间', icon: '📚', color: 'bg-orange-600' },
        { name: '随机聊天室', description: '随便聊聊，放松心情的地方', icon: '🎲', color: 'bg-yellow-600' }
    ];

    // 安全地获取当前房间信息
    let room = null;
    let currentParticipants: any[] = [];
    
    try {
        room = useRoomContext();
        currentParticipants = useParticipants();
    } catch (error) {
        console.warn('无法获取房间上下文');
    }

    // 加载活跃房间列表
    const loadActiveRooms = useCallback(async () => {
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
                // 修复字段名匹配问题
                const filteredRooms = roomList
                    .filter((room: any) => {
                        // 尝试多个可能的字段名
                        const participantCount = room.numParticipants || room.participantCount || room.participants || 0;
                        return participantCount > 0;
                    })
                    .map((room: any) => ({
                        id: room.sid || room.id || room.name, // 使用 sid 作为 id
                        name: room.name,
                        description: room.metadata || room.description || '',
                        participantCount: room.numParticipants || room.participantCount || room.participants || 0,
                        createdAt: room.creationTime || room.createdAt || new Date().toISOString(),
                        lastActivity: room.creationTime || room.lastActivity || new Date().toISOString(),
                        isActive: true,
                        createdBy: room.createdBy || 'unknown'
                    }))
                    .sort((a: any, b: any) => b.participantCount - a.participantCount);
                
                setActiveRooms(filteredRooms);
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
        loadActiveRooms();
        
        // 每30秒刷新一次房间列表（增加间隔）
        const interval = setInterval(loadActiveRooms, 30000);
        return () => clearInterval(interval);
    }, [loadActiveRooms]);

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

    // 房间卡片组件
    const RoomCard = ({ room, type }: { room: any, type: 'permanent' | 'active' }) => {
        const isCurrentRoom = room.name === currentRoomName;
        
        // 获取参与者数量的逻辑
        let participantCount = 0;
        if (type === 'active') {
            participantCount = room.participantCount || 0;
        } else {
            // 对于常驻房间，查找是否在活跃房间列表中
            const activeRoom = activeRooms.find(active => active.name === room.name);
            participantCount = activeRoom?.participantCount || 0;
        }
        
        const isActive = participantCount > 0;

        return (
            <div 
                className={`
                    p-3 rounded-lg border transition-all duration-200 cursor-pointer group
                    ${isCurrentRoom 
                        ? 'bg-blue-900/30 border-blue-500' 
                        : 'bg-gray-800/50 border-gray-600 hover:bg-gray-700/50 hover:border-gray-500'
                    }
                `}
                onClick={() => handleJoinRoom(room.name)}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                        {type === 'permanent' && (
                            <span className="text-lg">{room.icon}</span>
                        )}
                        {isActive && (
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        )}
                        <h4 className={`font-medium text-sm ${isCurrentRoom ? 'text-blue-300' : 'text-white'} truncate`}>
                            {room.name}
                        </h4>
                        {isCurrentRoom && (
                            <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
                                当前
                            </span>
                        )}
                    </div>
                    
                    <span className={`text-xs px-2 py-1 rounded-full ${
                        participantCount > 0 
                            ? 'bg-green-900 text-green-300' 
                            : 'bg-gray-700 text-gray-400'
                    }`}>
                        {participantCount}人
                    </span>
                </div>
                
                {room.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                        {room.description}
                    </p>
                )}
                
                <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded ${
                        type === 'permanent' 
                            ? 'bg-blue-800 text-blue-300' 
                            : 'bg-gray-700 text-gray-300'
                    }`}>
                        {type === 'permanent' ? '常驻' : '活跃'}
                    </span>
                    
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400">
                        点击加入 →
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
                            {PERMANENT_ROOMS.length + activeRooms.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'participants' && (
                    <div className="h-full overflow-y-auto p-3">
                        {/* 参与者列表 */}
                        <div className="space-y-2">
                            {currentParticipants.length > 0 ? (
                                currentParticipants.map((participant, index) => {
                                    // 正确获取参与者状态
                                    const isMicEnabled = participant.isMicrophoneEnabled || false;
                                    const isCameraEnabled = participant.isCameraEnabled || false;
                                    const isScreenSharing = participant.isScreenShareEnabled || false;
                                    const connectionQuality = participant.connectionQuality || 'unknown';
                                    
                                    return (
                                        <div key={participant.identity || index} className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    participant.isLocal ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-200'
                                                }`}>
                                                    {participant.identity?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className={`text-sm font-medium ${participant.isLocal ? 'text-blue-400' : 'text-white'}`}>
                                                        {participant.identity || '未知用户'}
                                                        {participant.isLocal && <span className="text-xs ml-1">(你)</span>}
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        {/* 麦克风状态 */}
                                                        <div className={`w-4 h-4 ${isMicEnabled ? 'text-green-400' : 'text-gray-500'}`} title={isMicEnabled ? '麦克风已开启' : '麦克风已关闭'}>
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                {isMicEnabled ? (
                                                                    <>
                                                                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M12 1a3 3 0 0 0-3 3v3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M19 10v2a7 7 0 0 1-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M5 10v2a7 7 0 0 0 7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                    </>
                                                                )}
                                                            </svg>
                                                        </div>

                                                        {/* 摄像头状态 */}
                                                        <div className={`w-4 h-4 ${isCameraEnabled ? 'text-green-400' : 'text-gray-500'}`} title={isCameraEnabled ? '摄像头已开启' : '摄像头已关闭'}>
                                                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                {isCameraEnabled ? (
                                                                    <>
                                                                        <path d="M23 7l-7 5 7 5V7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                        <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
                                                                    </>
                                                                )}
                                                            </svg>
                                                        </div>

                                                        {/* 屏幕共享状态 */}
                                                        {isScreenSharing && (
                                                            <div className="w-4 h-4 text-blue-400" title="正在共享屏幕">
                                                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                                </svg>
                                                            </div>
                                                        )}

                                                        {/* 连接质量 */}
                                                        <div className={`w-4 h-4 ${
                                                            connectionQuality === 'excellent' ? 'text-green-400' :
                                                            connectionQuality === 'good' ? 'text-yellow-400' :
                                                            connectionQuality === 'poor' ? 'text-red-400' : 'text-gray-500'
                                                        }`} title={`连接质量: ${connectionQuality}`}>
                                                            <svg fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 参与者操作按钮（可选） */}
                                            {!participant.isLocal && (
                                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {/* 这里可以添加一些操作按钮，比如静音等 */}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
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
                            <h3 className="text-sm font-medium text-white">可用房间</h3>
                            <button
                                onClick={loadActiveRooms}
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
                                            onClick={loadActiveRooms}
                                            className="mt-2 text-red-400 text-xs underline hover:no-underline"
                                        >
                                            重试
                                        </button>
                                    </div>
                                </div>
                            ) : isLoadingRooms && activeRooms.length === 0 ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span className="text-sm">加载中...</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* 常驻房间 */}
                                    <div>
                                        <h4 className="text-xs font-medium text-gray-400 mb-2">常驻房间</h4>
                                        <div className="space-y-2">
                                            {PERMANENT_ROOMS.map((room, index) => (
                                                <RoomCard key={index} room={room} type="permanent" />
                                            ))}
                                        </div>
                                    </div>

                                    {/* 活跃房间 */}
                                    {activeRooms.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-medium text-gray-400 mb-2">其他活跃房间</h4>
                                            <div className="space-y-2">
                                                {activeRooms
                                                    .filter(room => !PERMANENT_ROOMS.some(pr => pr.name === room.name))
                                                    .map((room) => (
                                                        <RoomCard key={room.id} room={room} type="active" />
                                                    ))
                                                }
                                            </div>
                                        </div>
                                    )}

                                    {activeRooms.filter(room => !PERMANENT_ROOMS.some(pr => pr.name === room.name)).length === 0 && !isLoadingRooms && (
                                        <div className="text-center py-4 text-gray-400">
                                            <svg className="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                            <p className="text-sm">暂无其他活跃房间</p>
                                            <p className="text-xs mt-1">试试常驻房间或创建新房间</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 房间统计 */}
                        <div className="p-3 border-t border-gray-700 bg-gray-800/50">
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>共 {PERMANENT_ROOMS.length + activeRooms.length} 个房间</span>
                                <span>
                                    {PERMANENT_ROOMS.reduce((sum, room) => {
                                        const activeRoom = activeRooms.find(ar => ar.name === room.name);
                                        return sum + (activeRoom?.participantCount || 0);
                                    }, 0) + activeRooms.filter(room => !PERMANENT_ROOMS.some(pr => pr.name === room.name)).reduce((sum, room) => sum + room.participantCount, 0)} 人在线
                                </span>
                            </div>
                        </div>
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