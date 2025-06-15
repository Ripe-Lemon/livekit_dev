// 文件路径: app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // 1. 导入 useRouter 用于程序化导航

export default function Home() {
    // 2. 使用 state 来存储房间名和用户名的输入值
    const [roomName, setRoomName] = useState('');
    const [participantName, setParticipantName] = useState('');
    const router = useRouter();

    // 3. 定义处理进入房间的函数
    const handleJoinRoom = () => {
        // 简单验证，确保用户输入了内容
        if (!roomName || !participantName) {
            alert('请输入房间名和用户名！');
            return;
        }
        // 4. 使用查询参数构建目标 URL，并进行编码以防特殊字符
        const href = `/room?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(participantName)}`;
        router.push(href); // 导航到房间页
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="flex w-full max-w-sm flex-col gap-4">
                <h1 className="text-center text-2xl font-bold">加入视频房间</h1>
                {/* 5. 房间名输入框 */}
                <input
                    type="text"
                    placeholder="请输入房间名"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="rounded-md border bg-transparent px-4 py-2"
                />
                {/* 6. 用户名输入框 */}
                <input
                    type="text"
                    placeholder="请输入你的名字"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    className="rounded-md border bg-transparent px-4 py-2"
                />
                {/* 7. 使用 button 和 onClick 事件来触发导航 */}
                <button
                    onClick={handleJoinRoom}
                    className="rounded-full bg-foreground px-8 py-4 font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
                    // 如果输入框为空，则禁用按钮
                    disabled={!roomName || !participantName}
                >
                    进入房间
                </button>
            </div>
        </main>
    );
}