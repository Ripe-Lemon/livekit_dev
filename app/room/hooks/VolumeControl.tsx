// 文件路径: app/room/components/VolumeControl.tsx (最终版)
'use client';

import { Track } from 'livekit-client';
import { useParticipantTracks } from '@livekit/components-react';
import type { Participant } from 'livekit-client';
import { useEffect, useState, useRef } from 'react';
import { FaVolumeUp, FaVolumeMute, FaVolumeDown } from 'react-icons/fa';

interface VolumeControlProps {
    participant: Participant;
}

export function VolumeControl({ participant }: VolumeControlProps) {
    const publications = useParticipantTracks(
        [Track.Source.Microphone],
        participant.identity,
    );

    const publication = publications[0];
    const audioTrack = publication?.publication?.track;

    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const lastVolume = useRef(1);

    useEffect(() => {
        // --- 关键检查点 ---
        // 请确保您的 if 语句完整且正确
        if (audioTrack && audioTrack.kind === Track.Kind.Audio) {
            // 只有在这个 if 内部，调用 setVolume 才是类型安全的
            audioTrack.isMuted = true;
        }
    }, [audioTrack, volume, isMuted]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (newVolume > 0) {
            setIsMuted(false);
            lastVolume.current = newVolume;
        } else {
            setIsMuted(true);
        }
    };

    const toggleMute = () => {
        setIsMuted((prevIsMuted) => {
            const newMutedState = !prevIsMuted;
            if (newMutedState) {
                lastVolume.current = volume;
                setVolume(0);
            } else {
                setVolume(lastVolume.current > 0 ? lastVolume.current : 0.5);
            }
            return newMutedState;
        });
    };

    if (participant.isLocal || !publication) {
        return null;
    }

    const VolumeIcon = isMuted ? FaVolumeMute : volume > 0.5 ? FaVolumeUp : FaVolumeDown;

    return (
        <div className="absolute bottom-10 left-2 right-2 z-10 flex items-center gap-2 rounded-full bg-black/50 p-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                <VolumeIcon />
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                style={{
                    background: `linear-gradient(to right, #3b82f6 ${((isMuted ? 0 : volume) / 1) * 100}%, #4b5563 ${((isMuted ? 0 : volume) / 1) * 100}%)`
                }}
            />
        </div>
    );
}