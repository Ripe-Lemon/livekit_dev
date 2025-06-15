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
import {
    Room,
    Track,
    createLocalAudioTrack,
    createLocalVideoTrack,
    VideoPresets,
    AudioPresets,
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 将核心逻辑封装在一个新组件中
function LiveKitRoom() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const searchParams = useSearchParams();

    useEffect(() => {
        let mounted = true;

        const roomName = searchParams.get('roomName');
        const participantName = searchParams.get('participantName');

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
                    setError('服务器配置错误: 未找到 LiveKit URL。');
                    setIsLoading(false);
                    return;
                }

                const apiUrl = `https://livekit-api.2k2.cc/api/room?room=${roomName}&identity=${participantName}&name=${participantName}`;
                const resp = await fetch(apiUrl);

                if (!mounted) return;

                const data = await resp.json();

                if (data.token) {
                    await room.connect(livekitUrl, data.token);
                    if (!mounted) return;
                    console.log(`成功连接到 LiveKit 房间: ${roomName}`);

                    console.log('正在以最大比特率模式发布音频...');
                    const audioTrack = await createLocalAudioTrack({
                        channelCount: 2,
                        echoCancellation: false,
                        noiseSuppression: false,
                    });
                    await room.localParticipant.publishTrack(audioTrack, {
                        audioPreset: AudioPresets.musicHighQualityStereo,
                        dtx: false,
                        red: false,
                        source: Track.Source.Microphone
                    });
                    console.log('最大比特率音频轨道发布成功。');

                } else {
                    throw new Error(data.error || '无法从服务器获取 Token');
                }
            } catch (e: any) {
                console.error(e);
                if (mounted) {
                    if (e.name === 'NotAllowedError' || e.message.includes('permission denied')) {
                        setError(`连接失败: 未能获取媒体权限。请在浏览器设置中允许访问麦克风和摄像头。`);
                    } else {
                        setError(`连接失败: ${e.message}`);
                    }
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
    }, [room, searchParams]);

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center text-xl">正在连接房间...</div>;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-xl font-bold text-red-500">连接错误</p>
                <div className="text-lg text-gray-700">{error}</div>
                <Link href="/" className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-lg text-white shadow-sm hover:bg-blue-700">
                    返回大厅
                </Link>
            </div>
        );
    }

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

// ==============================================================
//               ↓↓↓ 修改点: 在 Page 组件中添加悬浮按钮 ↓↓↓
// ==============================================================
export default function Page() {
    return (
        // 使用一个父级 div 来容纳页面内容和悬浮按钮
        <div>
            <Suspense fallback={<div className="flex h-screen items-center justify-center text-xl">加载中...</div>}>
                <LiveKitRoom />
            </Suspense>

            {/* 回到大厅的悬浮按钮 */}
            <Link
                href="/"
                className="
                    fixed          /* 固定定位，相对于视口 */
                    top-6          /* 距离顶部 1.5rem */
                    right-6        /* 距离右侧 1.5rem */
                    z-50           /* 确保在最上层 */
                    flex
                    h-14           /* 高度 */
                    w-14           /* 宽度 */
                    items-center
                    justify-center
                    rounded-full   /* 圆形 */
                    bg-black/60    /* 半透明黑色背景 */
                    text-white     /* 图标颜色 */
                    shadow-lg      /* 添加阴影 */
                    backdrop-blur-sm /* 背景模糊效果 */
                    transition-all /* 平滑过渡效果 */
                    hover:bg-black/80 /* 鼠标悬浮时变暗 */
                    hover:scale-105 /* 鼠标悬浮时轻微放大 */
                "
                aria-label="返回大厅"
            >
                {/* 内联 SVG Home 图标 */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
            </Link>
        </div>
    );
}