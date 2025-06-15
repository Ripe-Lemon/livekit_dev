// 文件路径: components/VolumeControl.tsx
'use client';

import { useMultibandTrackVolume } from '@livekit/components-react';
import { TrackReference } from '@livekit/components-core';
import React from 'react';

// 定义组件的 props 类型
interface VolumeControlProps {
    /** 要监控音量的音轨引用 */
    trackRef: TrackReference;
    /** 定义要显示多少个音量条 (频段数量) */
    bands?: number;
    /** 更新音量数据的频率 (毫秒) */
    updateInterval?: number;
}

/**
 * 一个实验性的音量控制组件，使用 useMultibandTrackVolume
 * 将单个音轨的音量可视化为多个频段的音量条。
 */
export function VolumeControl({
                                  trackRef,
                                  bands = 5, // 默认显示 5 个音量条
                                  updateInterval = 100, // 默认每 100ms 更新一次
                              }: VolumeControlProps) {

    // 使用 hook 来获取音量数据
    // volumes 是一个数字数组，每个数字代表一个频段的音量 (0 到 1 之间)
    const volumes = useMultibandTrackVolume(trackRef, {
        bands: bands,
        updateInterval: updateInterval,
        analyserOptions: {
            fftSize: 256, // FFT size, 必须是 2 的幂
            smoothingTimeConstant: 0.8, // 平滑系数，使动画更流畅
        },
    });

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '2px', // 音量条之间的间距
                height: '30px', // 组件总高度
                width: '100%',
            }}
            title={`多频段音量指示器 (实验性)`}
        >
            {/* 遍历 hook 返回的音量数组，为每个频段渲染一个音量条 */}
            {volumes.map((volume, i) => {
                // 将音量值 (0-1) 转换为高度百分比
                const barHeight = `${Math.max(2, volume * 100)}%`;
                // 将音量值转换为颜色 (从绿色到红色)
                const barColor = `hsl(${120 - volume * 120}, 100%, 50%)`;

                return (
                    <div
                        key={i}
                        style={{
                            width: `${100 / bands}%`,
                            height: barHeight,
                            backgroundColor: barColor,
                            borderRadius: '2px',
                            transition: 'height 0.1s ease-out, background-color 0.1s ease-out', // 添加平滑过渡效果
                            minHeight: '2px', // 保证即使音量为0，也有一个可见的小条
                        }}
                    />
                );
            })}
        </div>
    );
}