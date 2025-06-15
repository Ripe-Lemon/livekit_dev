// 文件路径: app/room/hooks/CustomParticipantTile.tsx
'use client';

import {
    ParticipantName,
    ParticipantTile,
    useParticipantAttribute,
} from '@livekit/components-react';
import React from 'react';

/**
 * 一个自定义的参与者瓦片组件。
 * 它会在参与者名称下方显示该用户的自定义状态。
 */
export function CustomParticipantTile(props: React.ComponentProps<typeof ParticipantTile>) {

    // ✅ Corrected usage: Pass 'status' directly as a string
    const status = useParticipantAttribute('status');

    return (
        <ParticipantTile {...props}>
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
                <div className="flex items-center gap-2">
                    <ParticipantName />
                </div>

                {/* If status exists, display it */}
                {status && (
                    <p
                        className="text-xs text-white/80 truncate mt-1"
                        title={status}
                    >
                        {status}
                    </p>
                )}
            </div>
        </ParticipantTile>
    );
}