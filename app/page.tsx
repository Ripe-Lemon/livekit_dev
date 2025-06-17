'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { InlineError } from './components/ui/ErrorDisplay';
import { RoomInfo, RoomTag } from './types/room';

interface RoomFormData {
    roomName: string;
    participantName: string;
    isTemporary: boolean;
    isPrivate: boolean;
    description?: string;
}

interface RecentRoom {
    name: string;
    lastJoined: Date;
    participants: number;
    isPrivate: boolean;
}

export default function HomePage() {
    // 状态管理
    const [formData, setFormData] = useState<RoomFormData>({
        roomName: '',
        participantName: '',
        isTemporary: true, // 默认创建临时房间
        isPrivate: false,
        description: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
    const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
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

    // 加载公开房间列表
    const loadPublicRooms = useCallback(async () => {
        setIsLoadingRooms(true);
        try {
            const response = await fetch('https://livekit-api.2k2.cc/api/rooms');
            if (response.ok) {
                const responseData = await response.json();
                const roomList = responseData.rooms;

                if (Array.isArray(roomList)) {
                    // 过滤出公开房间，包括持久房间和有人的临时房间
                    const filteredRooms = roomList
                        .filter((room: any) => 
                            room.tags?.includes(RoomTag.PUBLIC) || 
                            room.tags?.includes(RoomTag.PERSISTENT) ||
                            (room.numParticipants || room.participantCount || 0) > 0
                        )
                        .map((room: any) => ({
                            ...room,
                            createdAt: new Date(room.createdAt || Date.now()),
                            tags: room.tags || [RoomTag.PUBLIC],
                            // 确保两个字段都存在，优先使用 numParticipants
                            participantCount: room.numParticipants || room.participantCount || 0,
                            numParticipants: room.numParticipants || room.participantCount || 0
                        }));
                    
                    setPublicRooms(filteredRooms);
                } else {
                    console.error('API响应中 "rooms" 属性不是一个数组:', responseData);
                    setPublicRooms([]);
                }
            }
        } catch (error) {
            console.error('加载房间列表失败:', error);
        } finally {
            setIsLoadingRooms(false);
        }
    }, []);

    // 初始加载公开房间
    useEffect(() => {
        loadPublicRooms();
        // 每30秒自动刷新
        const interval = setInterval(loadPublicRooms, 30000);
        return () => clearInterval(interval);
    }, [loadPublicRooms]);

    // 保存最近房间到本地存储
    const saveRecentRoom = useCallback((roomName: string, isPrivate: boolean) => {
        try {
            const newRoom: RecentRoom = {
                name: roomName,
                lastJoined: new Date(),
                participants: 1,
                isPrivate
            };

            const updatedRooms = [
                newRoom,
                ...recentRooms.filter(room => room.name !== roomName)
            ].slice(0, 5); // 只保留最近5个房间

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

            if (!/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/.test(formData.roomName)) {
                return '房间名称只能包含字母、数字、中文、下划线和连字符';
            }
        }

        return null;
    }, [formData, showCreateForm]);

    // 创建房间
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
            // 创建房间API调用
            const createResponse = await fetch('https://livekit-api.2k2.cc/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.roomName.trim(),
                    description: formData.description || '',
                    isTemporary: formData.isTemporary,
                    tags: formData.isTemporary ? [RoomTag.TEMPORARY] : [RoomTag.PUBLIC, RoomTag.PERSISTENT],
                    maxParticipants: 10
                }),
            });

            if (!createResponse.ok) {
                throw new Error('创建房间失败');
            }

            // 保存用户名到本地存储
            localStorage.setItem('participantName', formData.participantName);
            
            // 保存到最近房间
            saveRecentRoom(formData.roomName, formData.isPrivate);

            // 构建查询参数
            const params = new URLSearchParams({
                room: formData.roomName.trim(),
                username: formData.participantName.trim()
            });

            // 跳转到房间页面
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
        saveRecentRoom(roomName, false);

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

    // 房间卡片组件
    const RoomCard = ({ room }: { room: RoomInfo }) => {
        const isPersistent = room.tags?.includes(RoomTag.PERSISTENT);
        const isActive = (room.participantCount || room.participantCount || 0) > 0;

        return (
            <div 
                className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-4 transition-all duration-200 cursor-pointer border border-gray-600 hover:border-gray-500"
                onClick={() => handleQuickJoin(room.name)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                        <h3 className="text-white font-medium text-lg">{room.name}</h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <span className={`text-sm px-3 py-1 rounded-full ${
                            isActive 
                                ? 'bg-green-900 text-green-300' 
                                : 'bg-gray-700 text-gray-400'
                        }`}>
                            {room.participantCount || room.participantCount || 0} 人
                        </span>
                        
                        {isPersistent && (
                            <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded">
                                持久
                            </span>
                        )}
                    </div>
                </div>
                
                {room.description && (
                    <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                        {room.description}
                    </p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                        {new Date(room.createdAt).toLocaleDateString('zh-CN')}
                    </span>
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
                                <p className="text-gray-300 text-sm">加入公共房间或创建新的会议室</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* 主要内容 */}
            <main className="container mx-auto px-4 py-6">
                <div className="max-w-6xl mx-auto">
                    
                    {/* 用户名输入和操作栏 */}
                    <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={formData.participantName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, participantName: e.target.value }))}
                                    placeholder="输入您的用户名"
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                    disabled={isLoading}
                                />
                            </div>
                            
                            <button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                创建房间
                            </button>
                            
                            <button
                                onClick={loadPublicRooms}
                                disabled={isLoadingRooms}
                                className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                                title="刷新房间列表"
                            >
                                <svg className={`w-5 h-5 ${isLoadingRooms ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
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
                        <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6 mb-6">
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

                                <div className="flex items-center gap-6">
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            id="isTemporary"
                                            checked={formData.isTemporary}
                                            onChange={(e) => setFormData(prev => ({ ...prev, isTemporary: e.target.checked }))}
                                            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                            disabled={isLoading}
                                        />
                                        <label htmlFor="isTemporary" className="text-sm text-gray-300">
                                            临时房间（无人时自动删除）
                                        </label>
                                    </div>

                                    <div className="flex gap-2">
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
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        
                        {/* 主要区域：公共房间列表 */}
                        <div className="lg:col-span-3">
                            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-white">公共房间</h2>
                                    <div className="text-sm text-gray-400">
                                        {publicRooms.length} 个房间 • {publicRooms.reduce((sum, room) => sum + (room.participantCount || room.participantCount || 0), 0)} 人在线
                                    </div>
                                </div>

                                {isLoadingRooms && publicRooms.length === 0 ? (
                                    <div className="flex justify-center py-12">
                                        <LoadingSpinner size="lg" color="white" text="加载房间列表..." />
                                    </div>
                                ) : publicRooms.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {publicRooms.map((room, index) => (
                                            <RoomCard key={index} room={room} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        <p className="text-lg mb-2">暂无活跃的公共房间</p>
                                        <p className="text-sm">创建一个新房间开始聊天，或等待其他人创建房间</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 侧边栏：最近房间 */}
                        <div className="lg:col-span-1">
                            {recentRooms.length > 0 && (
                                <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">最近房间</h3>
                                    <div className="space-y-2">
                                        {recentRooms.slice(0, 8).map((room, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickJoin(room.name)}
                                                disabled={isLoading || !formData.participantName.trim()}
                                                className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-white font-medium text-sm">{room.name}</p>
                                                        <p className="text-xs text-gray-400">
                                                            {room.lastJoined.toLocaleDateString('zh-CN')}
                                                            {room.isPrivate && (
                                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-yellow-900 text-yellow-300">
                                                                    私有
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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