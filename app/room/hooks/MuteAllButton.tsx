// 文件路径: app/room/hooks/MuteAllButton.tsx
'use client';

import { useRoomContext, useRemoteParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import React, { useState, useMemo } from 'react';

/**
 * 一个可以静音或取消静音所有远程参与者的按钮。
 * 注意：这是本地静音，意味着你将听不到他们的声音，
 * 但并不会关闭他们设备上的麦克风。
 */
export function MuteAllButton() {
    const room = useRoomContext();
    const remoteParticipants = useRemoteParticipants();

    // 使用一个 state 来追踪我们期望的静音状态
    // true: 我们希望所有人都被静音
    // false: 我们希望所有人都被取消静音
    const [isMuted, setIsMuted] = useState(false);

    // 检查是否所有远程参与者的音轨都已经被禁用（本地静音）
    const areAllCurrentlyMuted = useMemo(() => {
        if (remoteParticipants.length === 0) {
            return false;
        }
        return remoteParticipants.every(p => {
            const audioTrack = p.getTrackPublication(Track.Source.Microphone);
            // 如果没有音轨，或者音轨被禁用了，就视为已静音
            return !audioTrack || !audioTrack.isSubscribed || !audioTrack.isEnabled;
        });
    }, [remoteParticipants]);

    // 切换所有远程参与者的音频轨道状态
    const toggleMuteAll = () => {
        const desiredMuteState = !areAllCurrentlyMuted;
        remoteParticipants.forEach(participant => {
            const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
            if (audioTrack && audioTrack.isSubscribed) {
                // desiredMuteState 为 true 时，禁用轨道 (静音)
                // desiredMuteState 为 false 时，启用轨道 (取消静音)
                audioTrack.setEnabled(!desiredMuteState);
            }
        });
        // 更新我们的追踪状态
        setIsMuted(desiredMuteState);
    };

    const baseButtonStyles = "lk-button";

    return (
        <button
            onClick={toggleMuteAll}
            disabled={remoteParticipants.length === 0}
            className={baseButtonStyles}
        >
            {areAllCurrentlyMuted ? '取消全体静音' : '全体静音'}
        </button>
    );
}