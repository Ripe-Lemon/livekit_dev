'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track } from 'livekit-client';

// Components
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

// Hooks
import { useAudioManager } from '../../hooks/useAudioManager';
import { useDeviceManager } from '../../hooks/useDeviceManager';

// Types
import { AudioDeviceInfo, AudioProcessingOptions, AudioEffects } from '../../types/audio';
import { ChatSettings } from '../../types/chat';

// Constants
import { AUDIO_QUALITY_PRESETS, AUDIO_EFFECT_PRESETS } from '../../constants/audio';
import { DEFAULT_CHAT_SETTINGS } from '../../constants/chat';

interface SettingsPanelProps {
    onClose: () => void;
    className?: string;
}

interface MediaSettings {
    videoEnabled: boolean;
    audioEnabled: boolean;
    screenShareEnabled: boolean;
    videoQuality: 'low' | 'medium' | 'high';
    audioQuality: 'low' | 'medium' | 'high' | 'ultra';
}

interface NotificationSettings {
    soundEnabled: boolean;
    desktopNotifications: boolean;
    messageNotifications: boolean;
    userJoinLeave: boolean;
}

type SettingsTab = 'media' | 'audio' | 'chat' | 'notifications' | 'advanced';

export function SettingsPanel({ onClose, className = '' }: SettingsPanelProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const audioManager = useAudioManager();
    const { 
        devices, 
        selectedDevices, 
        selectDevice, 
        refreshDevices,
        isLoading: devicesLoading 
    } = useDeviceManager();

    // 状态管理
    const [activeTab, setActiveTab] = useState<SettingsTab>('media');
    const [isLoading, setIsLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // 设置状态
    const [mediaSettings, setMediaSettings] = useState<MediaSettings>({
        videoEnabled: true,
        audioEnabled: true,
        screenShareEnabled: true,
        videoQuality: 'medium',
        audioQuality: 'medium'
    });

    const [audioProcessing, setAudioProcessing] = useState<AudioProcessingOptions>({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
        latency: 0.01
    });

    const [audioEffects, setAudioEffects] = useState<AudioEffects>(AUDIO_EFFECT_PRESETS.voice);
    const [chatSettings, setChatSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
        soundEnabled: true,
        desktopNotifications: true,
        messageNotifications: true,
        userJoinLeave: true
    });

    // 从本地存储加载设置
    useEffect(() => {
        try {
            const savedChatSettings = localStorage.getItem('chatSettings');
            if (savedChatSettings) {
                setChatSettings(JSON.parse(savedChatSettings));
            }

            const savedNotificationSettings = localStorage.getItem('notificationSettings');
            if (savedNotificationSettings) {
                setNotificationSettings(JSON.parse(savedNotificationSettings));
            }

            const savedAudioProcessing = localStorage.getItem('audioProcessing');
            if (savedAudioProcessing) {
                setAudioProcessing(JSON.parse(savedAudioProcessing));
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }, []);

    // 保存设置到本地存储
    const saveSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            localStorage.setItem('chatSettings', JSON.stringify(chatSettings));
            localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
            localStorage.setItem('audioProcessing', JSON.stringify(audioProcessing));
            
            // TODO: Apply audio settings when updateAudioConfig is available
            // await updateAudioConfig({
            //     processing: audioProcessing,
            //     effects: audioEffects
            // });

            setHasChanges(false);
        } catch (error) {
            console.error('保存设置失败:', error);
        } finally {
            setIsLoading(false);
        }
    }, [chatSettings, notificationSettings, audioProcessing, audioEffects]);

    // 重置设置
    const resetSettings = useCallback(() => {
        setChatSettings(DEFAULT_CHAT_SETTINGS);
        setNotificationSettings({
            soundEnabled: true,
            desktopNotifications: true,
            messageNotifications: true,
            userJoinLeave: true
        });
        setAudioProcessing({
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1,
            latency: 0.01
        });
        setAudioEffects(AUDIO_EFFECT_PRESETS.voice);
        setHasChanges(true);
    }, []);

    // 测试音频
    const handleTestAudio = useCallback(async () => {
        try {
            // TODO: Implement audio test functionality when available
            console.log('Audio test functionality not yet implemented');
        } catch (error) {
            console.error('音频测试失败:', error);
        }
    }, []);

    // 切换媒体设备
    const toggleMedia = useCallback(async (type: 'camera' | 'microphone') => {
        try {
            if (type === 'camera') {
                const videoTrackPub = localParticipant?.getTrackPublication(Track.Source.Camera);
                if (videoTrackPub?.isEnabled) {
                    await localParticipant?.setCameraEnabled(false);
                } else {
                    await localParticipant?.setCameraEnabled(true);
                }
            } else {
                const audioTrackPub = localParticipant?.getTrackPublication(Track.Source.Microphone);
                if (audioTrackPub?.isEnabled) {
                    await localParticipant?.setMicrophoneEnabled(false);
                } else {
                    await localParticipant?.setMicrophoneEnabled(true);
                }
            }
        } catch (error) {
            console.error(`切换${type}失败:`, error);
        }
    }, [localParticipant]);

    // 渲染标签页导航
    const renderTabNav = () => {
        const tabs: Array<{ id: SettingsTab; label: string; icon: string }> = [
            { id: 'media', label: '媒体设备', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { id: 'audio', label: '音频处理', icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3' },
            { id: 'chat', label: '聊天设置', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
            { id: 'notifications', label: '通知', icon: 'M15 17h5l-5 5v-5zM10.75 4.75L13.5 7.5m-2.75-2.75L8 7.5m2.75-2.75v-1m0 11.5v1m-2.75-2.75L13.5 16.5m-2.75-2.75L8 16.5' },
            { id: 'advanced', label: '高级', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
        ];

        return (
            <div className="flex border-b border-gray-700">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700/50'
                                : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                        </svg>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>
        );
    };

    // 渲染媒体设备标签页
    const renderMediaTab = () => (
        <div className="space-y-6">
            {/* 摄像头设置 */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3">摄像头</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-300">启用摄像头</span>
                        <button
                            onClick={() => toggleMedia('camera')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                localParticipant?.getTrackPublication(Track.Source.Camera)?.isEnabled
                                    ? 'bg-blue-600'
                                    : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                    localParticipant?.getTrackPublication(Track.Source.Camera)?.isEnabled
                                        ? 'translate-x-6'
                                        : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">摄像头设备</label>
                        <select
                            value={selectedDevices.videoinput || ''}
                            onChange={(e) => selectDevice('videoinput', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            disabled={devicesLoading}
                        >
                            <option value="">默认摄像头</option>
                            {devices.videoinput.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `摄像头 ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 麦克风设置 */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3">麦克风</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-300">启用麦克风</span>
                        <button
                            onClick={() => toggleMedia('microphone')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                localParticipant?.getTrackPublication(Track.Source.Microphone)?.isEnabled
                                    ? 'bg-blue-600'
                                    : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                    localParticipant?.getTrackPublication(Track.Source.Microphone)?.isEnabled
                                        ? 'translate-x-6'
                                        : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                    
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">麦克风设备</label>
                        <select
                            value={selectedDevices.audioinput || ''}
                            onChange={(e) => selectDevice('audioinput', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            disabled={devicesLoading}
                        >
                            <option value="">默认麦克风</option>
                            {devices.audioinput.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `麦克风 ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 扬声器设置 */}
            <div>
                <h3 className="text-lg font-medium text-white mb-3">扬声器</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">扬声器设备</label>
                        <select
                            value={selectedDevices.audiooutput || ''}
                            onChange={(e) => selectDevice('audiooutput', e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            disabled={devicesLoading}
                        >
                            <option value="">默认扬声器</option>
                            {devices.audiooutput.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label || `扬声器 ${device.deviceId.slice(0, 8)}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <Button
                        onClick={handleTestAudio}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        测试音频
                    </Button>
                </div>
            </div>

            <Button
                onClick={refreshDevices}
                variant="outline"
                size="sm"
                disabled={devicesLoading}
                className="w-full"
            >
                {devicesLoading ? (
                    <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        刷新设备列表
                    </>
                ) : (
                    '刷新设备列表'
                )}
            </Button>
        </div>
    );

    // 渲染音频处理标签页
    const renderAudioTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-white mb-3">音频处理</h3>
                <div className="space-y-3">
                    {[
                        { key: 'echoCancellation', label: '回声消除' },
                        { key: 'noiseSuppression', label: '噪声抑制' },
                        { key: 'autoGainControl', label: '自动增益控制' }
                    ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-300">{label}</span>
                            <button
                                onClick={() => {
                                    setAudioProcessing(prev => ({
                                        ...prev,
                                        [key]: !prev[key as keyof AudioProcessingOptions]
                                    }));
                                    setHasChanges(true);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    audioProcessing[key as keyof AudioProcessingOptions]
                                        ? 'bg-blue-600'
                                        : 'bg-gray-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                        audioProcessing[key as keyof AudioProcessingOptions]
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h3 className="text-lg font-medium text-white mb-3">音质预设</h3>
                <select
                    value={mediaSettings.audioQuality}
                    onChange={(e) => {
                        setMediaSettings(prev => ({
                            ...prev,
                            audioQuality: e.target.value as any
                        }));
                        setHasChanges(true);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                    <option value="low">低质量 (32kbps)</option>
                    <option value="medium">中等质量 (64kbps)</option>
                    <option value="high">高质量 (128kbps)</option>
                    <option value="ultra">超高质量 (256kbps)</option>
                </select>
            </div>

            <div>
                <h3 className="text-lg font-medium text-white mb-3">音频效果</h3>
                <select
                    value={Object.keys(AUDIO_EFFECT_PRESETS).find(
                        key => JSON.stringify(AUDIO_EFFECT_PRESETS[key as keyof typeof AUDIO_EFFECT_PRESETS]) === JSON.stringify(audioEffects)
                    ) || 'voice'}
                    onChange={(e) => {
                        setAudioEffects(AUDIO_EFFECT_PRESETS[e.target.value as keyof typeof AUDIO_EFFECT_PRESETS]);
                        setHasChanges(true);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                >
                    <option value="none">无效果</option>
                    <option value="voice">语音优化</option>
                    <option value="music">音乐模式</option>
                    <option value="broadcast">广播模式</option>
                </select>
            </div>
        </div>
    );

    // 渲染聊天设置标签页
    const renderChatTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-white mb-3">聊天行为</h3>
                <div className="space-y-3">
                    {[
                        { key: 'enableSounds', label: '启用聊天音效' },
                        { key: 'autoScroll', label: '自动滚动到底部' },
                        { key: 'showTimestamps', label: '显示时间戳' },
                        { key: 'compressImages', label: '压缩图片' }
                    ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-300">{label}</span>
                            <button
                                onClick={() => {
                                    setChatSettings(prev => ({
                                        ...prev,
                                        [key]: !prev[key as keyof ChatSettings]
                                    }));
                                    setHasChanges(true);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    chatSettings[key as keyof ChatSettings]
                                        ? 'bg-blue-600'
                                        : 'bg-gray-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                        chatSettings[key as keyof ChatSettings]
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    最大消息数量
                </label>
                <input
                    type="number"
                    min="50"
                    max="1000"
                    value={chatSettings.maxMessages}
                    onChange={(e) => {
                        setChatSettings(prev => ({
                            ...prev,
                            maxMessages: parseInt(e.target.value) || 100
                        }));
                        setHasChanges(true);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    最大图片大小 (MB)
                </label>
                <input
                    type="number"
                    min="1"
                    max="50"
                    value={chatSettings.maxImageSize}
                    onChange={(e) => {
                        setChatSettings(prev => ({
                            ...prev,
                            maxImageSize: parseInt(e.target.value) || 10
                        }));
                        setHasChanges(true);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
            </div>
        </div>
    );

    // 渲染通知设置标签页
    const renderNotificationsTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-white mb-3">通知设置</h3>
                <div className="space-y-3">
                    {[
                        { key: 'soundEnabled', label: '启用音效' },
                        { key: 'desktopNotifications', label: '桌面通知' },
                        { key: 'messageNotifications', label: '消息通知' },
                        { key: 'userJoinLeave', label: '用户进出提醒' }
                    ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-300">{label}</span>
                            <button
                                onClick={() => {
                                    setNotificationSettings(prev => ({
                                        ...prev,
                                        [key]: !prev[key as keyof NotificationSettings]
                                    }));
                                    setHasChanges(true);
                                }}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    notificationSettings[key as keyof NotificationSettings]
                                        ? 'bg-blue-600'
                                        : 'bg-gray-600'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                        notificationSettings[key as keyof NotificationSettings]
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    // 渲染高级设置标签页
    const renderAdvancedTab = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-white mb-3">高级设置</h3>
                <div className="space-y-3">
                    <Button
                        onClick={resetSettings}
                        variant="outline"
                        size="sm"
                        className="w-full"
                    >
                        重置所有设置
                    </Button>
                    
                    <div className="p-3 bg-gray-700 rounded-lg">
                        <h4 className="text-sm font-medium text-white mb-2">房间信息</h4>
                        <div className="text-xs text-gray-300 space-y-1">
                            <div>房间名: {room?.name}</div>
                            <div>参与者数: {room?.numParticipants}</div>
                            <div>连接状态: {room?.state}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 渲染标签页内容
    const renderTabContent = () => {
        switch (activeTab) {
            case 'media':
                return renderMediaTab();
            case 'audio':
                return renderAudioTab();
            case 'chat':
                return renderChatTab();
            case 'notifications':
                return renderNotificationsTab();
            case 'advanced':
                return renderAdvancedTab();
            default:
                return null;
        }
    };

    return (
        <div className={`flex flex-col h-full bg-gray-800 ${className}`}>
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">设置</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* 标签页导航 */}
            {renderTabNav()}

            {/* 标签页内容 */}
            <div className="flex-1 overflow-y-auto p-4">
                {renderTabContent()}
            </div>

            {/* 底部操作栏 */}
            {hasChanges && (
                <div className="p-4 border-t border-gray-700 bg-gray-700/50">
                    <div className="flex space-x-2">
                        <Button
                            onClick={saveSettings}
                            disabled={isLoading}
                            className="flex-1"
                        >
                            {isLoading ? (
                                <>
                                    <LoadingSpinner size="sm" className="mr-2" />
                                    保存中...
                                </>
                            ) : (
                                '保存设置'
                            )}
                        </Button>
                        
                        <Button
                            onClick={() => {
                                // 重新加载设置
                                window.location.reload();
                            }}
                            variant="outline"
                            disabled={isLoading}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}