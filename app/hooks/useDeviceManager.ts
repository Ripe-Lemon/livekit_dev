'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
interface MediaDeviceInfo {
    deviceId: string;
    label: string;
    kind: MediaDeviceKind;
    groupId: string;
}

interface DeviceState {
    audioinput: MediaDeviceInfo[];
    audiooutput: MediaDeviceInfo[];
    videoinput: MediaDeviceInfo[];
}

interface SelectedDevices {
    audioinput?: string;
    audiooutput?: string;
    videoinput?: string;
}

interface DevicePermissions {
    audio: boolean;
    video: boolean;
}

interface DeviceManagerState {
    devices: DeviceState;
    selectedDevices: SelectedDevices;
    permissions: DevicePermissions;
    isLoading: boolean;
    error: string | null;
    isSupported: boolean;
    permissionRequested: {
        audio: boolean;
        video: boolean;
    };
}

interface UseDeviceManagerOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
    requestPermissions?: boolean;
    enableAudioOutput?: boolean;
    storageKey?: string;
}

interface DeviceTestResult {
    success: boolean;
    error?: string;
    metrics?: {
        audioLevel?: number;
        videoResolution?: { width: number; height: number };
        latency?: number;
    };
}

// 常量
const DEFAULT_STORAGE_KEY = 'livekit_selected_devices';
const DEFAULT_REFRESH_INTERVAL = 10000; // 增加到10秒
const DEVICE_CHANGE_DEBOUNCE = 300; // 减少到300ms

// 设备类型映射
const DEVICE_KIND_MAP: Record<MediaDeviceKind, keyof DeviceState> = {
    'audioinput': 'audioinput',
    'audiooutput': 'audiooutput',
    'videoinput': 'videoinput'
};

