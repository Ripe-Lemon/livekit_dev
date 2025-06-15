// 文件路径: app/room/page.tsx
'use client';

import {
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    RoomContext,
    useRoomContext,
} from '@livekit/components-react';
import {
    Room,
    Track,
    createLocalAudioTrack,
    AudioPresets,
    LocalAudioTrack,
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';


// =======================================================================
//     ↓↓↓ 修改点: 更新音频控制组件的样式，使其悬浮在顶部中央 ↓↓↓
// =======================================================================
interface AudioProcessingControlsProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => void;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => void;
}

function AudioProcessingControls({
                                     isNoiseSuppressionEnabled,
                                     onToggleNoiseSuppression,
                                     isEchoCancellationEnabled,
                                     onToggleEchoCancellation,
                                 }: AudioProcessingControlsProps) {
    // 按钮的基础样式
    const baseButtonStyles = "px-4 py-2 text-sm rounded-md text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400";
    // 激活状态的样式
    const enabledStyles = "bg-blue-600 hover:bg-blue-700";
    // 关闭状态的样式
    const disabledStyles = "bg-gray-800/80 hover:bg-gray-700/80";

    return (
        // 中文注释: 使用 fixed 定位，并用 left-1/2 和 -translate-x-1/2 的组合来实现水平居中
        <div
            className="
                fixed          /* 固定定位，悬浮于页面之上 */
                top-6          /* 距离顶部 1.5rem */
                left-1/2       /* 定位到屏幕中心线 */
                -translate-x-1/2 /* 向左移动自身宽度的一半，实现完美居中 */
                z-50           /* 确保在最上层 */
                flex           /* 使用 flex 布局排列内部按钮 */
                items-center
                gap-3          /* 按钮之间的间距 */
                rounded-lg     /* 圆角 */
                bg-black/60    /* 半透明黑色背景，与其它悬浮按钮统一 */
                p-2            /* 内部留白 */
                shadow-lg      /* 添加阴影 */
                backdrop-blur-sm /* 背景模糊效果 (毛玻璃) */
            "
        >
            <button
                onClick={onToggleNoiseSuppression}
                className={`${baseButtonStyles} ${isNoiseSuppressionEnabled ? enabledStyles : disabledStyles}`}
            >
                降噪: {isNoiseSuppressionEnabled ? '开启' : '关闭'}
            </button>
            <button
                onClick={onToggleEchoCancellation}
                className={`${baseButtonStyles} ${isEchoCancellationEnabled ? enabledStyles : disabledStyles}`}
            >
                回声消除: {isEchoCancellationEnabled ? '开启' : '关闭'}
            </button>
        </div>
    );
}


function RoomHeader() {
    const room = useRoomContext();
    return (
        <div className="fixed top-6 left-6 z-50 rounded-lg bg-black/60 px-4 py-2 shadow-lg backdrop-blur-sm transition-all">
            <p className="text-xl font-medium text-gray-200">{room.name}</p>
            <p className="text-sm text-gray-300">{room.numParticipants} 人在线</p>
        </div>
    );
}

// 将核心逻辑封装在一个新组件中
function LiveKitRoom() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
    const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);


    const searchParams = useSearchParams();

    const publishAudioTrack = useCallback(async (noiseSuppression: boolean, echoCancellation: boolean) => {
        const existingTrackPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (existingTrackPublication && existingTrackPublication.track) {
            existingTrackPublication.track.stop();
            await room.localParticipant.unpublishTrack(existingTrackPublication.track);
        }

        console.log(`正在创建音轨, 降噪: ${noiseSuppression}, 回声消除: ${echoCancellation}`);
        try {
            const audioTrack = await createLocalAudioTrack({
                channelCount: 2,
                echoCancellation: echoCancellation,
                noiseSuppression: noiseSuppression,
            });

            await room.localParticipant.publishTrack(audioTrack, {
                audioPreset: AudioPresets.musicHighQualityStereo,
                dtx: false,
                red: false,
                source: Track.Source.Microphone
            });
            console.log('新的音频轨道发布成功。');
        } catch (e) {
            console.error("创建或发布音频轨道失败:", e);
            setError(`无法应用音频设置: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [room]);


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

                    await publishAudioTrack(isNoiseSuppressionEnabled, isEchoCancellationEnabled);

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
    }, [room, searchParams, publishAudioTrack, isNoiseSuppressionEnabled, isEchoCancellationEnabled]);


    const handleToggleNoiseSuppression = async () => {
        const newValue = !isNoiseSuppressionEnabled;
        setIsNoiseSuppressionEnabled(newValue);
        await publishAudioTrack(newValue, isEchoCancellationEnabled);
    };

    const handleToggleEchoCancellation = async () => {
        const newValue = !isEchoCancellationEnabled;
        setIsEchoCancellationEnabled(newValue);
        await publishAudioTrack(isNoiseSuppressionEnabled, newValue);
    };


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
                <RoomHeader />
                {/* ============================================================== */}
                {/* ↓↓↓ 修改点: 将音频控件移到这里，使其成为顶级UI元素 ↓↓↓        */}
                {/* ============================================================== */}
                <AudioProcessingControls
                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                    onToggleEchoCancellation={handleToggleEchoCancellation}
                />

                <MyVideoConference />
                <RoomAudioRenderer />

                {/* ============================================================== */}
                {/* ↓↓↓ 修改点: ControlBar 现在不再包含自定义控件 ↓↓↓        */}
                {/* ============================================================== */}
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
        <div>
            <Suspense fallback={<div className="flex h-screen items-center justify-center text-xl">加载中...</div>}>
                <LiveKitRoom />
            </Suspense>

            {/* 回到大厅的悬浮按钮 */}
            <Link
                href="/"
                className="fixed top-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-105"
                aria-label="返回大厅"
            >
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