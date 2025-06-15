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

    // ==============================================================
    //               ↓↓↓ 修改点 2: 为加载状态添加暗色背景和亮色文字 ↓↓↓
    // ==============================================================
    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-black text-xl text-white">正在连接房间...</div>;
    }
    // ==============================================================
    //               ↓↓↓ 修改点 3: 为错误状态添加暗色背景和亮色文字 ↓↓↓
    // ==============================================================
    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black">
                <p className="text-xl font-bold text-red-500">连接错误</p>
                {/* 将深灰色文字改为浅灰色，以便在暗色背景下阅读 */}
                <div className="text-lg text-gray-300">{error}</div>
                <Link href="/" className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-lg text-white shadow-sm hover:bg-blue-700">
                    返回大厅
                </Link>
            </div>
        );
    }

    return (
        <RoomContext.Provider value={room}>
            {/* ============================================================== */}
            {/* ↓↓↓ 修改点 1: 切换 LiveKit 主题为暗色 ↓↓↓         */}
            {/* ============================================================== */}
            <div data-lk-theme="dark" style={{ height: '100dvh' }}>
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

export default function Page() {
    return (
        // ==============================================================
        //               ↓↓↓ 修改点 4: 为 Suspense 后备UI添加暗色主题 ↓↓↓
        // ==============================================================
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-xl text-white">加载中...</div>}>
            <LiveKitRoom />
        </Suspense>
    );
}