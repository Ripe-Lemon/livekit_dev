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
    Chat, LayoutContextProvider, // 导入 Chat 组件
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

// =======================================================================
//     ↓↓↓ 修改点: 将音频控制组件重构为 ControlBar 的一部分 ↓↓↓
// =======================================================================
interface AudioProcessingControlsProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => void;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => void;
}

// 自定义音频控制按钮 (不再是悬浮组件)
function AudioProcessingControls({
                                     isNoiseSuppressionEnabled,
                                     onToggleNoiseSuppression,
                                     isEchoCancellationEnabled,
                                     onToggleEchoCancellation,
                                 }: AudioProcessingControlsProps) {
    // 按钮的基础样式 (适配 ControlBar)
    const baseButtonStyles = "lk-button";
    // 激活状态的样式
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

// 房间信息
function RoomInfo() {
    const room = useRoomContext();
    return (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800/60 text-white">
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                <span className="text-sm font-medium">{room.name}</span>
            </div>
            <div className="h-4 w-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="m22 21-2-2"/>
                    <circle cx="16" cy="11" r="3"/>
                </svg>
                <span className="text-sm font-medium">{room.numParticipants}</span>
            </div>
        </div>
    );
}

// 添加悬浮聊天组件
function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            {/* 悬浮聊天面板 */}
            <div
                className={`
                    fixed top-6 right-20 z-40 h-96 w-80 
                    transform transition-all duration-300 ease-in-out
                    ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 pointer-events-none'}
                `}
            >
                <div className="h-full rounded-lg bg-gray-900/95 backdrop-blur-sm shadow-2xl border border-gray-700">
                    {/* 聊天头部 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-700">
                        <h3 className="text-lg font-medium text-white">聊天</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    
                    {/* 聊天内容 */}
                    <div className="h-full">
                        <Chat className="h-full" />
                    </div>
                </div>
            </div>

            {/* 聊天按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    fixed top-6 right-96 z-50 flex h-12 w-12 items-center justify-center 
                    rounded-full shadow-lg backdrop-blur-sm transition-all
                    ${isOpen 
                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                        : 'bg-black/60 text-white hover:bg-black/80 hover:scale-105'
                    }
                `}
                aria-label={isOpen ? "关闭聊天" : "打开聊天"}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
            </button>
        </>
    );
}

// 核心房间逻辑
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
                <div data-lk-theme="default" className="flex h-screen flex-col bg-gray-900">
                    {/* 移除左侧聊天面板，现在整个区域都是视频 */}
                    <div className="flex-1 flex flex-col">
                        <MyVideoConference />
                        <RoomAudioRenderer />
                    </div>

                    {/* 统一的底部控制栏 - 移除聊天按钮 */}
                    <div className="flex flex-col gap-3 p-4 bg-gray-900/80 backdrop-blur-sm">
                        {/* 第一行：房间信息和音频处理控制 */}
                        <div className="flex items-center justify-between">
                            {/* 左侧：房间信息 */}
                            <RoomInfo />
                            
                            {/* 右侧：音频处理控制 */}
                            <div className="flex items-center gap-2">
                                <AudioProcessingControls
                                    isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                                    onToggleNoiseSuppression={handleToggleNoiseSuppression}
                                    isEchoCancellationEnabled={isEchoCancellationEnabled}
                                    onToggleEchoCancellation={handleToggleEchoCancellation}
                                />
                            </div>
                        </div>
                        
                        {/* 第二行：主要控制按钮居中 - 移除聊天按钮 */}
                        <div className="flex items-center justify-center gap-4">
                            <ControlBar
                                variation="minimal"
                                controls={{
                                    microphone: true,
                                    camera: true,
                                    screenShare: true,
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* 悬浮聊天组件 */}
                <FloatingChat />
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
        // 中文注释: 高度现在由 flex-1 自动管理，无需手动计算
        <GridLayout tracks={tracks} className="flex-1">
            <ParticipantTile />
        </GridLayout>
    );
}

// 页面入口组件
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