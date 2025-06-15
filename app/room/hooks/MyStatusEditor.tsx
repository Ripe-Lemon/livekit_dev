// 文件路径: app/room/hooks/MyStatusEditor.tsx
'use client';

import { useRoomContext } from '@livekit/components-react';
import React, { useState, useEffect } from 'react';

/**
 * 一个允许本地参与者编辑自己状态的组件。
 * 状态会通过参与者属性 (attributes) 同步给房间内的所有人。
 */
export function MyStatusEditor() {
    const room = useRoomContext();
    const [status, setStatus] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [feedback, setFeedback] = useState('');

    // 从本地参与者属性中初始化状态
    useEffect(() => {
        const initialStatus = room.localParticipant.attributes['status'] || '';
        setStatus(initialStatus);
    }, [room.localParticipant.attributes]);

    const handleStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setStatus(e.target.value);
        if (isEditing === false) {
            setIsEditing(true);
        }
    };

    // 保存状态
    const saveStatus = () => {
        // 使用 setAttributes 更新状态
        // 这个更新会自动广播给房间里的其他参与者
        room.localParticipant.setAttributes({
            status: status,
        });
        setFeedback('状态已更新！');
        setIsEditing(false);

        // 2秒后清除反馈信息
        setTimeout(() => {
            setFeedback('');
        }, 2000);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            saveStatus();
            // 让输入框失焦
            e.currentTarget.blur();
        }
    };

    return (
        <div className="relative w-full">
            <input
                type="text"
                value={status}
                onChange={handleStatusChange}
                onKeyDown={handleKeyDown}
                onBlur={saveStatus} // 当输入框失焦时也保存
                placeholder="设置我的状态 (例如: 正在摸鱼...)"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-4 pr-20 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {/* 保存按钮或提示信息 */}
            <div className="absolute inset-y-0 right-2 flex items-center">
                {feedback ? (
                    <span className="text-sm text-green-400 transition-opacity duration-300">{feedback}</span>
                ) : isEditing ? (
                    <button
                        onClick={saveStatus}
                        className="px-3 py-1 text-sm bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                    >
                        保存
                    </button>
                ) : null}
            </div>
        </div>
    );
}