'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    useLocalParticipant, 
    useRoomContext
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useControlAudio } from '../../hooks/useControlAudio';
import { useDeviceManager } from '../../hooks/useDeviceManager';

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
    type,
    isLoading = false,
    error = null,
    hasPermission = true,
    onRequestPermission
}: {
    devices: any[];
    currentDeviceId?: string;
    onDeviceChange: (deviceId: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    type: 'microphone' | 'camera';
    isLoading?: boolean;
    error?: string | null;
    hasPermission?: boolean;
    onRequestPermission?: () => void;
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
                {isLoading ? (
                    <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full" />
                ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6,9 12,15 18,9" />
                    </svg>
                )}
            </button>
            
            {isOpen && (
                <div 
                    className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg min-w-48 z-[9999]"
                    style={{ zIndex: 9999 }}
                >
                    <div className="py-1 max-h-48 overflow-y-auto">
                        {!hasPermission ? (
                            <div className="px-3 py-2 text-sm text-yellow-400">
                                <div className="flex items-center gap-2 mb-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                        <line x1="12" y1="9" x2="12" y2="13"/>
                                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                                    </svg>
                                    需要{type === 'microphone' ? '麦克风' : '摄像头'}权限
                                </div>
                                {onRequestPermission && (
                                    <button 
                                        onClick={() => {
                                            onRequestPermission();
                                            onToggle();
                                        }}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
                                    >
                                        授权{type === 'microphone' ? '麦克风' : '摄像头'}
                                    </button>
                                )}
                            </div>
                        ) : error ? (
                            <div className="px-3 py-2 text-sm text-red-400">
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <line x1="15" y1="9" x2="9" y2="15"/>
                                        <line x1="9" y1="9" x2="15" y2="15"/>
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        ) : devices.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
                                        <line x1="9" y1="9" x2="9.01" y2="9"/>
                                        <line x1="15" y1="9" x2="15.01" y2="9"/>
                                    </svg>
                                    未找到{type === 'microphone' ? '麦克风' : '摄像头'}设备
                                </div>
                            </div>
                        ) : (
                            <>
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
                                        title={device.label}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="truncate flex-1">
                                                {device.label || `${type === 'microphone' ? '麦克风' : '摄像头'} ${device.deviceId.substring(0, 8)}`}
                                            </div>
                                            {currentDeviceId === device.deviceId && (
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20,6 9,17 4,12"/>
                                                </svg>
                                            )}
                                        </div>
                                        {currentDeviceId === device.deviceId && (
                                            <div className="text-xs text-blue-200 mt-1">当前选择</div>
                                        )}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// 控制按钮组件 - 更新以支持半透明效果
function ControlButton({ 
    onClick, 
    isActive, 
    isLoading, 
    icon, 
    title, 
    activeColor = 'bg-green-600/80 hover:bg-green-600',
    inactiveColor = 'bg-red-600/80 hover:bg-red-600',
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
                    text-white/90 hover:text-white
                    ${isActive 
                        ? `${activeColor}` 
                        : `${inactiveColor}`
                    }
                `}
                title={title}
            >
                {isLoading ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white/70 border-t-transparent rounded-full" />
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

// 离开房间按钮组件 - 移除确认对话框
function LeaveRoomButton({ onLeaveRoom }: { onLeaveRoom?: () => void }) {
    const router = useRouter();
    const room = useRoomContext();
    const [isLeaving, setIsLeaving] = useState(false);

    const handleLeave = useCallback(async () => {
        if (isLeaving) return;

        // 移除确认对话框，直接离开
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
    
    // 使用设备管理器
    const {
        devices,
        selectedDevices,
        permissions,
        isLoading: devicesLoading,
        error: devicesError,
        isSupported,
        refreshDevices,
        selectDevice,
        getSelectedDeviceInfo,
        requestSinglePermission,
        permissionRequested
    } = useDeviceManager({
        autoRefresh: false, // 关闭自动刷新
        requestPermissions: false, // 不自动请求权限
        enableAudioOutput: false,
        storageKey: 'livekit_controlbar_devices'
    });
    
    // 状态管理
    const [isMuted, setIsMuted] = useState(true);
    const [isCameraOff, setIsCameraOff] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [isTogglingMic, setIsTogglingMic] = useState(false);
    const [isTogglingCamera, setIsTogglingCamera] = useState(false);
    const [isTogglingScreen, setIsTogglingScreen] = useState(false);
    const [isControlsVisible, setIsControlsVisible] = useState(true);

    // 下拉菜单状态
    const [showAudioDevices, setShowAudioDevices] = useState(false);
    const [showVideoDevices, setShowVideoDevices] = useState(false);

    // 权限请求状态
    const [isRequestingAudioPermission, setIsRequestingAudioPermission] = useState(false);
    const [isRequestingVideoPermission, setIsRequestingVideoPermission] = useState(false);

    // 添加本地权限状态管理，用于实时检查权限
    const [localPermissions, setLocalPermissions] = useState({
        audio: false,
        video: false
    });

    // 🎯 修复：添加初始化状态控制
    const [isInitialized, setIsInitialized] = useState(false);
    const initializingRef = useRef(false);

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

    // 添加日志节流
    const lastLogTimeRef = useRef<{ [key: string]: number }>({});
    
    const throttleLog = useCallback((key: string, message: string, data?: any, interval = 5000) => {
        const now = Date.now();
        const lastLogTime = lastLogTimeRef.current[key] || 0;
        
        if (now - lastLogTime > interval) {
            if (data !== undefined) {
                console.log(message, data);
            } else {
                console.log(message);
            }
            lastLogTimeRef.current[key] = now;
        }
    }, []);

    // 实时检查权限状态 - 优化权限检查逻辑
    const checkPermissions = useCallback(async () => {
        try {
            const audioPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            const audioGranted = audioPermission.state === 'granted';
            
            const videoPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
            const videoGranted = videoPermission.state === 'granted';
            
            const prevPermissions = localPermissions;
            const newPermissions = {
                audio: audioGranted,
                video: videoGranted
            };
            
            // 只有在权限状态真正发生变化时才更新和刷新
            if (prevPermissions.audio !== audioGranted || prevPermissions.video !== videoGranted) {
                throttleLog('control-permission-change', '控制栏权限状态变化:', { 
                    audio: { prev: prevPermissions.audio, new: audioGranted },
                    video: { prev: prevPermissions.video, new: videoGranted }
                });
                
                setLocalPermissions(newPermissions);
                
                // 🎯 只有初始化完成后才刷新设备
                if (isInitialized) {
                    setTimeout(async () => {
                        try {
                            await refreshDevices();
                            throttleLog('control-device-refresh', '🔄 控制栏权限变化后设备列表已刷新');
                        } catch (error) {
                            console.warn('控制栏权限变化后刷新设备列表失败:', error);
                        }
                    }, 500);
                }
            } else {
                // 静默更新权限状态
                setLocalPermissions(newPermissions);
            }
        } catch (error) {
            // 如果 permissions API 不可用，回退到 useDeviceManager 的权限状态
            throttleLog('control-permission-fallback', '控制栏使用 useDeviceManager 权限状态:', permissions, 10000);
            setLocalPermissions({
                audio: permissions.audio,
                video: permissions.video
            });
        }
    }, [permissions, localPermissions, refreshDevices, throttleLog, isInitialized]);

    // 🎯 修复：统一的初始化函数
    const initializeControlBar = useCallback(async () => {
        if (initializingRef.current || isInitialized) {
            console.log('⏭️ 控制栏已初始化或正在初始化，跳过');
            return;
        }

        initializingRef.current = true;

        try {
            console.log('🚀 开始初始化控制栏...');

            // 1. 检查权限状态
            await checkPermissions();

            // 2. 确保选择默认麦克风
            const currentDevice = getSelectedDeviceInfo('audioinput');
            if (!currentDevice) {
                console.log('🎤 未选择音频设备，设置为默认设备');
                selectDevice('audioinput', 'default');
            }

            // 3. 刷新设备列表
            await refreshDevices();

            setIsInitialized(true);
            console.log('✅ 控制栏初始化完成');

        } catch (error) {
            console.warn('❌ 控制栏初始化失败:', error);
        } finally {
            initializingRef.current = false;
        }
    }, [checkPermissions, getSelectedDeviceInfo, selectDevice, refreshDevices, isInitialized]);

    // 🎯 修复：只在组件挂载时初始化一次
    useEffect(() => {
        // 延迟初始化，确保页面完全加载
        const timer = setTimeout(() => {
            initializeControlBar();
        }, 1000);

        return () => clearTimeout(timer);
    }, []); // 🎯 空依赖数组，只执行一次

    // 🎯 修复：减少权限检查频率，只有初始化完成后才检查
    useEffect(() => {
        if (!isInitialized) return;

        // 每10秒检查一次权限状态（减少频率）
        const interval = setInterval(checkPermissions, 10000);
        
        return () => clearInterval(interval);
    }, [checkPermissions, isInitialized]); // 🎯 添加 isInitialized 依赖

    // 同步设备状态
    useEffect(() => {
        if (localParticipant) {
            const micEnabled = localParticipant.isMicrophoneEnabled;
            const cameraEnabled = localParticipant.isCameraEnabled;
            const screenSharing = localParticipant.isScreenShareEnabled;
            
            setIsMuted(!micEnabled);
            setIsCameraOff(!cameraEnabled);
            setIsScreenSharing(screenSharing);
            
            // 🎯 减少日志频率
            throttleLog('device-state-sync', '设备状态同步:', { micEnabled, cameraEnabled, screenSharing }, 5000);
        }
    }, [localParticipant?.isMicrophoneEnabled, localParticipant?.isCameraEnabled, localParticipant?.isScreenShareEnabled, throttleLog]);

    // 修复麦克风切换逻辑 - 权限获取后刷新设备列表
    const toggleMicrophone = useCallback(async () => {
        if (!room || !localParticipant || isTogglingMic) return;

        setIsTogglingMic(true);
        try {
            const currentlyMuted = !localParticipant.isMicrophoneEnabled;
            
            if (currentlyMuted) {
                // 要开启麦克风，首先检查是否已有权限
                if (!localPermissions.audio) {
                    console.log('🎤 开启麦克风需要权限，正在请求麦克风权限...');
                    
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            audio: true,
                            video: false // 明确指定不要视频
                        });
                        
                        // 立即关闭流，我们只是为了获取权限
                        stream.getTracks().forEach(track => track.stop());
                        
                        console.log('✅ 麦克风权限已获取');
                        
                        // 权限获取后，立即更新权限状态
                        await checkPermissions();
                        
                        // 权限获取后，手动刷新设备列表以获取真实设备名称
                        setTimeout(async () => {
                            try {
                                await refreshDevices();
                                console.log('🔄 设备列表已刷新');
                            } catch (error) {
                                console.warn('刷新设备列表失败:', error);
                            }
                        }, 100);
                        
                    } catch (permissionError) {
                        console.warn('❌ 麦克风权限被拒绝:', permissionError);
                        setIsTogglingMic(false);
                        return;
                    }
                }
                
                // 开启麦克风
                await localParticipant.setMicrophoneEnabled(true);
                setIsMuted(false);
                playUnmuteSound();
                console.log('🔊 麦克风已开启');
            } else {
                // 关闭麦克风不需要权限
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
    }, [localParticipant, playMuteSound, playUnmuteSound, playErrorSound, isTogglingMic, room, localPermissions.audio, refreshDevices, checkPermissions]);

    // 修复摄像头切换逻辑 - 权限获取后刷新设备列表
    const toggleCamera = useCallback(async () => {
        if (!room || !localParticipant || isTogglingCamera) return;

        setIsTogglingCamera(true);
        try {
            const currentlyOff = !localParticipant.isCameraEnabled;
            
            if (currentlyOff) {
                // 要开启摄像头，首先检查是否已有权限
                if (!localPermissions.video) {
                    console.log('📹 开启摄像头需要权限，正在请求摄像头权限...');
                    
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ 
                            video: true,
                            audio: false // 明确指定不要音频
                        });
                        
                        // 立即关闭流，我们只是为了获取权限
                        stream.getTracks().forEach(track => track.stop());
                        
                        console.log('✅ 摄像头权限已获取');
                        
                        // 权限获取后，立即更新权限状态
                        await checkPermissions();
                        
                        // 权限获取后，手动刷新设备列表以获取真实设备名称
                        setTimeout(async () => {
                            try {
                                await refreshDevices();
                                console.log('🔄 设备列表已刷新');
                            } catch (error) {
                                console.warn('刷新设备列表失败:', error);
                            }
                        }, 100);
                        
                    } catch (permissionError) {
                        console.warn('❌ 摄像头权限被拒绝:', permissionError);
                        setIsTogglingCamera(false);
                        return;
                    }
                }
                
                // 开启摄像头
                await localParticipant.setCameraEnabled(true);
                setIsCameraOff(false);
                playCameraOnSound();
                console.log('📹 摄像头已开启');
            } else {
                // 关闭摄像头不需要权限
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
    }, [localParticipant, playCameraOnSound, playCameraOffSound, playErrorSound, isTogglingCamera, room, localPermissions.video, refreshDevices, checkPermissions]);

    // 更新权限请求处理函数 - 权限获取后刷新设备列表
    const handleRequestAudioPermission = useCallback(async () => {
        if (isRequestingAudioPermission) return;
        
        setIsRequestingAudioPermission(true);
        try {
            console.log('🎤 请求麦克风权限...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false // 明确指定不要视频
            });
            
            // 立即关闭流
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ 麦克风权限已获取');
            
            // 立即检查权限状态
            await checkPermissions();
            
            // 权限获取后，刷新设备列表以获取真实设备名称
            setTimeout(async () => {
                try {
                    await refreshDevices();
                    console.log('🔄 麦克风设备列表已刷新');
                } catch (error) {
                    console.warn('刷新麦克风设备列表失败:', error);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ 请求麦克风权限失败:', error);
        } finally {
            setIsRequestingAudioPermission(false);
        }
    }, [isRequestingAudioPermission, checkPermissions, refreshDevices]);

    const handleRequestVideoPermission = useCallback(async () => {
        if (isRequestingVideoPermission) return;
        
        setIsRequestingVideoPermission(true);
        try {
            console.log('📹 请求摄像头权限...');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true,
                audio: false // 明确指定不要音频
            });
            
            // 立即关闭流
            stream.getTracks().forEach(track => track.stop());
            
            console.log('✅ 摄像头权限已获取');
            
            // 立即检查权限状态
            await checkPermissions();
            
            // 权限获取后，刷新设备列表以获取真实设备名称
            setTimeout(async () => {
                try {
                    await refreshDevices();
                    console.log('🔄 摄像头设备列表已刷新');
                } catch (error) {
                    console.warn('刷新摄像头设备列表失败:', error);
                }
            }, 100);
            
        } catch (error) {
            console.error('❌ 请求摄像头权限失败:', error);
        } finally {
            setIsRequestingVideoPermission(false);
        }
    }, [isRequestingVideoPermission, checkPermissions, refreshDevices]);

    // 初始化时刷新设备列表
    useEffect(() => {
        // 页面加载时延迟刷新一次设备列表
        const initializeDevices = async () => {
            try {
                await refreshDevices();
                throttleLog('control-init-devices', '🚀 控制栏初始设备列表加载完成');
            } catch (error) {
                console.warn('控制栏初始设备列表加载失败:', error);
            }
        };
        
        // 延迟初始化
        setTimeout(initializeDevices, 1000);
    }, []);

    // 🎯 修复：初始化时确保选择默认麦克风
    useEffect(() => {
        const initializeDefaultDevices = async () => {
            try {
                // 检查当前选择的音频设备
                const currentDevice = getSelectedDeviceInfo('audioinput');
                
                if (!currentDevice) {
                    console.log('🎤 未选择音频设备，设置为默认设备');
                    selectDevice('audioinput', 'default');
                }
                
                // 刷新设备列表
                await refreshDevices();
                
                console.log('🚀 控制栏设备初始化完成');
            } catch (error) {
                console.warn('控制栏设备初始化失败:', error);
            }
        };
        
        // 延迟初始化，确保页面完全加载
        setTimeout(initializeDefaultDevices, 1000);
    }, [getSelectedDeviceInfo, selectDevice, refreshDevices]);

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

    // 切换屏幕共享
    const toggleScreenShare = useCallback(async () => {
        if (!room || !localParticipant || isTogglingScreen) return;

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
    }, [localParticipant, playScreenShareStartSound, playScreenShareStopSound, playErrorSound, isTogglingScreen, room]);

    // 切换音频设备
    const handleAudioDeviceChange = useCallback(async (deviceId: string) => {
        try {
            console.log('🎤 切换音频设备到:', deviceId);
            
            // 使用设备管理器选择设备
            selectDevice('audioinput', deviceId);
            
            // 如果有 LiveKit room，也通过 room 切换设备
            if (room && room.switchActiveDevice) {
                await room.switchActiveDevice('audioinput', deviceId);
            }
            
            console.log('✅ 音频设备切换成功');
        } catch (error) {
            console.error('❌ 切换音频设备失败:', error);
            playErrorSound();
        }
    }, [room, selectDevice, playErrorSound]);

    // 切换视频设备
    const handleVideoDeviceChange = useCallback(async (deviceId: string) => {
        try {
            console.log('📹 切换视频设备到:', deviceId);
            
            // 使用设备管理器选择设备
            selectDevice('videoinput', deviceId);
            
            // 如果有 LiveKit room，也通过 room 切换设备
            if (room && room.switchActiveDevice) {
                await room.switchActiveDevice('videoinput', deviceId);
            }
            
            console.log('✅ 视频设备切换成功');
        } catch (error) {
            console.error('❌ 切换视频设备失败:', error);
            playErrorSound();
        }
    }, [room, selectDevice, playErrorSound]);

    // 获取当前选择的设备信息
    const currentAudioDevice = getSelectedDeviceInfo('audioinput');
    const currentVideoDevice = getSelectedDeviceInfo('videoinput');

    // 使用本地权限状态而不是 useDeviceManager 的权限状态
    const hasAudioPermission = localPermissions.audio;
    const hasVideoPermission = localPermissions.video;

    // 确定加载状态 - 分别判断音频和视频的权限请求状态
    const audioLoading = isRequestingAudioPermission;
    const videoLoading = isRequestingVideoPermission;

    return (
        <div className={`
            fixed bottom-4 left-1/2 transform -translate-x-1/2
            flex items-center gap-2 px-4 py-3 
            bg-gray-800/50 backdrop-blur-sm rounded-xl
            border border-gray-600/30 shadow-lg
            transition-all duration-300 z-50
            hover:bg-gray-800/90 hover:border-gray-600/50
            group
            ${isFullscreen && !isControlsVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}
            ${className}
        `}>
            {/* 麦克风按钮 */}
            <ControlButton
                onClick={toggleMicrophone}
                isActive={!isMuted}
                isLoading={isTogglingMic || audioLoading}
                title={isMuted ? '开启麦克风' : '关闭麦克风'}
                activeColor="bg-green-600/80 hover:bg-green-600"
                inactiveColor="bg-red-600/80 hover:bg-red-600"
                hasDropdown={true}
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isMuted ? (
                            <g>
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                            </g>
                        ) : (
                            <g>
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
                            </g>
                        )}
                    </svg>
                }
            >
                <DeviceDropdown
                    devices={devices.audioinput || []}
                    currentDeviceId={currentAudioDevice?.deviceId}
                    onDeviceChange={handleAudioDeviceChange}
                    isOpen={showAudioDevices}
                    onToggle={() => setShowAudioDevices(!showAudioDevices)}
                    type="microphone"
                    isLoading={audioLoading}
                    error={devicesError}
                    hasPermission={hasAudioPermission}
                    onRequestPermission={handleRequestAudioPermission}
                />
            </ControlButton>

            {/* 摄像头按钮 */}
            <ControlButton
                onClick={toggleCamera}
                isActive={!isCameraOff}
                isLoading={isTogglingCamera || videoLoading}
                title={isCameraOff ? '开启摄像头' : '关闭摄像头'}
                activeColor="bg-green-600/80 hover:bg-green-600"
                inactiveColor="bg-red-600/80 hover:bg-red-600"
                hasDropdown={true}
                icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isCameraOff ? (
                            <g>
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" strokeLinecap="round" strokeLinejoin="round"/>
                                <circle cx="12" cy="13" r="3" strokeLinecap="round" strokeLinejoin="round"/>
                                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
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
                    devices={devices.videoinput || []}
                    currentDeviceId={currentVideoDevice?.deviceId}
                    onDeviceChange={handleVideoDeviceChange}
                    isOpen={showVideoDevices}
                    onToggle={() => setShowVideoDevices(!showVideoDevices)}
                    type="camera"
                    isLoading={videoLoading}
                    error={devicesError}
                    hasPermission={hasVideoPermission}
                    onRequestPermission={handleRequestVideoPermission}
                />
            </ControlButton>

            {/* 屏幕共享按钮 */}
            <ControlButton
                onClick={toggleScreenShare}
                isActive={isScreenSharing}
                isLoading={isTogglingScreen}
                title={isScreenSharing ? '停止屏幕共享' : '开始屏幕共享'}
                activeColor="bg-blue-600/80 hover:bg-blue-600"
                inactiveColor="bg-gray-700/80 hover:bg-gray-700"
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
            <div className="h-6 w-px bg-gray-600/30 group-hover:bg-gray-600/50 transition-colors duration-300" />

            {/* 聊天按钮 */}
            {onToggleChat && (
                <button
                    onClick={onToggleChat}
                    className={`
                        relative flex items-center justify-center w-12 h-10 rounded-lg
                        transition-all duration-200 text-white/90 hover:text-white
                        ${showChat 
                            ? 'bg-blue-600/80 hover:bg-blue-600' 
                            : 'bg-gray-700/80 hover:bg-gray-700'
                        }
                    `}
                    title="聊天"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {chatUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
                            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* 参与者按钮 */}
            {onToggleParticipants && (
                <button
                    onClick={onToggleParticipants}
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700/80 text-white/90 hover:bg-gray-700 hover:text-white transition-all duration-200"
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
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700/80 text-white/90 hover:bg-gray-700 hover:text-white transition-all duration-200"
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
                    className="flex items-center justify-center w-12 h-10 rounded-lg bg-gray-700/80 text-white/90 hover:bg-gray-700 hover:text-white transition-all duration-200"
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
            <div className="h-6 w-px bg-gray-600/30 group-hover:bg-gray-600/50 transition-colors duration-300" />

            {/* 离开房间按钮 */}
            <button
                onClick={onLeaveRoom ? () => {
                    if (onLeaveRoom) onLeaveRoom();
                } : undefined}
                className="flex items-center justify-center w-12 h-10 bg-red-600/80 text-white/90 hover:bg-red-600 hover:text-white rounded-lg transition-all duration-200"
                title="离开房间"
            >
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
            </button>
        </div>
    );
}

// 导出默认组件
export default ControlBar;