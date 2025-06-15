// 文件路径: app/room/hooks/useLiveKitConnection.ts
// @/app/room/hooks/useLiveKitConnection.ts
'use client';

import { Room } from 'livekit-client';
import { useEffect, useState } from 'react';

/**
 * 自定义 Hook，用于管理 LiveKit 房间的连接状态。
 * @param roomName - 房间名称
 * @param participantName - 参与者名称
 * @returns - { room, isLoading, error }
 */
export function useLiveKitConnection(roomName: string | null, participantName: string | null) {
    const [room] = useState(() => new Room({
        adaptiveStream: true,
        dynacast: true,
    }));
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

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

                // 备注: 建议将API URL也放入环境变量中
                const apiUrl = `https://livekit-api.2k2.cc/api/room?room=${roomName}&identity=${participantName}&name=${participantName}`;
                const resp = await fetch(apiUrl);
                if (!mounted) return;

                const data = await resp.json();
                if (data.token) {
                    await room.connect(livekitUrl, data.token);
                    if (!mounted) return;
                    console.log(`成功连接到 LiveKit 房间: ${roomName}`);
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
    }, [room, roomName, participantName]);

    return { room, isLoading, error };
}