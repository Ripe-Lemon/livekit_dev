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
    // 不再需要从 livekit-client 导入这些，因为它们是默认值
    // createLocalVideoTrack,
    // VideoPresets,
    AudioPresets,
    LocalAudioTrack, // <--- 新增导入
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense, useCallback } from 'react'; // <--- 新增导入 useCallback
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// =======================================================================
//     ↓↓↓ 新增点: 为降噪和回声消除按钮创建一个独立的UI组件 ↓↓↓
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
    const baseButtonStyles = "px-3 py-2 text-sm rounded-md text-white transition-colors";
    // 激活状态的样式
    const enabledStyles = "bg-blue-600 hover:bg-blue-700";
    // 关闭状态的样式
    const disabledStyles = "bg-gray-700 hover:bg-gray-600";

    return (
        <div className="flex items-center gap-4">
            <button
                onClick={onToggleNoiseSuppression}
                className={`${baseButtonStyles} ${isNoiseSuppressionEnabled ? enabledStyles : disabledStyles}`}
            >
                {/* 中文注释: 根据状态显示不同文本 */}
                降噪: {isNoiseSuppressionEnabled ? '开启' : '关闭'}
            </button>
            <button
                onClick={onToggleEchoCancellation}
                className={`${baseButtonStyles} ${isEchoCancellationEnabled ? enabledStyles : disabledStyles}`}
            >
                {/* 中文注释: 根据状态显示不同文本 */}
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

    // ==============================================================
    //      ↓↓↓ 修改点: 使用 useState 管理音频处理选项的状态 ↓↓↓
    // ==============================================================
    const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
    const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);


    const searchParams = useSearchParams();

    // ========================================================================
    //      ↓↓↓ 修改点: 将音频发布逻辑封装到一个可重用的函数中 ↓↓↓
    // ========================================================================
    const publishAudioTrack = useCallback(async (noiseSuppression: boolean, echoCancellation: boolean) => {
        // 中文注释: 如果已经发布了麦克风轨道，先取消发布它
        const existingTrackPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (existingTrackPublication && existingTrackPublication.track) {
            // 中文注释: 停止旧的轨道并取消发布
            existingTrackPublication.track.stop();
            await room.localParticipant.unpublishTrack(existingTrackPublication.track);
        }

        console.log(`正在创建音轨, 降噪: ${noiseSuppression}, 回声消除: ${echoCancellation}`);
        try {
            // 中文注释: 使用当前的状态来创建新的音频轨道
            const audioTrack = await createLocalAudioTrack({
                channelCount: 2,
                echoCancellation: echoCancellation, // 使用状态变量
                noiseSuppression: noiseSuppression, // 使用状态变量
            });

            // 中文注释: 发布新创建的轨道
            await room.localParticipant.publishTrack(audioTrack, {
                audioPreset: AudioPresets.musicHighQualityStereo,
                dtx: false,
                red: false,
                source: Track.Source.Microphone
            });
            console.log('新的音频轨道发布成功。');
        } catch (e) {
            console.error("创建或发布音频轨道失败:", e);
            // 可以在这里设置一个错误状态来通知用户
            setError(`无法应用音频设置: ${e instanceof Error ? e.message : String(e)}`);
        }
    }, [room]); // 中文注释: 这个函数依赖 room 对象，当 room 对象变化时，函数会重新创建


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

                    // ==============================================================
                    //  ↓↓↓ 修改点: 调用封装好的函数来发布初始音轨 ↓↓↓
                    // ==============================================================
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
        // 中文注释: 将依赖项添加到useEffect的数组中
    }, [room, searchParams, publishAudioTrack, isNoiseSuppressionEnabled, isEchoCancellationEnabled]);


    // ==============================================================
    //      ↓↓↓ 新增点: 创建处理按钮点击的函数 ↓↓↓
    // ==============================================================
    const handleToggleNoiseSuppression = async () => {
        const newValue = !isNoiseSuppressionEnabled;
        setIsNoiseSuppressionEnabled(newValue);
        // 中文注释: 使用新值重新发布音轨
        await publishAudioTrack(newValue, isEchoCancellationEnabled);
    };

    const handleToggleEchoCancellation = async () => {
        const newValue = !isEchoCancellationEnabled;
        setIsEchoCancellationEnabled(newValue);
        // 中文注释: 使用新值重新发布音轨
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
                <MyVideoConference />
                <RoomAudioRenderer />
                {/* ============================================================== */}
                {/* ↓↓↓ 修改点: 将自定义控件传递给 ControlBar ↓↓↓        */}
                {/* ============================================================== */}
                <ControlBar>
                    {/* 中文注释: 将我们的自定义按钮组件放在控制栏的起始位置 */}
                    <div className="flex-1">
                        <AudioProcessingControls
                            isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                            onToggleNoiseSuppression={handleToggleNoiseSuppression}
                            isEchoCancellationEnabled={isEchoCancellationEnabled}
                            onToggleEchoCancellation={handleToggleEchoCancellation}
                        />
                    </div>
                </ControlBar>
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