'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Room } from 'livekit-server-sdk';

export default function Lobby() {
    const [rooms, setRooms] = useState<Room[]>([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [participantName, setParticipantName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // 组件加载时获取房间列表
    useEffect(() => {
        fetchRooms();
    }, []);

    // 获取房间列表的函数
    const fetchRooms = async () => {
        try {
            setIsLoading(true);
            const res = await fetch('https://livekit-api.2k2.cc/api/rooms');
            if (!res.ok) throw new Error('无法从服务器获取房间列表');
            const data = await res.json();
            setRooms(data.rooms);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // 处理加入房间的逻辑
    const handleJoinRoom = (roomName: string) => {
        if (!participantName) {
            alert('请输入您的名字！');
            return;
        }
        // 跳转到对应的房间页面
        router.push(`/room?roomName=${roomName}&participantName=${participantName}`);
    };

    // 处理创建房间的逻辑
    const handleCreateRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRoomName) {
            alert('请输入新房间的名称！');
            return;
        }

        try {
            // 发送 POST 请求到我们的 API 来创建房间
            const res = await fetch('https://livekit-api.2k2.cc/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newRoomName }),
            });
            if (!res.ok) throw new Error('创建房间失败');
            // 创建成功后，直接加入该房间
            handleJoinRoom(newRoomName);
        } catch (e: any) {
            setError(e.message);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center text-gray-800 p-4">
            <div className="w-full max-w-2xl rounded-lg text-gray-800 p-8 shadow-md">
                <h1 className="mb-6 text-center text-3xl font-bold text-gray-300">LiveKit 房间大厅</h1>

                {/* 公共的用户信息输入区 */}
                <div className="mb-8">
                    <label htmlFor="participant-name" className="mb-2 block text-lg font-medium text-gray-300">
                        您的名字
                    </label>
                    <input
                        id="participant-name"
                        type="text"
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        placeholder="例如：张三"
                        className="w-full rounded-md border text-gray-300 p-3 text-lg focus:border-blue-500 focus:ring-blue-500"
                        required
                    />
                </div>

                {/* 创建新房间区域 */}
                <div className="mb-8">
                    <h2 className="mb-4 text-2xl font-semibold text-gray-300">创建新房间</h2>
                    <form onSubmit={handleCreateRoom} className="flex gap-4">
                        <input
                            type="text"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="输入新房间名称"
                            className="flex-grow rounded-md border text-gray-300 p-3 text-lg focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!newRoomName || !participantName}
                            className="rounded-md bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            创建并加入
                        </button>
                    </form>
                </div>

                {/* 现有房间列表 */}
                <div>
                    <h2 className="mb-4 text-2xl font-semibold text-gray-300">选择一个房间加入</h2>
                    {isLoading ? (
                        <p>正在加载房间列表...</p>
                    ) : error ? (
                        <p className="text-red-500">{error}</p>
                    ) : rooms.length > 0 ? (
                        <ul className="space-y-3">
                            {rooms.map((room) => (
                                <li
                                    key={room.sid}
                                    className="flex items-center justify-between rounded-md bg-gray-700 p-4"
                                >
                                    <div>
                                        <p className="text-xl font-medium text-gray-300">{room.name}</p>
                                        <p className="text-sm text-gray-300">
                                            {room.numParticipants} 人在线
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleJoinRoom(room.name)}
                                        disabled={!participantName}
                                        className="rounded-md bg-green-600 px-5 py-2 text-base font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                    >
                                        加入
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500">当前没有活跃的房间，快创建一个吧！</p>
                    )}
                </div>
            </div>
        </div>
    );
}