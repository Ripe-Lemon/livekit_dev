// 文件路径: app/room/components/MuteAllButton.tsx
'use client';

import { useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState } from 'react';

export function MuteAllButton() {
    const room = useRoomContext();
    const [isMutedAll, setIsMutedAll] = useState(false);

    const toggleMuteAll = () => {
        const newMutedState = !isMutedAll;
        setIsMutedAll(newMutedState);

        // 遍历所有远程参与者
        room.remoteParticipants.forEach(participant => {
            // 获取他们的麦克风轨道发布信息
            const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                // setEnabled 比 setSubscribed 更高效，因为它不需要重新协商
                audioPublication.setEnabled(!newMutedState);
            }
        });
    };

    const baseButtonStyles = "lk-button";
    const enabledStyles = "lk-button-primary";

    return (
        <button
            onClick={toggleMuteAll}
            className={`${baseButtonStyles} ${isMutedAll ? enabledStyles : ''}`}
        >
            {isMutedAll ? '取消全体静音' : '全体静音'}
        </button>
    );
}