'use client';

import React, { useRef } from 'react';
import {
    GridLayout,
    ParticipantTile,
    useTracks,
    RoomAudioRenderer,
    FocusLayoutContainer,
    CarouselLayout,
    FocusLayout,
    useGridLayout,
    usePinnedTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

interface VideoConferenceProps {
    className?: string;
    layout?: 'grid' | 'focus' | 'carousel';
    showParticipantNames?: boolean;
    maxParticipants?: number;
}

export default function VideoConference({
    className = '',
    layout = 'grid',
    showParticipantNames = true,
    maxParticipants = 25,
}: VideoConferenceProps) {
    // 获取所有视频和屏幕共享轨道
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    // 获取固定的轨道
    const pinnedTracks = usePinnedTracks();

    // 网格布局配置
    const gridElementRef = useRef<HTMLDivElement>(null!);
    const gridLayoutOptions = useGridLayout(gridElementRef, tracks.length);

    // 渲染参与者瓦片
    const renderParticipantTile = (trackRef: any, index: number) => {
        return (
            <ParticipantTile
                key={`${trackRef.participant.sid}_${trackRef.publication?.sid || 'camera'}`}
                trackRef={trackRef}
                onParticipantClick={() => {
                    // 可以添加点击参与者的逻辑，比如固定视频
                    console.log('Clicked participant:', trackRef.participant.name);
                }}
                className="relative"
                style={{
                    aspectRatio: '16/9',
                    minHeight: '200px',
                }}
            >
                {/* 自定义参与者信息覆盖层 */}
                {showParticipantNames && (
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        {/* 参与者名称 */}
                        <div className="bg-black/60 backdrop-blur-sm rounded px-2 py-1 text-white text-sm font-medium truncate max-w-[60%]">
                            {trackRef.participant.name || trackRef.participant.identity}
                        </div>
                        
                        {/* 音频/视频状态指示器 */}
                        <div className="flex items-center gap-1">
                            {/* 麦克风状态 */}
                            <div className={`
                                p-1 rounded-full
                                ${trackRef.participant.isMicrophoneEnabled 
                                    ? 'bg-green-500/80' 
                                    : 'bg-red-500/80'
                                }
                            `}>
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    {trackRef.participant.isMicrophoneEnabled ? (
                                        <>
                                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                            <line x1="12" y1="19" x2="12" y2="23"/>
                                            <line x1="8" y1="23" x2="16" y2="23"/>
                                        </>
                                    ) : (
                                        <>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                            <path d="M9 9v3a3 3 0 0 0 5.12 2.12L19 10v2a7 7 0 0 1-5.14 6.74"/>
                                            <path d="M12 1a3 3 0 0 0-3 3v4"/>
                                            <line x1="12" y1="19" x2="12" y2="23"/>
                                            <line x1="8" y1="23" x2="16" y2="23"/>
                                        </>
                                    )}
                                </svg>
                            </div>
                            
                            {/* 摄像头状态 */}
                            <div className={`
                                p-1 rounded-full
                                ${trackRef.participant.isCameraEnabled 
                                    ? 'bg-green-500/80' 
                                    : 'bg-red-500/80'
                                }
                            `}>
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    {trackRef.participant.isCameraEnabled ? (
                                        <>
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                            <circle cx="12" cy="13" r="4"/>
                                        </>
                                    ) : (
                                        <>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                            <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>
                                            <path d="M9 3h6l2 2h2a2 2 0 0 1 2 2v9"/>
                                            <circle cx="12" cy="13" r="3"/>
                                        </>
                                    )}
                                </svg>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* 说话状态指示器 */}
                {trackRef.participant.isSpeaking && (
                    <div className="absolute top-2 left-2 w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg" />
                )}
                
                {/* 连接质量指示器 */}
                <div className="absolute top-2 right-2">
                    <ConnectionQualityIndicator participant={trackRef.participant} />
                </div>
            </ParticipantTile>
        );
    };

    // 根据布局类型渲染不同的组件
    const renderLayout = () => {
        switch (layout) {
            case 'focus':
                return (
                    <FocusLayoutContainer>
                        <FocusLayout trackRef={tracks[0]} />
                    </FocusLayoutContainer>
                );
            
            case 'carousel':
                return (
                    <CarouselLayout tracks={tracks}>
                        {tracks.map((trackRef, index) => renderParticipantTile(trackRef, index))}
                    </CarouselLayout>
                );
            
            case 'grid':
                return (
                    <div ref={gridElementRef}>
                        <GridLayout 
                            tracks={tracks}
                            style={{ 
                                height: '100%',
                                width: '100%',
                            }}
                            className="grid-layout-container"
                        >
                            {tracks.map((trackRef, index) => renderParticipantTile(trackRef, index))}
                        </GridLayout>
                    </div>
                );
        }
    };

    // 如果没有参与者，显示等待界面
    if (tracks.length === 0) {
        return (
            <div className={`flex items-center justify-center h-full bg-gray-900 ${className}`}>
                <div className="text-center">
                    <div className="mb-4">
                        <svg
                            className="mx-auto h-16 w-16 text-gray-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1}
                                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-300 mb-2">
                        等待其他参与者加入
                    </h3>
                    <p className="text-sm text-gray-500">
                        房间已准备就绪，邀请其他人加入开始会议
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative w-full h-full bg-gray-900 overflow-hidden ${className}`}>
            {/* 主视频区域 */}
            <div className="w-full h-full">
                {renderLayout()}
            </div>
            
            {/* 参与者数量提示 */}
            {tracks.length > maxParticipants && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-600/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm">
                    显示前 {maxParticipants} 个参与者，共 {tracks.length} 人
                </div>
            )}
            
            {/* 音频渲染器 */}
            <RoomAudioRenderer />
        </div>
    );
}

// 连接质量指示器组件
function ConnectionQualityIndicator({ participant }: { participant: any }) {
    // 这里可以根据实际的连接质量数据来显示不同的图标
    // 目前使用简单的逻辑
    const getQuality = (): 'excellent' | 'good' | 'poor' => {
        // 可以从 participant 获取实际质量数据
        // 这里先返回一个默认值，实际应该根据 participant.connectionQuality 或类似属性来判断
        return 'good';
    };
    const quality = getQuality();

    const getQualityIcon = () => {
        switch (quality) {
            case 'excellent':
                return (
                    <div className="w-4 h-4 text-green-400" title="连接质量：优秀">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z"/>
                            <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z"/>
                        </svg>
                    </div>
                );
            case 'good':
                return (
                    <div className="w-4 h-4 text-yellow-400" title="连接质量：良好">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2L3 7v11a1 1 0 001 1h12a1 1 0 001-1V7l-7-5z"/>
                        </svg>
                    </div>
                );
            case 'poor':
                return (
                    <div className="w-4 h-4 text-red-400" title="连接质量：较差">
                        <svg fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="bg-black/60 backdrop-blur-sm rounded p-1">
            {getQualityIcon()}
        </div>
    );
}