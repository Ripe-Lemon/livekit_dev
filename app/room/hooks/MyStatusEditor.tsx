// 文件路径: app/room/components/MyStatusEditor.tsx
'use client';

import { useRoomContext } from '@livekit/components-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { FaEdit } from 'react-icons/fa';

// 定义状态的数据结构
interface MyStatus {
    activity: string;
    notes: string;
}

export function MyStatusEditor() {
    const room = useRoomContext();
    const [status, setStatus] = useState<MyStatus>({ activity: '', notes: '' });
    const [isEditing, setIsEditing] = useState(false);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    // 从 localStorage 加载初始状态
    useEffect(() => {
        const savedStatus = localStorage.getItem('myParticipantStatus');
        if (savedStatus) {
            setStatus(JSON.parse(savedStatus));
        }
    }, []);

    // 状态变化时，保存到 localStorage 并广播到房间 (带防抖)
    const broadcastStatus = useCallback((newStatus: MyStatus) => {
        if (room.localParticipant) {
            // 将状态设置到参与者属性中，这将自动同步给其他人
            room.localParticipant.setAttributes({
                activity: newStatus.activity,
                notes: newStatus.notes,
            });
        }
        // 保存到浏览器本地存储
        localStorage.setItem('myParticipantStatus', JSON.stringify(newStatus));
    }, [room.localParticipant]);

    useEffect(() => {
        // 组件加载后，如果已连接，立即广播一次本地存储的状态
        if (room.state === 'connected') {
            broadcastStatus(status);
        }
    }, [room.state, status, broadcastStatus]);


    const handleInputChange = (field: keyof MyStatus, value: string) => {
        const newStatus = { ...status, [field]: value };
        setStatus(newStatus);

        // 防抖: 延迟 500ms 后再广播，避免频繁发送
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            broadcastStatus(newStatus);
        }, 500);
    };

    if (!isEditing) {
        return (
            <div className="flex items-center gap-4 p-2 rounded-lg bg-gray-800/60 text-white text-sm">
                <div className='flex-grow'>
                    <p><strong>状态:</strong> {status.activity || '未设置'}</p>
                    <p><strong>备注:</strong> {status.notes || '未设置'}</p>
                </div>
                <button onClick={() => setIsEditing(true)} className="lk-button p-2"><FaEdit/></button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-gray-800/80 text-white">
            <h3 className="font-bold">编辑我的状态</h3>
            <input
                type="text"
                placeholder="我在干嘛... (例如: 编码中)"
                value={status.activity}
                onChange={(e) => handleInputChange('activity', e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <input
                type="text"
                placeholder="备注... (例如: 暂时离开)"
                value={status.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            />
            <button onClick={() => setIsEditing(false)} className="lk-button lk-button-primary mt-2">
                完成
            </button>
        </div>
    );
}