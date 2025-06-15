// 文件路径: app/room/components/VolumeControl.tsx (已根据文档修正)
'use client';

import { Track } from 'livekit-client';
import {useParticipantTracks, useTracks} from '@livekit/components-react'; // 1. 导入稳定可靠的 useTracks hook
import type { Participant } from 'livekit-client';
import { useEffect, useState, useRef } from 'react';
import { FaVolumeUp, FaVolumeMute, FaVolumeDown } from 'react-icons/fa';

interface VolumeControlProps {
    participant: Participant; // 组件接收一个远程参与者对象
}

export function V({ participant }: { participant: Participant }) {
    // 正确用法：第一个参数是 participant 对象，第二个参数是选项
    const publications = useParticipantTracks(participant, {
        sources: [Track.Source.Microphone],}
    );

    // useTracks 返回的是 TrackPublication 数组，我们需要从 publication 中获取 track
    const publication = publications[0];
    const audioTrack = publication?.track; // 从 publication 中拿到实际的音轨 (Track)

    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const lastVolume = useRef(1); // 使用 ref 记录静音前的音量

    // 3. 使用 useEffect 来响应音轨和音量变化
    // 这是将 React 状态与 LiveKit SDK 命令连接起来的关键
    useEffect(() => {
        // 确保 audioTrack 存在后再进行操作
        // 文档核心API: track.setVolume()
        if (audioTrack) {
            audioTrack.setVolume(isMuted ? 0 : volume);
        }
    }, [audioTrack, volume, isMuted]); // 依赖项：当这些值变化时，effect会重新运行

    // 处理音量条变化
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

    // 切换静音状态
    const toggleMute = () => {
        setIsMuted((prevIsMuted) => {
            const newMutedState = !prevIsMuted;
            if (newMutedState) {
                // 如果将要静音，先记录当前音量
                lastVolume.current = volume;
                setVolume(0);
            } else {
                // 如果将要取消静音，恢复到之前的音量
                // 如果之前音量为0，则恢复到一个默认值（如0.5）
                setVolume(lastVolume.current > 0 ? lastVolume.current : 0.5);
            }
            return newMutedState;
        });
    };

    // 如果是本地参与者或没有音频轨道，则不渲染此组件
    if (participant.isLocal || !publication) {
        return null;
    }

    // 根据音量和静音状态决定显示的图标
    const VolumeIcon = isMuted ? FaVolumeMute : volume > 0.5 ? FaVolumeUp : FaVolumeDown;

    return (
        <div className="absolute bottom-10 left-2 right-2 z-10 flex items-center gap-2 rounded-full bg-black/50 p-1.5 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button onClick={toggleMute} className="text-white hover:text-blue-400 transition-colors">
                <VolumeIcon />
            </button>
            <input
                type="range"
                min="0"
                max="1" // 音量范围根据文档是在 0.0 到 1.0 之间
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
                style={{
                    // 使用 CSS 变量来设置背景渐变，更简洁
                    background: `linear-gradient(to right, #3b82f6 ${((isMuted ? 0 : volume) / 1) * 100}%, #4b5563 ${((isMuted ? 0 : volume) / 1) * 100}%)`
                }}
            />
        </div>
    );
}