// 文件路径: app/room/components/CustomParticipantTile.tsx (最终修正版)
'use client';

// 只需导入 useParticipantContext 和 ParticipantTile
import { ParticipantTile, useParticipantContext } from '@livekit/components-react';
import { VolumeControl } from './VolumeControl';

export function CustomParticipantTile() {
    // 1. 从上下文中获取完整的 participant 对象。这个对象本身就是响应式的。
    const participant = useParticipantContext();

    // 2. 直接从 participant 对象中安全地访问 attributes。
    //    不再需要 useParticipantInfo hook。
    const attributes = participant?.attributes || {};
    const activity = attributes.activity || '';
    const notes = attributes.notes || '';

    // 在上下文还未提供 participant 时，返回 null
    if (!participant) {
        return null;
    }

    return (
        <div className="relative group h-full w-full">
            <ParticipantTile />

            {(activity || notes) && (
                <div className="absolute top-2 left-2 z-10 max-w-[80%] rounded-lg bg-black/60 p-2 text-xs text-white backdrop-blur-sm">
                    {activity && <p><strong>状态:</strong> {activity}</p>}
                    {notes && <p><strong>备注:</strong> {notes}</p>}
                </div>
            )}

            {!participant.isLocal && <VolumeControl participant={participant} />}
        </div>
    );
}