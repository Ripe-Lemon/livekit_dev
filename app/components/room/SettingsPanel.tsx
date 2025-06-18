'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocalParticipant, useRoomContext, useParticipants } from '@livekit/components-react';

// Types
interface AudioSettings {
    noiseSuppression: boolean;
    echoCancellation: boolean;
    voiceDetectionThreshold: number;
}

interface ParticipantVolumeSettings {
    [participantId: string]: number;
}

interface SettingsPanelProps {
    onClose: () => void;
    className?: string;
}

export function SettingsPanel({ onClose, className = '' }: SettingsPanelProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const participants = useParticipants();

    // 状态管理
    const [audioSettings, setAudioSettings] = useState<AudioSettings>({
        noiseSuppression: true,
        echoCancellation: true,
        voiceDetectionThreshold: 0.3
    });
    
    const [participantVolumes, setParticipantVolumes] = useState<ParticipantVolumeSettings>({});
    const [isVolumeControlExpanded, setIsVolumeControlExpanded] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // 从本地存储加载设置
    useEffect(() => {
        try {
            const savedAudioSettings = localStorage.getItem('audioSettings');
            if (savedAudioSettings) {
                setAudioSettings(JSON.parse(savedAudioSettings));
            }

            const savedParticipantVolumes = localStorage.getItem('participantVolumes');
            if (savedParticipantVolumes) {
                setParticipantVolumes(JSON.parse(savedParticipantVolumes));
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }, []);

    // 初始化参与者音量设置
    useEffect(() => {
        const newVolumes = { ...participantVolumes };
        let hasNewParticipants = false;

        participants.forEach(participant => {
            if (!participant.isLocal && !(participant.identity in newVolumes)) {
                newVolumes[participant.identity] = 100; // 默认音量 100%
                hasNewParticipants = true;
            }
        });

        if (hasNewParticipants) {
            setParticipantVolumes(newVolumes);
        }
    }, [participants, participantVolumes]);

    // 保存设置
    const saveSettings = useCallback(() => {
        try {
            localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
            localStorage.setItem('participantVolumes', JSON.stringify(participantVolumes));
            setHasChanges(false);
            
            // TODO: 实际应用音频设置到媒体轨道
            console.log('设置已保存:', { audioSettings, participantVolumes });
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }, [audioSettings, participantVolumes]);

    // 更新音频设置
    const updateAudioSetting = useCallback((key: keyof AudioSettings, value: boolean | number) => {
        setAudioSettings(prev => ({
            ...prev,
            [key]: value
        }));
        setHasChanges(true);
    }, []);

    // 更新参与者音量
    const updateParticipantVolume = useCallback((participantId: string, volume: number) => {
        setParticipantVolumes(prev => ({
            ...prev,
            [participantId]: volume
        }));
        setHasChanges(true);
    }, []);

    // 处理点击背景关闭
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // 获取连接状态显示文本和颜色
    const getConnectionStatus = () => {
        const state = room?.state;
        switch (state) {
            case 'connected':
                return { text: '已连接', color: 'text-green-400' };
            case 'connecting':
                return { text: '连接中...', color: 'text-yellow-400' };
            case 'disconnected':
                return { text: '已断开', color: 'text-red-400' };
            case 'reconnecting':
                return { text: '重连中...', color: 'text-yellow-400' };
            default:
                return { text: '未知', color: 'text-gray-400' };
        }
    };

    const connectionStatus = getConnectionStatus();

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className={`
                bg-gray-800 rounded-xl border border-gray-600 shadow-2xl
                w-full max-w-md max-h-[80vh] flex flex-col
                ${className}
            `}>
                {/* 头部 */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
                    <h2 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                        音频设置
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 内容区域 - 可滚动 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <div className="p-4 space-y-6">
                        {/* 音频处理设置 */}
                        <div>
                            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                                音频处理
                            </h3>
                            
                            <div className="space-y-4">
                                {/* 噪声抑制开关 */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-white">噪声抑制</span>
                                        <p className="text-xs text-gray-400">过滤背景噪音</p>
                                    </div>
                                    <button
                                        onClick={() => updateAudioSetting('noiseSuppression', !audioSettings.noiseSuppression)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            audioSettings.noiseSuppression ? 'bg-blue-600' : 'bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                audioSettings.noiseSuppression ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* 回声消除开关 */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-white">回声消除</span>
                                        <p className="text-xs text-gray-400">消除声音回馈</p>
                                    </div>
                                    <button
                                        onClick={() => updateAudioSetting('echoCancellation', !audioSettings.echoCancellation)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            audioSettings.echoCancellation ? 'bg-blue-600' : 'bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                audioSettings.echoCancellation ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* 语音检测阈值滑块 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-white">语音检测阈值</span>
                                        <span className="text-xs text-gray-400">{Math.round(audioSettings.voiceDetectionThreshold * 100)}%</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={audioSettings.voiceDetectionThreshold}
                                            onChange={(e) => updateAudioSetting('voiceDetectionThreshold', parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>敏感</span>
                                        <span>不敏感</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 参与者音量控制 */}
                        <div>
                            <button
                                onClick={() => setIsVolumeControlExpanded(!isVolumeControlExpanded)}
                                className="w-full flex items-center justify-between text-sm font-medium text-gray-300 hover:text-white transition-colors mb-3"
                            >
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                    参与者音量控制
                                </div>
                                <svg 
                                    className={`w-4 h-4 transition-transform ${isVolumeControlExpanded ? 'rotate-180' : ''}`} 
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {isVolumeControlExpanded && (
                                <div className="space-y-3 pl-2 border-l-2 border-gray-700">
                                    {participants
                                        .filter(participant => !participant.isLocal)
                                        .map(participant => (
                                            <div key={participant.identity} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                                            {participant.identity?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span className="text-sm text-white truncate max-w-24">
                                                            {participant.identity || '未知用户'}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-gray-400 min-w-8 text-right">
                                                        {participantVolumes[participant.identity] || 100}%
                                                    </span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="200"
                                                        step="5"
                                                        value={participantVolumes[participant.identity] || 100}
                                                        onChange={(e) => updateParticipantVolume(participant.identity, parseInt(e.target.value))}
                                                        className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer slider-sm"
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    }
                                    
                                    {participants.filter(p => !p.isLocal).length === 0 && (
                                        <div className="text-center py-4 text-gray-400">
                                            <svg className="w-6 h-6 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                            </svg>
                                            <p className="text-xs">暂无其他参与者</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 底部状态栏和操作按钮 */}
                <div className="border-t border-gray-700 flex-shrink-0">
                    {/* 连接状态 */}
                    <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">连接状态:</span>
                            <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    room?.state === 'connected' ? 'bg-green-400' : 
                                    room?.state === 'connecting' || room?.state === 'reconnecting' ? 'bg-yellow-400' : 
                                    'bg-red-400'
                                }`} />
                                <span className={connectionStatus.color}>{connectionStatus.text}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-400">参与者:</span>
                            <span className="text-gray-300">{participants.length} 人</span>
                        </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="p-4">
                        <div className="flex space-x-2">
                            <button
                                onClick={saveSettings}
                                disabled={!hasChanges}
                                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    hasChanges 
                                        ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {hasChanges ? '保存设置' : '已保存'}
                            </button>
                            
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-500 transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}