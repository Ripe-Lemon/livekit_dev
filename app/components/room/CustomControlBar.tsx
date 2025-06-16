'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
    useLocalParticipant, 
    useRoomContext
} from '@livekit/components-react';
import { Track as LiveKitTrack, Track } from 'livekit-client';
import { AudioManager } from '../../lib/audio/AudioManager';
import { useControlAudio } from '../../hooks/useControlAudio';

interface CustomControlBarProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => Promise<void>;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => Promise<void>;
    audioManager: AudioManager;
    onToggleChat?: () => void;
    onToggleParticipants?: () => void;
    onToggleSettings?: () => void;
    onToggleFullscreen?: () => void;
    onLeaveRoom?: () => void;
    isFullscreen?: boolean;
    chatUnreadCount?: number;
    showChat?: boolean;
    className?: string;
}

// 音频处理控件属性类型
interface AudioProcessingControlsProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => Promise<void>;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => Promise<void>;
}

// 音频处理控件组件
function AudioProcessingControls({
    isNoiseSuppressionEnabled,
    onToggleNoiseSuppression,
    isEchoCancellationEnabled,
    onToggleEchoCancellation,
}: AudioProcessingControlsProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleNoiseSuppressionToggle = async () => {
        setIsProcessing(true);
        try {
            await onToggleNoiseSuppression();
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEchoCancellationToggle = async () => {
        setIsProcessing(true);
        try {
            await onToggleEchoCancellation();
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* 降噪按钮 */}
            <button
                onClick={handleNoiseSuppressionToggle}
                disabled={isProcessing}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                    ${isNoiseSuppressionEnabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }
                `}
                title={`${isNoiseSuppressionEnabled ? '关闭' : '开启'}降噪`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isProcessing ? 'animate-spin' : ''}
                >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                    {isNoiseSuppressionEnabled && (
                        <path d="M17 3L7 21" strokeWidth="3" stroke="currentColor"/>
                    )}
                </svg>
                <span className="hidden sm:inline">降噪</span>
            </button>

            {/* 回声消除按钮 */}
            <button
                onClick={handleEchoCancellationToggle}
                disabled={isProcessing}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                    ${isEchoCancellationEnabled
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }
                `}
                title={`${isEchoCancellationEnabled ? '关闭' : '开启'}回声消除`}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={isProcessing ? 'animate-spin' : ''}
                >
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                    {isEchoCancellationEnabled && (
                        <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.3"/>
                    )}
                </svg>
                <span className="hidden sm:inline">回声消除</span>
            </button>
        </div>
    );
}

// 离开房间按钮组件
function CustomDisconnectButton() {
    const router = useRouter();
    const room = useRoomContext();
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeave = useCallback(async () => {
        if (isLeaving) return;

        const confirmed = window.confirm('确定要离开房间吗？');
        if (!confirmed) return;

        setIsLeaving(true);
        try {
            await room.disconnect();
            router.push('/');
        } catch (error) {
            console.error('离开房间失败:', error);
            setIsLeaving(false);
        }
    }, [room, router, isLeaving]);

    return (
        <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title="离开房间"
        >
            {isLeaving ? (
                <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            ) : (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            )}
            <span>{isLeaving ? '离开中...' : '离开房间'}</span>
        </button>
    );
}

// 音效控制按钮组件
function AudioEffectsButton({ audioManager }: { audioManager: AudioManager }) {
    const [isEnabled, setIsEnabled] = useState(audioManager.isAudioEnabled());

    const handleToggle = useCallback(() => {
        const newState = !isEnabled;
        audioManager.setEnabled(newState);
        setIsEnabled(newState);
    }, [audioManager, isEnabled]);

    return (
        <button
            onClick={handleToggle}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                transition-all duration-200
                ${isEnabled
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                }
            `}
            title={`${isEnabled ? '关闭' : '开启'}音效`}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {isEnabled ? (
                    <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </>
                ) : (
                    <>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        <line x1="23" y1="9" x2="17" y2="15"/>
                        <line x1="17" y1="9" x2="23" y2="15"/>
                    </>
                )}
            </svg>
            <span className="hidden sm:inline">音效</span>
        </button>
    );
}

// 主控制栏组件
export default function CustomControlBar({
    isNoiseSuppressionEnabled,
    onToggleNoiseSuppression,
    isEchoCancellationEnabled,
    onToggleEchoCancellation,
    audioManager,
}: CustomControlBarProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    const [isMuted, setIsMuted] = useState(!localParticipant.isMicrophoneEnabled);
    const [isCameraOff, setIsCameraOff] = useState(!localParticipant.isCameraEnabled);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingCamera, setIsTogglingCamera] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);

    // 添加控件音效
    const {
        playMuteSound,
        playUnmuteSound,
        playCameraOnSound,
        playCameraOffSound,
        playScreenShareStartSound,
        playScreenShareStopSound,
        playErrorSound
    } = useControlAudio({
        enabled: true,
        volume: 0.6
    });

    // 切换麦克风
    const toggleMicrophone = useCallback(async () => {
        if (!room) return;

        try {
            const audioTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            
            if (audioTrack) {
                if (audioTrack.isMuted) {
                    await audioTrack.unmute();
                    setIsMuted(false);
                    playUnmuteSound(); // 播放取消静音音效
                } else {
                    await audioTrack.mute();
                    setIsMuted(true);
                    playMuteSound(); // 播放静音音效
                }
            }
        } catch (error) {
            console.error('切换麦克风失败:', error);
            playErrorSound(); // 播放错误音效
        }
    }, [room, playMuteSound, playUnmuteSound, playErrorSound]);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (!room) return;

        try {
            const videoTrack = room.localParticipant.getTrackPublication(Track.Source.Camera);
            
            if (videoTrack) {
                if (videoTrack.isMuted) {
                    await videoTrack.unmute();
                    setIsCameraOff(false);
                    playCameraOnSound(); // 播放摄像头开启音效
                } else {
                    await videoTrack.mute();
                    setIsCameraOff(true);
                    playCameraOffSound(); // 播放摄像头关闭音效
                }
            } else {
                // 如果没有摄像头轨道，尝试启动摄像头
                await room.localParticipant.setCameraEnabled(true);
                setIsCameraOff(false);
                playCameraOnSound();
            }
        } catch (error) {
            console.error('切换摄像头失败:', error);
            playErrorSound(); // 播放错误音效
        }
    }, [room, playCameraOnSound, playCameraOffSound, playErrorSound]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!room) return;

        try {
            if (isScreenSharing) {
                await room.localParticipant.setScreenShareEnabled(false);
                setIsScreenSharing(false);
                playScreenShareStopSound(); // 播放屏幕共享结束音效
            } else {
                await room.localParticipant.setScreenShareEnabled(true);
                setIsScreenSharing(true);
                playScreenShareStartSound(); // 播放屏幕共享开始音效
            }
        } catch (error) {
            console.error('切换屏幕共享失败:', error);
            playErrorSound(); // 播放错误音效
            
            // 如果是权限问题，显示用户友好的错误信息
            if (error instanceof Error && error.name === 'NotAllowedError') {
                console.warn('用户拒绝了屏幕共享权限');
            }
        }
    }, [room, isScreenSharing, playScreenShareStartSound, playScreenShareStopSound, playErrorSound]);

    return (
        <div className="flex flex-wrap items-center justify-center gap-3">
            {/* 基础控制组 */}
            <div className="flex items-center gap-2">
                {/* 麦克风按钮 */}
                <button
                    onClick={toggleMicrophone}
                    disabled={isTogglingMic}
                    className={`
                        flex items-center justify-center w-12 h-12 rounded-full
                        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                        ${isMuted
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }
                    `}
                    title={isMuted ? '开启麦克风' : '关闭麦克风'}
                >
                    {isTogglingMic ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {isMuted ? (
                                <>
                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12L19 10v2a7 7 0 0 1-5.14 6.74"/>
                                    <path d="M12 1a3 3 0 0 0-3 3v4"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </>
                            ) : (
                                <>
                                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                    <line x1="12" y1="19" x2="12" y2="23"/>
                                    <line x1="8" y1="23" x2="16" y2="23"/>
                                </>
                            )}
                        </svg>
                    )}
                </button>

                {/* 摄像头按钮 */}
                <button
                    onClick={toggleCamera}
                    disabled={isTogglingCamera}
                    className={`
                        flex items-center justify-center w-12 h-12 rounded-full
                        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                        ${isCameraOff
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }
                    `}
                    title={isCameraOff ? '开启摄像头' : '关闭摄像头'}
                >
                    {isTogglingCamera ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {isCameraOff ? (
                                <>
                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                    <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>
                                    <path d="M9 3h6l2 2h2a2 2 0 0 1 2 2v9"/>
                                    <circle cx="12" cy="13" r="3"/>
                                </>
                            ) : (
                                <>
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                                    <circle cx="12" cy="13" r="4"/>
                                </>
                            )}
                        </svg>
                    )}
                </button>

                {/* 屏幕共享按钮 */}
                <button
                    onClick={toggleScreenShare}
                    disabled={isTogglingScreen}
                    className={`
                        flex items-center justify-center w-12 h-12 rounded-full
                        transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                        ${isScreenSharing
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }
                    `}
                    title={isScreenSharing ? '停止屏幕共享' : '开始屏幕共享'}
                >
                    {isTogglingScreen ? (
                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="2" y="4" width="20" height="12" rx="2"/>
                            <circle cx="8" cy="20" r="2"/>
                            <path d="M12 18l4 2h-8l4-2z"/>
                            {isScreenSharing && (
                                <path d="M7 10l5 5 5-5" strokeWidth="3"/>
                            )}
                        </svg>
                    )}
                </button>
            </div>

            {/* 分隔符 */}
            <div className="h-8 w-px bg-gray-600" />

            {/* 音频处理控制组 */}
            <AudioProcessingControls
                isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
                onToggleNoiseSuppression={onToggleNoiseSuppression}
                isEchoCancellationEnabled={isEchoCancellationEnabled}
                onToggleEchoCancellation={onToggleEchoCancellation}
            />

            {/* 分隔符 */}
            <div className="h-8 w-px bg-gray-600" />

            {/* 音效控制组 */}
            <AudioEffectsButton audioManager={audioManager} />

            {/* 分隔符 */}
            <div className="h-8 w-px bg-gray-600" />

            {/* 离开房间按钮 */}
            <CustomDisconnectButton />
        </div>
    );
}
