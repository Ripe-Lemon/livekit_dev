'use client';

import { useRoomContext } from '@livekit/components-react';
import { useEffect, useState } from 'react';

// 房间信息组件
export function RoomInfo() {
    const room = useRoomContext();
    const [participantCount, setParticipantCount] = useState(room.numParticipants);

    // 监听参与者加入和离开事件来更新人数
    useEffect(() => {
        const updateParticipantCount = () => {
            setParticipantCount(room.numParticipants);
        };

        room.on('participantConnected', updateParticipantCount);
        room.on('participantDisconnected', updateParticipantCount);

        // 初始加载时更新一次
        updateParticipantCount();

        // 组件卸载时清理事件监听器
        return () => {
            room.off('participantConnected', updateParticipantCount);
            room.off('participantDisconnected', updateParticipantCount);
        };
    }, [room]);

    return (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800/60 text-white">
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                <span className="text-sm font-medium">{room.name}</span>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="m22 21-2-2"/>
                    <circle cx="16" cy="11" r="3"/>
                </svg>
                <span className="text-sm font-medium">{participantCount}</span>
            </div>
        </div>
    );
}