export function useDeviceManager(options: UseDeviceManagerOptions = {}) {
    const {
        autoRefresh = false, // 默认关闭自动刷新
        refreshInterval = DEFAULT_REFRESH_INTERVAL,
        requestPermissions: shouldRequestPermissions = false, // 默认不自动请求权限
        enableAudioOutput = false, // 默认关闭音频输出
        storageKey = DEFAULT_STORAGE_KEY
    } = options;

    // 状态管理
    const [state, setState] = useState<DeviceManagerState>({
        devices: {
            audioinput: [],
            audiooutput: [],
            videoinput: []
        },
        selectedDevices: {},
        permissions: {
            audio: false,
            video: false
        },
        isLoading: false,
        error: null,
        isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices,
        permissionRequested: {
            audio: false,
            video: false
        }
    });

    // Refs
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const permissionRequestRef = useRef<{
        audio?: Promise<boolean>;
        video?: Promise<boolean>;
    }>({});
    const isMountedRef = useRef(true);
    const lastRefreshRef = useRef<number>(0);

    // 检查浏览器支持
    const checkSupport = useCallback((): boolean => {
        if (typeof window === 'undefined') return false;
        
        return !!(
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.enumerateDevices === 'function' &&
            typeof navigator.mediaDevices.getUserMedia === 'function'
        );
    }, []);

    // 从本地存储加载选择的设备
    const loadSelectedDevices = useCallback((): SelectedDevices => {
        if (typeof window === 'undefined') return {};
        
        try {
            const stored = localStorage.getItem(storageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('加载设备选择失败:', error);
            return {};
        }
    }, [storageKey]);

    // 保存选择的设备到本地存储
    const saveSelectedDevices = useCallback((devices: SelectedDevices) => {
        if (typeof window === 'undefined') return;
        
        try {
            localStorage.setItem(storageKey, JSON.stringify(devices));
        } catch (error) {
            console.warn('保存设备选择失败:', error);
        }
    }, [storageKey]);

    // 请求单个类型的权限
    const requestSinglePermission = useCallback(async (type: 'audio' | 'video'): Promise<boolean> => {
        if (!state.isSupported) {
            console.warn(`浏览器不支持${type}权限请求`);
            return false;
        }

        // 避免重复请求
        if (permissionRequestRef.current[type]) {
            return await permissionRequestRef.current[type]!;
        }

        const requestPromise = (async (): Promise<boolean> => {
            try {
                console.log(`🎯 请求${type}权限...`);
                
                const constraints: MediaStreamConstraints = {};
                if (type === 'audio') {
                    constraints.audio = {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    };
                } else {
                    constraints.video = {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        frameRate: { ideal: 30 }
                    };
                }

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                // 立即停止流
                stream.getTracks().forEach(track => {
                    track.stop();
                    console.log(`✅ ${type}权限获取成功，轨道已停止`);
                });

                if (isMountedRef.current) {
                    setState(prev => ({
                        ...prev,
                        permissions: {
                            ...prev.permissions,
                            [type]: true
                        },
                        permissionRequested: {
                            ...prev.permissionRequested,
                            [type]: true
                        }
                    }));
                }

                return true;
            } catch (error) {
                console.warn(`❌ ${type}权限请求失败:`, error);
                
                if (isMountedRef.current) {
                    setState(prev => ({
                        ...prev,
                        permissions: {
                            ...prev.permissions,
                            [type]: false
                        },
                        permissionRequested: {
                            ...prev.permissionRequested,
                            [type]: true
                        }
                    }));
                }

                return false;
            }
        })();

        permissionRequestRef.current[type] = requestPromise;
        
        try {
            return await requestPromise;
        } finally {
            delete permissionRequestRef.current[type];
        }
    }, [state.isSupported]);

    // 请求媒体权限
    const requestPermissions = useCallback(async (types?: ('audio' | 'video')[]): Promise<DevicePermissions> => {
        const typesToRequest = types || ['audio', 'video'];
        const results: DevicePermissions = { audio: false, video: false };

        for (const type of typesToRequest) {
            results[type] = await requestSinglePermission(type);
        }

        return results;
    }, [requestSinglePermission]);

    // 枚举设备 - 移动到前面声明
    const enumerateDevices = useCallback(async (): Promise<DeviceState> => {
        if (!state.isSupported) {
            throw new Error('浏览器不支持设备枚举');
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            const deviceState: DeviceState = {
                audioinput: [],
                audiooutput: [],
                videoinput: []
            };

            devices.forEach(device => {
                // 确保设备有有效的标签，如果没有权限，标签可能为空
                let deviceLabel = device.label;
                if (!deviceLabel) {
                    // 如果没有标签，使用更友好的默认名称
                    switch (device.kind) {
                        case 'audioinput':
                            deviceLabel = `麦克风 ${device.deviceId.slice(0, 8)}`;
                            break;
                        case 'videoinput':
                            deviceLabel = `摄像头 ${device.deviceId.slice(0, 8)}`;
                            break;
                        case 'audiooutput':
                            deviceLabel = `扬声器 ${device.deviceId.slice(0, 8)}`;
                            break;
                        default:
                            deviceLabel = `设备 ${device.deviceId.slice(0, 8)}`;
                    }
                }

                const deviceInfo: MediaDeviceInfo = {
                    deviceId: device.deviceId,
                    label: deviceLabel,
                    kind: device.kind,
                    groupId: device.groupId
                };

                const category = DEVICE_KIND_MAP[device.kind];
                if (category) {
                    deviceState[category].push(deviceInfo);
                }
            });

            // 如果不支持音频输出设备选择，过滤掉
            if (!enableAudioOutput) {
                deviceState.audiooutput = [];
            }

            console.log('📱 设备枚举结果:', {
                audioinput: deviceState.audioinput.map(d => ({ id: d.deviceId.slice(0, 8), label: d.label })),
                videoinput: deviceState.videoinput.map(d => ({ id: d.deviceId.slice(0, 8), label: d.label })),
                audiooutput: deviceState.audiooutput.map(d => ({ id: d.deviceId.slice(0, 8), label: d.label }))
            });
            
            return deviceState;
        } catch (error) {
            console.error('设备枚举失败:', error);
            throw error;
        }
    }, [state.isSupported, enableAudioOutput]);

    // 刷新设备列表 - 现在可以使用 enumerateDevices
    const refreshDevices = useCallback(async (forcePermissionRequest = false): Promise<void> => {
        // 防止频繁刷新
        const now = Date.now();
        if (now - lastRefreshRef.current < 500) { // 减少到500ms防抖
            console.log('⏸️ 跳过频繁刷新');
            return;
        }
        lastRefreshRef.current = now;

        if (!state.isSupported) {
            setState(prev => ({ 
                ...prev, 
                error: '浏览器不支持媒体设备API' 
            }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // 如果强制请求权限，则请求权限
            if (forcePermissionRequest && shouldRequestPermissions) {
                await requestPermissions();
            }

            // 枚举设备
            const devices = await enumerateDevices();

            if (isMountedRef.current) {
                setState(prev => ({
                    ...prev,
                    devices,
                    isLoading: false,
                    error: null
                }));
                console.log('✅ 设备列表刷新成功，设备数量:', {
                    audio: devices.audioinput.length,
                    video: devices.videoinput.length,
                    audioOutput: devices.audiooutput.length
                });
            }
        } catch (error) {
            console.error('刷新设备失败:', error);
            
            if (isMountedRef.current) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: error instanceof Error ? error.message : '刷新设备失败'
                }));
            }
        }
    }, [state.isSupported, requestPermissions, enumerateDevices, shouldRequestPermissions]);

    // 选择设备
    const selectDevice = useCallback((
        deviceType: keyof SelectedDevices, 
        deviceId: string | null
    ): void => {
        console.log(`🔄 选择${deviceType}设备:`, deviceId);
        
        const newSelectedDevices = {
            ...state.selectedDevices,
            [deviceType]: deviceId || undefined
        };

        setState(prev => ({
            ...prev,
            selectedDevices: newSelectedDevices
        }));

        // 防抖保存
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            saveSelectedDevices(newSelectedDevices);
        }, DEVICE_CHANGE_DEBOUNCE);
    }, [state.selectedDevices, saveSelectedDevices]);

    // 获取选择的设备信息
    const getSelectedDeviceInfo = useCallback((
        deviceType: keyof SelectedDevices
    ): MediaDeviceInfo | null => {
        const deviceId = state.selectedDevices[deviceType];
        if (!deviceId) return null;

        const devices = state.devices[deviceType as keyof DeviceState];
        return devices.find(device => device.deviceId === deviceId) || null;
    }, [state.selectedDevices, state.devices]);

    // 测试设备
    const testDevice = useCallback(async (
        deviceType: 'audioinput' | 'videoinput',
        deviceId?: string
    ): Promise<DeviceTestResult> => {
        if (!state.isSupported) {
            return { success: false, error: '浏览器不支持媒体设备API' };
        }

        try {
            const constraints: MediaStreamConstraints = {};
            
            if (deviceType === 'audioinput') {
                constraints.audio = deviceId ? { deviceId: { exact: deviceId } } : true;
            } else {
                constraints.video = deviceId ? { deviceId: { exact: deviceId } } : true;
            }

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // 简单的设备测试
            const result: DeviceTestResult = { success: true, metrics: {} };

            if (deviceType === 'audioinput') {
                // 音频级别测试
                const audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                
                const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                result.metrics!.audioLevel = average / 255;

                audioContext.close();
            } else {
                // 视频分辨率测试
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    const settings = videoTrack.getSettings();
                    result.metrics!.videoResolution = {
                        width: settings.width || 0,
                        height: settings.height || 0
                    };
                }
            }

            // 清理流
            stream.getTracks().forEach(track => track.stop());

            return result;
        } catch (error) {
            console.error('设备测试失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '设备测试失败'
            };
        }
    }, [state.isSupported]);

    // 获取默认设备
    const getDefaultDevice = useCallback((
        deviceType: keyof DeviceState
    ): MediaDeviceInfo | null => {
        const devices = state.devices[deviceType];
        return devices.find(device => device.deviceId === 'default') || devices[0] || null;
    }, [state.devices]);

    // 检查设备是否可用
    const isDeviceAvailable = useCallback((
        deviceType: keyof SelectedDevices,
        deviceId: string
    ): boolean => {
        const devices = state.devices[deviceType as keyof DeviceState];
        return devices.some(device => device.deviceId === deviceId);
    }, [state.devices]);

    // 获取设备约束
    const getDeviceConstraints = useCallback((
        deviceType: 'audioinput' | 'videoinput'
    ): MediaTrackConstraints => {
        const deviceId = state.selectedDevices[deviceType];
        
        const baseConstraints: MediaTrackConstraints = {};
        
        if (deviceId && deviceId !== 'default') {
            baseConstraints.deviceId = { exact: deviceId };
        }

        // 添加设备特定的约束
        if (deviceType === 'audioinput') {
            return {
                ...baseConstraints,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            };
        } else {
            return {
                ...baseConstraints,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            };
        }
    }, [state.selectedDevices]);

    // 监听设备变化
    useEffect(() => {
        if (!state.isSupported) return;

        const handleDeviceChange = () => {
            console.log('🔄 检测到设备变化');
            
            // 防抖刷新
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            debounceTimeoutRef.current = setTimeout(() => {
                refreshDevices(false);
            }, DEVICE_CHANGE_DEBOUNCE);
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

        return () => {
            navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        };
    }, [state.isSupported, refreshDevices]);

    // 自动刷新
    useEffect(() => {
        if (!autoRefresh || !state.isSupported) return;

        const scheduleRefresh = () => {
            refreshTimeoutRef.current = setTimeout(() => {
                refreshDevices(false);
                scheduleRefresh();
            }, refreshInterval);
        };

        scheduleRefresh();

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [autoRefresh, refreshInterval, state.isSupported, refreshDevices]);

    // 初始化
    useEffect(() => {
        isMountedRef.current = true;

        // 检查支持性
        if (!checkSupport()) {
            setState(prev => ({
                ...prev,
                isSupported: false,
                error: '浏览器不支持媒体设备API'
            }));
            return;
        }

        // 加载保存的设备选择
        const savedDevices = loadSelectedDevices();
        setState(prev => ({
            ...prev,
            selectedDevices: savedDevices
        }));

        // 初始枚举设备（不请求权限）
        refreshDevices(false);

        return () => {
            isMountedRef.current = false;
            
            // 清理定时器
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [checkSupport, loadSelectedDevices, refreshDevices]);

    return {
        // 状态
        devices: state.devices,
        selectedDevices: state.selectedDevices,
        permissions: state.permissions,
        isLoading: state.isLoading,
        error: state.error,
        isSupported: state.isSupported,
        permissionRequested: state.permissionRequested,

        // 方法
        refreshDevices: () => refreshDevices(true),
        selectDevice,
        getSelectedDeviceInfo,
        testDevice,
        getDefaultDevice,
        isDeviceAvailable,
        getDeviceConstraints,
        requestPermissions,
        requestSinglePermission
    };
}

// 设备管理器单例类
export class DeviceManager {
    private static instance: DeviceManager;
    private listeners: Set<() => void> = new Set();

    static getInstance(): DeviceManager {
        if (!DeviceManager.instance) {
            DeviceManager.instance = new DeviceManager();
        }
        return DeviceManager.instance;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async switchToDevice(deviceType: 'audioinput' | 'videoinput', deviceId: string): Promise<void> {
        // 通知所有监听器设备切换
        this.listeners.forEach(listener => listener());
    }

    async getDeviceStream(
        deviceType: 'audioinput' | 'videoinput',
        deviceId?: string
    ): Promise<MediaStream> {
        const constraints: MediaStreamConstraints = {};
        
        if (deviceType === 'audioinput') {
            constraints.audio = deviceId ? { deviceId: { exact: deviceId } } : true;
        } else {
            constraints.video = deviceId ? { deviceId: { exact: deviceId } } : true;
        }

        return navigator.mediaDevices.getUserMedia(constraints);
    }
}

export default useDeviceManager;