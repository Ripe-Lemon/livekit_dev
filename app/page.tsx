'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoadingSpinner, PageLoadingSpinner } from './components/ui/LoadingSpinner';
import { ErrorDisplay, InlineError } from './components/ui/ErrorDisplay';

interface RoomFormData {
    roomName: string;
    participantName: string;
    isPrivate: boolean;
    password?: string;
}

interface RecentRoom {
    name: string;
    lastJoined: Date;
    participants: number;
    isPrivate: boolean;
}

interface RoomInfo {
    name: string;
    numParticipants: number;
    isActive: boolean;
    createdAt: Date;
    maxParticipants: number;
}

export default function HomePage() {
    // 状态管理
    const [formData, setFormData] = useState<RoomFormData>({
        roomName: '',
        participantName: '',
        isPrivate: false,
        password: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
    const [publicRooms, setPublicRooms] = useState<RoomInfo[]>([]);
    const [isLoadingRooms, setIsLoadingRooms] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

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
                // 1. 将API返回的JSON解析成一个对象
                const responseData = await response.json();

                // responseData 的值是: {"rooms": [...]}

                // 2. 从对象中获取 "rooms" 属性，它才是一个数组
                const roomList = responseData.rooms;

                // 3. (推荐) 检查 roomList 是不是一个真正的数组，保证代码健壮性
                if (Array.isArray(roomList)) {
                    setPublicRooms(roomList.map((room: any) => ({
                        ...room,
                        createdAt: new Date(room.createdAt) // 假设 room 对象里有 createdAt
                    })));
                } else {
                    console.error('API响应中 "rooms" 属性不是一个数组:', responseData);
                    setPublicRooms([]); // 设置为空数组防止UI错误
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
            ].slice(0, 10); // 只保留最近10个房间

            setRecentRooms(updatedRooms);
            localStorage.setItem('recentRooms', JSON.stringify(updatedRooms));
        } catch (error) {
            console.warn('保存最近房间失败:', error);
        }
    }, [recentRooms]);

    // 表单验证
    const validateForm = useCallback((): string | null => {
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

        if (!formData.participantName.trim()) {
            return '请输入用户名';
        }

        if (formData.participantName.length < 2) {
            return '用户名至少需要2个字符';
        }

        if (formData.participantName.length > 30) {
            return '用户名不能超过30个字符';
        }

        if (formData.isPrivate && !formData.password) {
            return '私有房间需要设置密码';
        }

        if (formData.password && formData.password.length < 4) {
            return '密码至少需要4个字符';
        }

        return null;
    }, [formData]);

    // 处理表单提交
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
            saveRecentRoom(formData.roomName, formData.isPrivate);

            // 构建查询参数
            const params = new URLSearchParams({
                room: formData.roomName.trim(),
                username: formData.participantName.trim()
            });

            if (formData.isPrivate && formData.password) {
                params.append('password', formData.password);
            }

            // 跳转到房间页面
            router.push(`/room?${params.toString()}`);

        } catch (error) {
            console.error('加入房间失败:', error);
            setError(error instanceof Error ? error.message : '加入房间失败，请重试');
        } finally {
            setIsLoading(false);
        }
    }, [formData, validateForm, saveRecentRoom, router]);

    // 快速加入最近房间
    const handleQuickJoin = useCallback((roomName: string) => {
        if (!formData.participantName.trim()) {
            setError('请先输入用户名');
            return;
        }

        setFormData(prev => ({ ...prev, roomName }));
        
        // 自动提交表单
        setTimeout(() => {
            const form = document.getElementById('roomForm') as HTMLFormElement;
            if (form) {
                form.requestSubmit();
            }
        }, 100);
    }, [formData.participantName]);

    // 生成随机房间名
    const generateRandomRoomName = useCallback(() => {
        const adjectives = ['快乐', '神秘', '超级', '魔法', '彩虹', '星空', '海洋', '山峰'];
        const nouns = ['会议室', '聚会厅', '讨论区', '工作室', '咖啡厅', '书房', '花园', '城堡'];
        
        const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 1000);
        
        return `${randomAdjective}${randomNoun}${randomNum}`;
    }, []);

    // 处理表单输入变化
    const handleInputChange = useCallback((
        field: keyof RoomFormData,
        value: string | boolean
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (error) setError(null); // 清除错误信息
    }, [error]);

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
                                <p className="text-gray-300 text-sm">高质量的实时音视频通信</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <Link 
                                href="/about" 
                                className="text-gray-300 hover:text-white transition-colors"
                            >
                                关于
                            </Link>
                            <Link 
                                href="/help" 
                                className="text-gray-300 hover:text-white transition-colors"
                            >
                                帮助
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* 主要内容 */}
            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* 左侧：加入房间表单 */}
                        <div className="lg:col-span-2">
                            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <h2 className="text-2xl font-bold text-white mb-6">加入或创建房间</h2>
                                
                                {error && (
                                    <InlineError 
                                        message={error} 
                                        onDismiss={() => setError(null)} 
                                    />
                                )}

                                <form id="roomForm" onSubmit={handleSubmit} className="space-y-6">
                                    {/* 房间名称 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            房间名称
                                        </label>
                                        <div className="flex space-x-2">
                                            <input
                                                type="text"
                                                value={formData.roomName}
                                                onChange={(e) => handleInputChange('roomName', e.target.value)}
                                                placeholder="输入房间名称或创建新房间"
                                                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                disabled={isLoading}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange('roomName', generateRandomRoomName())}
                                                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
                                                title="生成随机房间名"
                                                disabled={isLoading}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            房间名称只能包含字母、数字、中文、下划线和连字符，3-50个字符
                                        </p>
                                    </div>

                                    {/* 用户名 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            用户名
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.participantName}
                                            onChange={(e) => handleInputChange('participantName', e.target.value)}
                                            placeholder="输入您的用户名"
                                            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                            disabled={isLoading}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            用户名将在房间中显示，2-30个字符
                                        </p>
                                    </div>

                                    {/* 高级选项切换 */}
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            <svg 
                                                className={`w-4 h-4 mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} 
                                                fill="none" 
                                                stroke="currentColor" 
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            高级选项
                                        </button>
                                    </div>

                                    {/* 高级选项 */}
                                    {showAdvanced && (
                                        <div className="space-y-4 bg-gray-800/50 rounded-lg p-4">
                                            {/* 私有房间 */}
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    id="isPrivate"
                                                    checked={formData.isPrivate}
                                                    onChange={(e) => handleInputChange('isPrivate', e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                                    disabled={isLoading}
                                                />
                                                <label htmlFor="isPrivate" className="text-sm text-gray-300">
                                                    创建私有房间（需要密码）
                                                </label>
                                            </div>

                                            {/* 密码输入 */}
                                            {formData.isPrivate && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        房间密码
                                                    </label>
                                                    <input
                                                        type="password"
                                                        value={formData.password || ''}
                                                        onChange={(e) => handleInputChange('password', e.target.value)}
                                                        placeholder="设置房间密码"
                                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                        disabled={isLoading}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* 提交按钮 */}
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                                    >
                                        {isLoading ? (
                                            <div className="flex items-center justify-center">
                                                <LoadingSpinner size="sm" color="white" />
                                                <span className="ml-2">正在加入...</span>
                                            </div>
                                        ) : (
                                            '加入房间'
                                        )}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* 右侧：房间列表 */}
                        <div className="space-y-6">
                            {/* 最近房间 */}
                            {recentRooms.length > 0 && (
                                <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">最近房间</h3>
                                    <div className="space-y-2">
                                        {recentRooms.slice(0, 5).map((room, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickJoin(room.name)}
                                                disabled={isLoading || !formData.participantName.trim()}
                                                className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-white font-medium">{room.name}</p>
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

                            {/* 公开房间 */}
                            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">公开房间</h3>
                                    <button
                                        onClick={loadPublicRooms}
                                        disabled={isLoadingRooms}
                                        className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                        title="刷新"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>

                                {isLoadingRooms ? (
                                    <div className="flex justify-center py-8">
                                        <LoadingSpinner size="md" color="white" text="加载中..." />
                                    </div>
                                ) : publicRooms.length > 0 ? (
                                    <div className="space-y-2">
                                        {publicRooms.slice(0, 10).map((room, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleQuickJoin(room.name)}
                                                disabled={isLoading || !formData.participantName.trim()}
                                                className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-white font-medium">{room.name}</p>
                                                        <div className="flex items-center space-x-4 text-xs text-gray-400">
                                                            <span>{room.numParticipants} 人在线</span>
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                                                                room.numParticipants > 0
                                                                    ? 'bg-green-900 text-green-300'
                                                                    : 'bg-gray-700 text-gray-400' // '空闲'状态颜色也可以调整
                                                            }`}>
                                                            {room.numParticipants > 0 ? '活跃' : '空闲'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <p>暂无活跃的公开房间</p>
                                        <p className="text-sm mt-1">创建一个新房间开始聊天吧！</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 功能介绍 */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-700 p-6 text-center">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">高清视频通话</h3>
                            <p className="text-gray-300 text-sm">支持高达1080p的视频质量，自适应网络带宽</p>
                        </div>

                        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-700 p-6 text-center">
                            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">实时聊天</h3>
                            <p className="text-gray-300 text-sm">支持文字和图片消息，实时同步无延迟</p>
                        </div>

                        <div className="bg-black/20 backdrop-blur-sm rounded-xl border border-gray-700 p-6 text-center">
                            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">屏幕共享</h3>
                            <p className="text-gray-300 text-sm">轻松分享屏幕内容，支持窗口和应用选择</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* 页脚 */}
            <footer className="bg-black/20 backdrop-blur-sm border-t border-gray-700 mt-16">
                <div className="container mx-auto px-4 py-8">
                    <div className="text-center text-gray-400">
                        <p>&copy; 2024 LiveKit 视频会议. 基于 LiveKit 构建</p>
                        <div className="flex justify-center space-x-6 mt-4">
                            <Link href="/privacy" className="hover:text-white transition-colors">隐私政策</Link>
                            <Link href="/terms" className="hover:text-white transition-colors">服务条款</Link>
                            <Link href="/support" className="hover:text-white transition-colors">技术支持</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}