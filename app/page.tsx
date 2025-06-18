'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { InlineError } from './components/ui/ErrorDisplay';
import { RoomInfo, PermanentRoom } from './types/room';

interface RoomFormData {
    roomName: string;
    participantName: string;
    description?: string;
}

interface RecentRoom {
    name: string;
    lastJoined: Date;
    participants: number;
}

// 常驻房间配置
const PERMANENT_ROOMS: PermanentRoom[] = [
    {
        id: 'general',
        name: '大厅聊天室',
        description: '欢迎来到公共聊天大厅，认识新朋友',
        category: '社交',
        icon: '💬',
        color: 'bg-blue-600'
    },
    {
        id: 'gaming',
        name: '游戏讨论区',
        description: '游戏爱好者的聚集地，分享游戏心得',
        category: '游戏',
        icon: '🎮',
        color: 'bg-purple-600'
    },
    {
        id: 'tech',
        name: '技术交流室',
        description: '程序员和技术爱好者的讨论空间',
        category: '技术',
        icon: '💻',
        color: 'bg-green-600'
    },
    {
        id: 'music',
        name: '音乐分享厅',
        description: '分享音乐、讨论音乐的地方',
        category: '娱乐',
        icon: '🎵',
        color: 'bg-pink-600'
    },
    {
        id: 'study',
        name: '学习讨论组',
        description: '一起学习、互相监督的学习空间',
        category: '学习',
        icon: '📚',
        color: 'bg-orange-600'
    },
    {
        id: 'random',
        name: '随机聊天室',
        description: '随便聊聊，放松心情的地方',
        category: '休闲',
        icon: '🎲',
        color: 'bg-yellow-600'
    }
];

