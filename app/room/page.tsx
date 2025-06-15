// 文件路径: app/room/page.tsx
'use client';

import {
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    RoomContext,
    Chat,
    LayoutContextProvider,
    useLayoutContext, // <-- 1. 导入 useLayoutContext Hook
    RoomHeader,
} from '@livekit/components-react';
import {
    Room,
    Track,
    createLocalAudioTrack,
    AudioPresets,
} from 'livekit-client';
import '@livekit/components-styles';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 自定义音频控制 (无变化)
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
    const baseButtonStyles = "lk-button";
    const enabledStyles = "lk-button-primary";
    return (
        <>
            <button
                onClick={onToggleNoiseSuppression}
                className={`${baseButtonStyles} ${isNoiseSuppressionEnabled ? enabledStyles : ''}`}
            >
                降噪 {isNoiseSuppressionEnabled ? '开' : '关'}
            </button>
            <button
                onClick={onToggleEchoCancellation}
                className={`${baseButtonStyles} ${isEchoCancellationEnabled ? enabledStyles : ''}`}
            >
                回声消除 {isEchoCancellationEnabled ? '开' : '关'}
            </button>
        </>
    );
}

// =======================================================================
//     ↓↓↓ 修改点: 创建一个新的组件来包裹所有UI元素 ↓↓↓
//     这样我们就可以在这个组件内部安全地使用 useLayoutContext
// =======================================================================
function RoomLayoutAndControls({ onToggleNoiseSuppression, onToggleEchoCancellation, isNoiseSuppressionEnabled, isEchoCancellationEnabled }: any) {
    // 2. 使用 hook 从 context 中获取 chat 窗口的显示状态
    const { showChat } = useLayoutContext().widget.state;

    return (
        <div data-lk-theme="default" className="flex h-screen flex-col bg-gray-900">
            <RoomHeader />
            <div className="flex flex-1 overflow-hidden">
                {/* 左侧聊天面板，其可见性由 context 的 showChat 状态决定 */}
                <div
                    className={`
                        flex flex-col transition-all duration-300
                        ${showChat ? 'w-full max-w-sm' : 'w-0'}
                    `}
                >
                    {showChat && <Chat className="flex-1" />}
                </div>

                {/* 右侧主视频区域 */}
                <div className="flex-1 flex flex-col">
                    <MyVideoConference />
                    <RoomAudioRenderer />
                </div>
            </div>

            {/* 统一的底部控制栏 */}
            <div className="flex items-center justify-center gap-4 p-4 bg-gray-900/80 backdrop-blur-sm">
                {/* 3. 移除错误的 onChatToggle 属性。ControlBar 会自动更新 context */}
                <ControlBar
                    variation="minimal"
                    controls={{
                        microphone: true,
                        camera: true,
                        chat: true,
                        screenShare: true,
                        disconnect: false,
                    }}
                />
                <div className="h-6 w-px bg-gray-600"></div>
                <AudioProcessingControls
                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                    onToggleNoiseSuppression={onToggleNoiseSuppression}
                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                    onToggleEchoCancellation={onToggleEchoCancellation}
                />
            </div>
        </div>
    );
}


function LiveKitRoom() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // 4. 移除我们自己管理的 showChat state，完全交给 LiveKit context
    // const [showChat, setShowChat] = useState(false);

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
                    throw new Error('服务器配置错误: 未找到 LiveKit URL。');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">正在连接房间...</div>;
    }

    if (error) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-900">
                <p className="text-xl font-bold text-red-500">连接错误</p>
                <div className="text-lg text-gray-300">{error}</div>
                <Link href="/" className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-lg text-white shadow-sm hover:bg-blue-700">
                    返回大厅
                </Link>
            </div>
        );
    }

    return (
        <RoomContext.Provider value={room}>
            <LayoutContextProvider>
                <RoomLayoutAndControls
                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                    onToggleEchoCancellation={handleToggleEchoCancellation}
                />
            </LayoutContextProvider>
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
        <GridLayout tracks={tracks} className="flex-1">
            <ParticipantTile />
        </GridLayout>
    );
}

export default function Page() {
    return (
        <div>
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-900 text-xl text-white">加载中...</div>}>
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