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
//                      ↓↓↓ 修改点 1: 引入必要的模块 ↓↓↓
// ==============================================================
import {
    Room,
    Track,
    // 引入 createLocalAudioTrack 用于创建自定义音轨
    createLocalAudioTrack,
    // 引入 AudioPresets 以使用高保真音频预设
    AudioPresets,
} from 'livekit-client';
// ==============================================================
import '@livekit/components-styles';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 将核心逻辑封装在一个新组件中，以便在 Suspense 内部使用 useSearchParams
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
                    // 连接到房间
                    await room.connect(livekitUrl, data.token);
                    if (!mounted) return;
                    console.log(`成功连接到 LiveKit 房间: ${roomName}`);

                    // ==============================================================
                    //          ↓↓↓ 修改点 2: 添加 Hi-Fi 音频发布逻辑 ↓↓↓
                    // ==============================================================
                    console.log('正在以 Hi-Fi 模式发布音频...');

                    // 1. 创建自定义的高保真音频轨道
                    //    - channelCount: 2      -> 立体声
                    //    - echoCancellation: false -> 禁用回声消除，保留原始声音
                    //    - noiseSuppression: false -> 禁用噪声抑制，用于音乐等保真场景
                    const audioTrack = await createLocalAudioTrack({
                        channelCount: 2,
                        echoCancellation: false,
                        noiseSuppression: false,
                    });

                    // 2. 使用高保真预设来发布本地音频轨道
                    //    - audioPreset: AudioPresets.musicHighQualityStereo -> LiveKit 推荐的立体声音乐预设
                    //    - dtx: false         -> 禁用不连续传输，确保音频流持续
                    //    - red: false         -> 禁用冗余音频数据，在高比特率下通常不需要
                    await room.localParticipant.publishTrack(audioTrack, {
                        audioPreset: AudioPresets.musicHighQualityStereo,
                        dtx: false,
                        red: false,
                        source: Track.Source.Microphone // 明确音轨来源
                    });

                    console.log('Hi-Fi 音频轨道发布成功。');
                    // ==============================================================

                } else {
                    throw new Error(data.error || '无法从服务器获取 Token');
                }
            } catch (e: any) {
                console.error(e);
                if (mounted) {
                    // 如果错误是关于媒体权限的，给出更友好的提示
                    if (e.name === 'NotAllowedError' || e.message.includes('permission denied')) {
                        setError(`连接失败: 未能获取麦克风权限。请在浏览器设置中允许访问麦克风。`);
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

    // ... (组件的其余部分保持不变)

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
                {/* ControlBar 会自动检测到已发布的音轨并提供控制（如静音/取消静音） */}
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center text-xl">加载中...</div>}>
            <LiveKitRoom />
        </Suspense>
    );
}