export default function HomePage() {
    // 状态管理
    const [formData, setFormData] = useState<RoomFormData>({
        roomName: '',
        participantName: '',
        description: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
    const [activeRooms, setActiveRooms] = useState<RoomInfo[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const router = useRouter();

    // 从本地存储恢复最近的房间和用户名
    useEffect(() => {
        try {
            const savedParticipantName = localStorage.getItem('participantName');
            if (savedParticipantName) {
                setFormData(prev => ({ 
                    ...prev,
                    participantName: savedParticipantName 
                }));
            }

            const savedRecentRooms = localStorage.getItem('recentRooms');
            if (savedRecentRooms) {
                const rooms = JSON.parse(savedRecentRooms).map((room: any) => ({
                    ...room,
                    lastJoined: new Date(room.lastJoined)
                }));
                setRecentRooms(rooms);
            }
        } catch (error) {
            console.warn('恢复本地数据失败:', error);
        }
    }, []);

    // 加载活跃房间列表
    const loadActiveRooms = useCallback(async () => {
        setIsLoadingRooms(true);
        try {
            const response = await fetch('https://livekit-api.2k2.cc/api/rooms');
            if (response.ok) {
                const responseData = await response.json();
                const roomList = responseData.rooms;

                if (Array.isArray(roomList)) {
                    // 只显示有人的房间
                    const filteredRooms = roomList
                        .filter((room: any) => (room.numParticipants || room.participantCount || 0) > 0)
                        .map((room: any) => ({
                            ...room,
                            createdAt: new Date(room.createdAt || Date.now()),
                            participantCount: room.numParticipants || room.participantCount || 0,
                        }))
                        .sort((a: any, b: any) => b.participantCount - a.participantCount); // 按人数排序
                    
                    setActiveRooms(filteredRooms);
                } else {
                    console.error('API响应格式错误:', responseData);
                    setActiveRooms([]);
                }
            }
        } catch (error) {
            console.error('加载房间列表失败:', error);
        } finally {
            setIsLoadingRooms(false);
        }
    }, []);

    // 初始加载活跃房间
    useEffect(() => {
        loadActiveRooms();
        // 每15秒自动刷新
        const interval = setInterval(loadActiveRooms, 15000);
        return () => clearInterval(interval);
    }, [loadActiveRooms]);

    // 保存最近房间到本地存储
    const saveRecentRoom = useCallback((roomName: string) => {
        try {
            const newRoom: RecentRoom = {
                name: roomName,
                lastJoined: new Date(),
                participants: 1
            };

            const updatedRooms = [
                newRoom,
                ...recentRooms.filter(room => room.name !== roomName)
            ].slice(0, 8); // 保留最近8个房间

            setRecentRooms(updatedRooms);
            localStorage.setItem('recentRooms', JSON.stringify(updatedRooms));
        } catch (error) {
            console.warn('保存最近房间失败:', error);
        }
    }, [recentRooms]);

    // 表单验证
    const validateForm = useCallback((): string | null => {
        if (!formData.participantName.trim()) {
            return '请输入用户名';
        }

        if (formData.participantName.length < 2) {
            return '用户名至少需要2个字符';
        }

        if (formData.participantName.length > 30) {
            return '用户名不能超过30个字符';
        }

        if (showCreateForm) {
            if (!formData.roomName.trim()) {
                return '请输入房间名称';
            }

            if (formData.roomName.length < 3) {
                return '房间名称至少需要3个字符';
            }

            if (formData.roomName.length > 50) {
                return '房间名称不能超过50个字符';
            }

            if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-\s]+$/.test(formData.roomName)) {
                return '房间名称只能包含字母、数字、中文、下划线、连字符和空格';
            }
        }

        return null;
    }, [formData, showCreateForm]);

    // 创建并加入房间
    const handleCreateRoom = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 保存用户名到本地存储
            localStorage.setItem('participantName', formData.participantName);
            
            // 保存到最近房间
            saveRecentRoom(formData.roomName);

            // 构建查询参数
            const params = new URLSearchParams({
                room: formData.roomName.trim(),
                username: formData.participantName.trim()
            });

            // 直接跳转到房间页面（房间会在有人加入时自动创建）
            router.push(`/room?${params.toString()}`);

        } catch (error) {
            console.error('创建房间失败:', error);
            setError(error instanceof Error ? error.message : '创建房间失败，请重试');
        } finally {
            setIsLoading(false);
        }
    }, [formData, validateForm, saveRecentRoom, router]);

    // 快速加入房间
    const handleQuickJoin = useCallback((roomName: string) => {
        if (!formData.participantName.trim()) {
            setError('请先输入用户名');
            return;
        }

        // 保存用户名
        localStorage.setItem('participantName', formData.participantName);
        
        // 保存到最近房间
        saveRecentRoom(roomName);

        // 构建查询参数并跳转
        const params = new URLSearchParams({
            room: roomName,
            username: formData.participantName.trim()
        });

        router.push(`/room?${params.toString()}`);
    }, [formData.participantName, saveRecentRoom, router]);

    // 生成随机房间名
    const generateRandomRoomName = useCallback(() => {
        const adjectives = ['快乐', '神秘', '超级', '魔法', '彩虹', '星空', '海洋', '山峰'];
        const nouns = ['会议室', '聚会厅', '讨论区', '工作室', '咖啡厅', '书房', '花园', '城堡'];
        
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 1000);
        
        return `${randomAdjective}${randomNoun}${randomNum}`;
    }, []);

    // 常驻房间卡片组件
    const PermanentRoomCard = ({ room }: { room: PermanentRoom }) => {
        // 检查这个常驻房间是否有活跃用户
        const activeRoom = activeRooms.find(active => active.name === room.name);
        const participantCount = activeRoom?.participantCount || 0;
        const isActive = participantCount > 0;

        return (
            <div 
                className="group relative overflow-hidden rounded-lg border border-gray-600 hover:border-gray-500 transition-all duration-200 cursor-pointer"
                onClick={() => handleQuickJoin(room.name)}
            >
                <div className={`${room.color} p-4 text-white`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                            <span className="text-2xl">{room.icon}</span>
                            <div>
                                <h3 className="font-medium text-lg">{room.name}</h3>
                                <span className="text-xs opacity-80">{room.category}</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            {isActive && (
                                <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
                            )}
                            <span className="text-sm font-medium">
                                {participantCount} 人
                            </span>
                        </div>
                    </div>
                    
                    <p className="text-sm opacity-90 mb-3">{room.description}</p>
                    
                    <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-green-500/20 text-green-100' : 'bg-white/20 text-white/80'}`}>
                            {isActive ? '活跃中' : '等待加入'}
                        </span>
                        
                        <div className="flex items-center text-xs opacity-80 group-hover:opacity-100 transition-opacity">
                            <span>点击加入</span>
                            <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // 活跃房间卡片组件
    const ActiveRoomCard = ({ room }: { room: RoomInfo }) => {
        return (
            <div 
                className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-4 transition-all duration-200 cursor-pointer border border-gray-600 hover:border-gray-500"
                onClick={() => handleQuickJoin(room.name)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                        <h3 className="text-white font-medium">{room.name}</h3>
                    </div>
                    
                    <span className="text-sm px-3 py-1 bg-green-900 text-green-300 rounded-full">
                        {room.participantCount} 人
                    </span>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>活跃房间</span>
                    <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>点击加入</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
            {/* 头部 */}
            <header className="bg-black/20 backdrop-blur-sm border-b border-gray-700">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">LiveKit 视频会议</h1>
                                <p className="text-gray-300 text-sm">选择房间开始聊天，或创建新的会议室</p>
                            </div>
                        </div>

                        <button
                            onClick={loadActiveRooms}
                            disabled={isLoadingRooms}
                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                            title="刷新房间列表"
                        >
                            <svg className={`w-5 h-5 ${isLoadingRooms ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* 主要内容 */}
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    
                    {/* 用户名输入栏 */}
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={formData.participantName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, participantName: e.target.value }))}
                                    placeholder="输入您的用户名"
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    disabled={isLoading}
                                />
                            </div>
                            
                            <button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                创建房间
                            </button>
                        </div>

                        {error && (
                            <InlineError 
                                message={error} 
                                onDismiss={() => setError(null)}
                            />
                        )}
                    </div>

                    {/* 创建房间表单 */}
                    {showCreateForm && (
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                            <h2 className="text-xl font-bold text-white mb-4">创建新房间</h2>
                            
                            <form onSubmit={handleCreateRoom} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            房间名称
                                        </label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={formData.roomName}
                                                onChange={(e) => setFormData(prev => ({ ...prev, roomName: e.target.value }))}
                                                placeholder="输入房间名称"
                                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, roomName: generateRandomRoomName() }))}
                                                className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                                title="生成随机房间名"
                                                disabled={isLoading}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            房间描述（可选）
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="简单描述房间用途"
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateForm(false)}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                                        disabled={isLoading}
                                    >
                                        取消
                                    </button>
                                    
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center">
                                                <LoadingSpinner size="sm" color="white" />
                                                <span className="ml-2">创建中...</span>
                                            </div>
                                        ) : (
                                            '创建并加入'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* 常驻房间栏 */}
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">常驻房间</h2>
                            <div className="text-sm text-gray-400">
                                {PERMANENT_ROOMS.length} 个房间 • 随时可加入
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {PERMANENT_ROOMS.map((room) => (
                                <PermanentRoomCard key={room.id} room={room} />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* 活跃房间栏 */}
                        <div className="lg:col-span-2">
                            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-white">活跃房间</h2>
                                    <div className="text-sm text-gray-400">
                                        {activeRooms.length} 个活跃 • {activeRooms.reduce((sum, room) => sum + room.participantCount, 0)} 人在线
                                    </div>
                                </div>

                                {isLoadingRooms && activeRooms.length === 0 ? (
                                    <div className="flex justify-center py-12">
                                        <LoadingSpinner size="lg" color="white" text="加载房间列表..." />
                                    </div>
                                ) : activeRooms.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {activeRooms.map((room) => (
                                            <ActiveRoomCard key={room.id} room={room} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="text-lg mb-2">暂无活跃房间</p>
                                        <p className="text-sm">创建一个新房间开始聊天，或加入常驻房间</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 最近加入的房间栏 */}
                        <div className="lg:col-span-1">
                            {recentRooms.length > 0 && (
                                <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">最近房间</h3>
                                    <div className="space-y-2">
                                        {recentRooms.map((room, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickJoin(room.name)}
                                                disabled={isLoading || !formData.participantName.trim()}
                                                className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-white font-medium text-sm truncate">{room.name}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {room.lastJoined.toLocaleDateString('zh-CN', {
                                                                month: 'short',
                                                                day: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </p>
                                                    </div>
                                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}