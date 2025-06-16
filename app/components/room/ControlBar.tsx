'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    useLocalParticipant, 
    useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useControlAudio } from '../../hooks/useControlAudio';

// 统一的 props 接口
interface ControlBarProps {
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

// 设备选择下拉菜单组件
function DeviceDropdown({ 
    devices, 
    currentDeviceId, 
    onDeviceChange, 
    isOpen, 
    onToggle,
    type 
}: {
    devices: MediaDeviceInfo[];
    currentDeviceId?: string;
    onDeviceChange: (deviceId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    type: 'microphone' | 'camera';
}) {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onToggle();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onToggle]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={onToggle}
                className="flex items-center justify-center w-4 h-4 text-white/70 hover:text-white transition-colors"
                title={`选择${type === 'microphone' ? '麦克风' : '摄像头'}设备`}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6,9 12,15 18,9" />
                </svg>
            </button>
            
            {isOpen && (
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg min-w-48 z-50">
                    <div className="py-1">
                        {devices.map((device) => (
                            <button
                                key={device.deviceId}
                                onClick={() => {
                                    onDeviceChange(device.deviceId);
                                    onToggle();
                                }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                                    currentDeviceId === device.deviceId 
                                        ? 'bg-blue-600 text-white' 
                                        : 'text-gray-200'
                                }`}
                            >
                                {device.label || `${type === 'microphone' ? '麦克风' : '摄像头'} ${device.deviceId.substring(0, 8)}`}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// 控制按钮组件
function ControlButton({ 
    onClick, 
    isActive, 
    isLoading, 
    icon, 
    title, 
    activeColor = 'bg-green-600',
    inactiveColor = 'bg-red-600',
    children,
    hasDropdown = false
}: {
    onClick: () => void;
    isActive: boolean;
    isLoading?: boolean;
    icon: React.ReactNode;
    title: string;
    activeColor?: string;
    inactiveColor?: string;
    children?: React.ReactNode;
    hasDropdown?: boolean;
}) {
    return (
        <div className="relative flex items-center">
            <button
                onClick={onClick}
                disabled={isLoading}
                className={`
                    flex items-center justify-center w-12 h-10 rounded-lg
                    transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                    text-white hover:opacity-90
                    ${isActive 
                        ? `${activeColor}` 
                        : `${inactiveColor}`
                    }
                `}
                title={title}
            >
                {isLoading ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                    icon
                )}
            </button>
            {hasDropdown && children && (
                <div className="ml-1">
                    {children}
                </div>
            )}
        </div>
    );
}

// 离开房间按钮组件
function LeaveRoomButton({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
    const router = useRouter();
    const room = useRoomContext();
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeave = useCallback(async () => {
        if (isLeaving) return;

        const confirmed = window.confirm('确定要离开房间吗？');
        if (!confirmed) return;

        setIsLeaving(true);
        try {
            if (onLeaveRoom) {
                onLeaveRoom();
            } else {
                await room.disconnect();
                router.push('/');
            }
        } catch (error) {
            console.error('离开房间失败:', error);
            setIsLeaving(false);
        }
    }, [room, router, isLeaving, onLeaveRoom]);

    return (
        <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex items-center justify-center w-12 h-10 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            title="离开房间"
        >
            {isLeaving ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
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
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            )}
        </button>
    );
}

// 主控制栏组件
export function ControlBar({
    onToggleChat,
    onToggleParticipants,
    onToggleSettings,
    onToggleFullscreen,
    onLeaveRoom,
    isFullscreen = false,
    chatUnreadCount = 0,
    showChat = false,
    className = ''
}: ControlBarProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    
    // 状态管理
    const [isMuted, setIsMuted] = useState(true); // 默认静音状态
    const [isCameraOff, setIsCameraOff] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingCamera, setIsTogglingCamera] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    // 设备相关状态
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [currentAudioDevice, setCurrentAudioDevice] = useState<string>('');
    const [currentVideoDevice, setCurrentVideoDevice] = useState<string>('');
    const [showAudioDevices, setShowAudioDevices] = useState(false);
    const [showVideoDevices, setShowVideoDevices] = useState(false);

    // 音效控制
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

    // 获取设备列表
    const getDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            const videoInputs = devices.filter(device => device.kind === 'videoinput');
            
            setAudioDevices(audioInputs);
            setVideoDevices(videoInputs);
        } catch (error) {
            console.error('获取设备列表失败:', error);
        }
    }, []);

    // 初始化设备列表
    useEffect(() => {
        getDevices();
        
        // 监听设备变化
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        
        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', getDevices);
        };
    }, [getDevices]);

    // 同步设备状态
    useEffect(() => {
        if (localParticipant) {
            const micEnabled = localParticipant.isMicrophoneEnabled;
            const cameraEnabled = localParticipant.isCameraEnabled;
            const screenSharing = localParticipant.isScreenShareEnabled;
            
            setIsMuted(!micEnabled);
            setIsCameraOff(!cameraEnabled);
            setIsScreenSharing(screenSharing);
            
            console.log('设备状态同步:', { micEnabled, cameraEnabled, screenSharing });
        }
    }, [localParticipant, localParticipant?.isMicrophoneEnabled, localParticipant?.isCameraEnabled, localParticipant?.isScreenShareEnabled]);

    // 自动隐藏控制栏（全屏模式）
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        
        const showControls = () => {
            setIsControlsVisible(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                setIsControlsVisible(false);
            }, 3000);
        };

        const handleMouseMove = () => showControls();

        if (isFullscreen) {
            document.addEventListener('mousemove', handleMouseMove);
            showControls();
        } else {
            setIsControlsVisible(true);
        }

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousemove', handleMouseMove);
        };
    }, [isFullscreen]);

    // 切换麦克风
    const toggleMicrophone = useCallback(async () => {
        if (!room || isTogglingMic) return;

        setIsTogglingMic(true);
        try {
            const currentlyMuted = !localParticipant.isMicrophoneEnabled;
            
            if (currentlyMuted) {
                await localParticipant.setMicrophoneEnabled(true);
                setIsMuted(false);
                playUnmuteSound();
                console.log('🔊 麦克风已开启');
            } else {
                await localParticipant.setMicrophoneEnabled(false);
                setIsMuted(true);
                playMuteSound();
                console.log('🔇 麦克风已关闭');
            }
        } catch (error) {
            console.error('切换麦克风失败:', error);
            playErrorSound();
        } finally {
            setIsTogglingMic(false);
        }
    }, [localParticipant, playMuteSound, playUnmuteSound, playErrorSound, isTogglingMic]);

    // 切换摄像头
    const toggleCamera = useCallback(async () => {
        if (!room || isTogglingCamera) return;

        setIsTogglingCamera(true);
        try {
            const currentlyOff = !localParticipant.isCameraEnabled;
            
            if (currentlyOff) {
                await localParticipant.setCameraEnabled(true);
                setIsCameraOff(false);
                playCameraOnSound();
                console.log('📹 摄像头已开启');
            } else {
                await localParticipant.setCameraEnabled(false);
                setIsCameraOff(true);
                playCameraOffSound();
                console.log('📹❌ 摄像头已关闭');
            }
        } catch (error) {
            console.error('切换摄像头失败:', error);
            playErrorSound();
        } finally {
            setIsTogglingCamera(false);
        }
    }, [localParticipant, playCameraOnSound, playCameraOffSound, playErrorSound, isTogglingCamera]);

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!room || isTogglingScreen) return;

        setIsTogglingScreen(true);
        try {
            const currentlySharing = localParticipant.isScreenShareEnabled;
            
            if (currentlySharing) {
                await localParticipant.setScreenShareEnabled(false);
                setIsScreenSharing(false);
                playScreenShareStopSound();
                console.log('🖥️❌ 屏幕共享已停止');
            } else {
                await localParticipant.setScreenShareEnabled(true);
                setIsScreenSharing(true);
                playScreenShareStartSound();
                console.log('🖥️ 屏幕共享已开始');
            }
        } catch (error) {
            console.error('切换屏幕共享失败:', error);
            playErrorSound();
            
            if (error instanceof Error && error.name === 'NotAllowedError') {
                alert('屏幕共享权限被拒绝，请在浏览器中允许屏幕共享权限。');
            }
        } finally {
            setIsTogglingScreen(false);
        }
    }, [localParticipant, playScreenShareStartSound, playScreenShareStopSound, playErrorSound, isTogglingScreen]);

    // 切换音频设备
    const handleAudioDeviceChange = useCallback(async (deviceId: string) => {
        try {
            await room.switchActiveDevice('audioinput', deviceId);
            setCurrentAudioDevice(deviceId);
            console.log('音频设备已切换:', deviceId);
        } catch (error) {
            console.error('切换音频设备失败:', error);
            playErrorSound();
        }
    }, [room, playErrorSound]);

    // 切换视频设备
    const handleVideoDeviceChange = useCallback(async (deviceId: string) => {
        try {
            await room.switchActiveDevice('videoinput', deviceId);
            setCurrentVideoDevice(deviceId);
            console.log('视频设备已切换:', deviceId);
        } catch (error) {
            console.error('切换视频设备失败:', error);
            playErrorSound();
        }
    }, [room, playErrorSound]);

    return (
        <div className={`
            fixed bottom-4 left-1/2 transform -translate-x-1/2
            flex items-center gap-2 px-4 py-3 
            bg-gray-800/90 backdrop-blur-sm rounded-xl
            border border-gray-600/50 shadow-lg
            transition-all duration-300
            ${isFullscreen && !isControlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            ${className}
        `}>
            {/* 麦克风按钮 */}
            <ControlButton
                onClick={toggleMicrophone}
                isActive={!isMuted}
                isLoading={isTogglingMic}
                title={isMuted ? '开启麦克风' : '关闭麦克风'}
                activeColor="bg-green-600"
                inactiveColor="bg-red-600"
                hasDropdown={true}
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isMuted ? (
                            <g>
                                <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9 9v3a3 3 0 0 0 5.12 2.12" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 1a3 3 0 0 0-3 3v3" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 10v2a7 7 0 0 1-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M5 10v2a7 7 0 0 0 7 7" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                            </g>
                        ) : (
                            <g>
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                            </g>
                        )}
                    </svg>
                }
            >
                <DeviceDropdown
                    devices={audioDevices}
                    currentDeviceId={currentAudioDevice}
                    onDeviceChange={handleAudioDeviceChange}
                    isOpen={showAudioDevices}
                    onToggle={() => setShowAudioDevices(!showAudioDevices)}
                    type="microphone"
                />
            </ControlButton>

            {/* 摄像头按钮 */}
            <ControlButton
                onClick={toggleCamera}
                isActive={!isCameraOff}
                isLoading={isTogglingCamera}
                title={isCameraOff ? '开启摄像头' : '关闭摄像头'}
                activeColor="bg-green-600"
                inactiveColor="bg-red-600"
                hasDropdown={true}
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isCameraOff ? (
                            <g>
                                <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M7 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9.5 4h5L17 7h3a2 2 0 0 1 2 2v8" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M14.121 15.121A3 3 0 1 1 8.88 9.88" strokeLinecap="round" strokeLinejoin="round"/>
                            </g>
                        ) : (
                            <g>
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </g>
                        )}
                    </svg>
                }
            >
                <DeviceDropdown
                    devices={videoDevices}
                    currentDeviceId={currentVideoDevice}
                    onDeviceChange={handleVideoDeviceChange}
                    isOpen={showVideoDevices}
                    onToggle={() => setShowVideoDevices(!showVideoDevices)}
                    type="camera"
                />
            </ControlButton>

            {/* 屏幕共享按钮 */}
            <ControlButton
                onClick={toggleScreenShare}
                isActive={isScreenSharing}
                isLoading={isTogglingScreen}
                title={isScreenSharing ? '停止屏幕共享' : '开始屏幕共享'}
                activeColor="bg-blue-600"
                inactiveColor="bg-gray-700"
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round"/>
                        <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round"/>
                        {isScreenSharing && (
                            <g>
                                <circle cx="12" cy="10" r="3" fill="currentColor"/>
                                <path d="M8 10l4 4 4-4" strokeWidth="1" fill="none"/>
                            </g>
                        )}
                    </svg>
                }
            />

            {/* 分隔线 */}
            <div className="h-6 w-px bg-gray-600/50" />

            {/* 聊天按钮 */}
            {onToggleChat && (
                <button
                    onClick={onToggleChat}
                    className={`
                        relative flex items-center justify-center w-12 h-10 rounded-lg
                        transition-all duration-200 text-white
                        ${showChat 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-gray-700 hover:bg-gray-600'
                        }
                    `}
                    title="聊天"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {chatUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* 参与者按钮 */}
            {onToggleParticipants && (
                <button
                    onClick={onToggleParticipants}
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title="参与者"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                </button>
            )}

            {/* 设置按钮 */}
            {onToggleSettings && (
                <button
                    onClick={onToggleSettings}
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title="设置"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.04a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                </button>
            )}

            {/* 全屏按钮 */}
            {onToggleFullscreen && (
                <button
                    onClick={onToggleFullscreen}
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
                    title={isFullscreen ? '退出全屏' : '进入全屏'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isFullscreen ? (
                            <>
                                <path d="M8 3v3a2 2 0 0 1-2 2H3"/>
                                <path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                                <path d="M3 16h3a2 2 0 0 1 2 2v3"/>
                                <path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                            </>
                        ) : (
                            <>
                                <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
                                <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                                <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
                                <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                            </>
                        )}
                    </svg>
                </button>
            )}

            {/* 分隔线 */}
            <div className="h-6 w-px bg-gray-600/50" />

            {/* 离开房间按钮 */}
            <LeaveRoomButton onLeaveRoom={onLeaveRoom} />
        </div>
    );
}

// 导出默认组件
export default ControlBar;