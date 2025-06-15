// 文件路径: app/room/page.tsx
'use client';

import {
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation'; // 1. 导入 useSearchParams 钩子
import Link from 'next/link';

// 2. 将核心逻辑封装在一个新组件中，以便在 Suspense 内部使用 useSearchParams
function LiveKitRoom() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    // 3. 使用 useSearchParams 获取 URL 查询参数
    const searchParams = useSearchParams();

    useEffect(() => {
        let mounted = true;

        // 4. 从 URL 中获取房间名和用户名
        const roomName = searchParams.get('roomName');
        const participantName = searchParams.get('participantName');

        // 5. 如果 URL 中缺少参数，则显示错误信息
        if (!roomName || !participantName) {
            setError('缺少房间名或用户名参数。');
            setIsLoading(false);
            return;
        }

        const connectToRoom = async () => {
            try {
                const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
                if (!livekitUrl) {
                    console.error('NEXT_PUBLIC_LIVEKIT_URL is not defined in .env.local');
                    setError('服务器配置错误。');
                    setIsLoading(false);
                    return;
                }

                // 6. 使用从 URL 获取的参数来请求 token
                const resp = await fetch(`https://livekit-api.2k2.cc/api/token?room=${roomName}&username=${participantName}`);
                const data = await resp.json();

                if (!mounted) return;

                if (data.token) {
                    await room.connect(livekitUrl, data.token);
                    console.log(`Successfully connected to LiveKit room: ${roomName}`);
                } else {
                    throw new Error(data.error || '无法获取 Token');
                }
            } catch (e: any) {
                console.error(e);
                if (mounted) {
                    setError(`连接失败: ${e.message}`);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        connectToRoom();

        return () => {
            mounted = false;
            room.disconnect();
        };
        // 7. 将 searchParams 添加到依赖项数组中
    }, [room, searchParams]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center">正在连接房间...</div>;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <div className="text-red-500">{error}</div>
                <Link href="/" className="rounded-md bg-blue-500 px-4 py-2 text-white">
                    返回主页
                </Link>
            </div>
        );
    }

    // 如果连接成功，渲染视频会议界面
    return (
        <RoomContext.Provider value={room}>
            <div data-lk-theme="default" style={{ height: '100dvh' }}>
                <MyVideoConference />
                <RoomAudioRenderer />
                <ControlBar />
            </div>
        </RoomContext.Provider>
    );
}

function MyVideoConference() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );
    return (
        <GridLayout tracks={tracks} style={{ height: 'calc(100vh - var(--lk-control-bar-height))' }}>
            <ParticipantTile />
        </GridLayout>
    );
}

// 8. 导出的页面组件使用 Suspense 包裹 LiveKitRoom
//    Suspense 用于处理 useSearchParams 在初始渲染时的异步行为
export default function Page() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">加载中...</div>}>
            <LiveKitRoom />
        </Suspense>
    );
}