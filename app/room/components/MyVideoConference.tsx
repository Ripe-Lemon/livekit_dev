'use client';

import { GridLayout, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { CustomParticipantTile } from './CustomParticipantTile';

// 视频会议网格组件
export function MyVideoConference() {
    // 使用 useTracks hook 获取所有需要展示的轨道。
    // 'withPlaceholder: true' 确保即使参与者没有开启摄像头，也会为他们显示一个占位符。
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ]
    );

    return (
        // 1. 将 useTracks 返回的 tracks 数组传递给 GridLayout。
        // 2. 将 <CustomParticipantTile /> 作为子组件传递，GridLayout 会为每个参与者克隆它。
        <GridLayout tracks={tracks} className="flex-1">
            <CustomParticipantTile />
        </GridLayout>
    );
}