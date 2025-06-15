// 文件路径: app/room/hooks/useAudioProcessing.ts
// @/app/room/hooks/useAudioProcessing.ts
'use client';

import { Room, Track, createLocalAudioTrack, AudioPresets } from 'livekit-client';
import { useState, useCallback, useEffect } from 'react';

/**
 * 自定义 Hook，用于管理本地音频轨道的处理（降噪、回声消除）。
 * @param room - LiveKit Room 实例
 * @param isConnected - 房间是否已连接
 * @returns - { isNoiseSuppressionEnabled, handleToggleNoiseSuppression, isEchoCancellationEnabled, handleToggleEchoCancellation }
 */
export function useAudioProcessing(room: Room | null, isConnected: boolean) {
    const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
    const [isEchoCancellationEnabled, setIsEchoCancellationEnabled] = useState(false);

    // 重新发布音轨的函数
    const publishAudioTrack = useCallback(async (noiseSuppression: boolean, echoCancellation: boolean) => {
        if (!room || !room.localParticipant) return;

        // 停止并取消发布现有的音轨
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
                dtx: false, // Discontinuous Transmission
                red: false, // Redundant Audio Data
                source: Track.Source.Microphone
            });
            console.log('新的音频轨道发布成功。');
        } catch (e) {
            console.error("创建或发布音频轨道失败:", e);
            // 可以在这里设置一个错误状态并显示给用户
        }
    }, [room]);

    // 在首次连接成功后发布初始音轨
    useEffect(() => {
        if (isConnected && room) {
            publishAudioTrack(isNoiseSuppressionEnabled, isEchoCancellationEnabled);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, room]); // 依赖 isConnected 确保只在连接后执行一次

    // 切换降噪
    const handleToggleNoiseSuppression = async () => {
        const newValue = !isNoiseSuppressionEnabled;
        setIsNoiseSuppressionEnabled(newValue);
        await publishAudioTrack(newValue, isEchoCancellationEnabled);
    };

    // 切换回声消除
    const handleToggleEchoCancellation = async () => {
        const newValue = !isEchoCancellationEnabled;
        setIsEchoCancellationEnabled(newValue);
        await publishAudioTrack(isNoiseSuppressionEnabled, newValue);
    };

    return {
        isNoiseSuppressionEnabled,
        handleToggleNoiseSuppression,
        isEchoCancellationEnabled,
        handleToggleEchoCancellation,
    };
}