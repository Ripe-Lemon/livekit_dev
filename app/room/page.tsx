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
// ==============================================================
//               ↓↓↓ 修改点 1: 引入视频相关的模块 ↓↓↓
// ==============================================================
import {
    Room,
    Track,
    createLocalAudioTrack,
    // 引入用于创建视频轨道的函数
    createLocalVideoTrack,
    // 引入视频质量预设
    VideoPresets, AudioPresets,
} from 'livekit-client';
// ==============================================================
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
        dynacast: true, // 开启 Dynacast 以优化带宽.

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

                    // --- 发布 Hi-Fi 音频轨道 ---
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
                    // 提供更详细的权限错误信息
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
                {/* MyVideoConference 组件现在可以正确显示您发布的视频了 */}
                <MyVideoConference />
                <RoomAudioRenderer />
                {/* ControlBar 会自动检测到已发布的音视频轨道并提供控制 */}
                <ControlBar />
            </div>
        </RoomContext.Provider>
    );
}

function MyVideoConference() {
    // 这个组件无需修改，它会自动订阅并显示所有可用的视频轨道
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-xl">加载中...</div>}>
            <LiveKitRoom />
        </Suspense>
    );
}