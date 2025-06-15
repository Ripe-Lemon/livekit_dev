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
import { useEffect, useState } from 'react';

export default function Page() {
    // 定义 state 来管理加载状态和连接后的房间实例
    const [isLoading, setIsLoading] = useState(true); // 1. 使用 isLoading 状态
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    useEffect(() => {
        let mounted = true;

        const connectToRoom = async () => {
            // 定义在组件内部的常量
            const roomName = 'quickstart-room';
            const participantName = 'quickstart-user';

            try {
                // 2. 检查环境变量是否存在
                const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
                if (!livekitUrl) {
                    console.error('NEXT_PUBLIC_LIVEKIT_URL is not defined in .env.local');
                    setIsLoading(false); // 停止加载，显示错误或空状态
                    return;
                }

                // 从你的 API 获取 token
                const resp = await fetch(`https://livekit-api.gui.ink/api/token?room=${roomName}&username=${participantName}`);
                const data = await resp.json();

                if (!mounted) return;

                if (data.token) {
                    // 连接到 LiveKit 房间
                    await room.connect(livekitUrl, data.token);
                    console.log('Successfully connected to LiveKit room');
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) {
                    setIsLoading(false); // 无论成功或失败，都结束加载状态
                }
            }
        };

        connectToRoom();

        return () => {
            mounted = false;
            // 当组件卸载时，断开连接
            room.disconnect();
        };
    }, [room]); // 依赖项是 room 实例

    // 3. 使用 isLoading 状态来显示加载信息
    if (isLoading) {
        return <div>Connecting to room...</div>;
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