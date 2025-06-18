'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRoomContext, useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useAudioProcessing, type AudioProcessingSettings } from '../../hooks/useAudioProcessing';
import { useVAD } from '../../hooks/useVAD';

interface SettingsPanelProps {
    onClose: () => void;
    className?: string;
}

export function SettingsPanel({ onClose, className = '' }: SettingsPanelProps) {
    const room = useRoomContext();
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();

    // 音频处理Hook
    const { 
        settings, 
        updateSetting, 
        updateMultipleSettings,
        isApplying, 
        resetToDefaults,
        applyPreset,
        getPresets,
        applyingSettings // 添加这个
    } = useAudioProcessing();
    
    // VAD Hook
    const { vadResult, isActive: vadActive, startVAD, stopVAD, updateThreshold } = useVAD({
        threshold: settings.vadThreshold,
        smoothingFactor: settings.vadSmoothingFactor,
        minSpeechFrames: settings.vadMinSpeechFrames,
        minSilenceFrames: settings.vadMinSilenceFrames,
        analyzeWindow: settings.vadAnalyzeWindow
    });

    const [activeTab, setActiveTab] = useState<'processing' | 'volume' | 'general'>('processing');
    const [participantVolumes, setParticipantVolumes] = useState<{ [key: string]: number }>({});
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));
    const [showAdvanced, setShowAdvanced] = useState(false);

    const vadPresets = getPresets();

    // 处理点击背景关闭
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // 折叠/展开功能
    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) {
                newSet.delete(section);
            } else {
                newSet.add(section);
            }
            return newSet;
        });
    };

    // 获取连接状态
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

    // 音频处理相关处理函数
    const handleToggleSetting = async (key: keyof AudioProcessingSettings, currentValue: boolean) => {
        try {
            await updateSetting(key, !currentValue);
        } catch (error) {
            console.error(`切换 ${key} 失败:`, error);
        }
    };

    const handleNumberChange = async (key: keyof AudioProcessingSettings, value: number) => {
        try {
            await updateSetting(key, value);
            
            // 如果是VAD相关设置且VAD已启用，同步更新VAD配置
            if (vadActive && String(key).startsWith('vad')) {
                if (key === 'vadThreshold') updateThreshold(value);
            }
        } catch (error) {
            console.error(`调整 ${key} 失败:`, error);
        }
    };

    const handleVADToggle = async () => {
        try {
            if (vadActive) {
                stopVAD();
                await updateSetting('vadEnabled', false);
            } else {
                await updateSetting('vadEnabled', true);
                await startVAD();
                // 应用当前VAD设置
                updateThreshold(settings.vadThreshold);
            }
        } catch (error) {
            console.error('VAD切换失败:', error);
            await updateSetting('vadEnabled', false);
        }
    };

    const handlePresetChange = async (presetName: string) => {
        const preset = vadPresets.find(p => p.name === presetName);
        if (preset) {
            try {
                await applyPreset(preset);
                // 如果VAD已启用，应用新设置
                if (vadActive) {
                    updateThreshold(preset.settings.threshold);
                }
            } catch (error) {
                console.error(`应用预设 ${presetName} 失败:`, error);
            }
        }
    };

    const handleSensitivityChange = async (sensitivity: 'low' | 'medium' | 'high' | 'custom') => {
        await updateSetting('vadSensitivity', sensitivity);
        
        // 根据敏感度预设调整参数
        if (sensitivity !== 'custom') {
            let presetName = 'normal'; // 默认值
            if (sensitivity === 'low') presetName = 'noisy';
            else if (sensitivity === 'high') presetName = 'quiet';
            else if (sensitivity === 'medium') presetName = 'normal';
            
            const preset = vadPresets.find(p => p.name === presetName);
            if (preset) {
                await handlePresetChange(presetName);
            }
        }
    };

    const handleResetAudioSettings = async () => {
        try {
            if (vadActive) {
                stopVAD();
            }
            await resetToDefaults();
        } catch (error) {
            console.error('重置设置失败:', error);
        }
    };

    // 参与者音量控制
    const updateParticipantVolume = useCallback((participantId: string, volume: number) => {
        setParticipantVolumes(prev => ({
            ...prev,
            [participantId]: volume
        }));

        // 应用音量到对应的音频元素
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            const htmlElement = audio as HTMLElement;
            const audioElement = audio as HTMLAudioElement;
            
            // 检查是否是目标参与者的音频元素
            if (htmlElement.dataset.participantId === participantId || 
                htmlElement.dataset.lkParticipant === participantId ||
                htmlElement.getAttribute('data-lk-participant') === participantId) {
                audioElement.volume = volume / 100;
                console.log(`🔊 设置参与者 ${participantId} 音量为 ${volume}%`);
            }
        });

        // 保存到本地存储
        try {
            localStorage.setItem('participant_volumes', JSON.stringify({
                ...participantVolumes,
                [participantId]: volume
            }));
        } catch (error) {
            console.warn('保存参与者音量失败:', error);
        }
    }, [participantVolumes]);

    // 初始化参与者音量
    useEffect(() => {
        // 从本地存储加载
        try {
            const saved = localStorage.getItem('participant_volumes');
            if (saved) {
                setParticipantVolumes(JSON.parse(saved));
            }
        } catch (error) {
            console.warn('加载参与者音量失败:', error);
        }

        // 初始化新参与者的音量
        participants.forEach(participant => {
            if (!participant.isLocal && !participantVolumes[participant.identity]) {
                setParticipantVolumes(prev => ({
                    ...prev,
                    [participant.identity]: 100
                }));
            }
        });
    }, [participants, participantVolumes]);

    // 同步VAD状态
    useEffect(() => {
        if (settings.vadEnabled !== vadActive) {
            if (settings.vadEnabled && !vadActive) {
                startVAD().catch(console.error);
            } else if (!settings.vadEnabled && vadActive) {
                stopVAD();
            }
        }
    }, [settings.vadEnabled, vadActive, startVAD, stopVAD]);

    // 调试功能（仅开发环境）
    const handleDebugAudio = useCallback(() => {
        console.log('🔧 开始音频调试...');
        console.log('='.repeat(50));
        
        if (localParticipant) {
            const audioPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
            if (audioPublication?.track) {
                const track = audioPublication.track.mediaStreamTrack;
                const trackSettings = track.getSettings();
                console.log('🎤 当前音频轨道设置:', trackSettings);
                console.log('🎤 音频发布信息:', {
                    sid: audioPublication.trackSid,
                    source: audioPublication.source,
                    isMuted: audioPublication.isMuted,
                    isEnabled: audioPublication.isEnabled,
                    kind: audioPublication.kind
                });
            } else {
                console.log('🎤 未找到麦克风音频发布');
            }

            const allAudioPublications = localParticipant.audioTrackPublications;
            console.log(`📊 本地音频发布总数: ${allAudioPublications.size}`);
            allAudioPublications.forEach((publication, key) => {
                console.log(`音频发布 ${key}:`, {
                    sid: publication.trackSid,
                    source: publication.source,
                    isMuted: publication.isMuted,
                    isEnabled: publication.isEnabled
                });
            });
        }
        
        console.log('🎛️ 当前音频处理设置:', settings);
        console.log('🎤 VAD状态:', { vadActive, vadResult });
        console.log('🔊 参与者音量设置:', participantVolumes);
        
        const audioElements = document.querySelectorAll('audio');
        console.log(`🔍 找到 ${audioElements.length} 个音频元素:`);
        audioElements.forEach((audio, i) => {
            const htmlElement = audio as HTMLElement;
            const audioElement = audio as HTMLAudioElement;
            console.log(`音频元素 ${i}:`, {
                src: audioElement.src,
                volume: audioElement.volume,
                muted: audioElement.muted,
                paused: audioElement.paused,
                dataset: htmlElement.dataset,
                className: htmlElement.className,
                participantId: htmlElement.dataset.participantId || htmlElement.dataset.lkParticipant
            });
        });
        
        console.log('='.repeat(50));
        console.log('🔧 音频调试完成');
    }, [localParticipant, participantVolumes, settings, vadActive, vadResult]);

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className={`
                bg-gray-800 rounded-xl border border-gray-600 shadow-2xl
                w-full max-w-3xl max-h-[90vh] flex flex-col
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

                {/* 标签页导航 */}
                <div className="flex border-b border-gray-700 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('processing')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'processing'
                                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                    >
                        音频处理
                    </button>
                    <button
                        onClick={() => setActiveTab('volume')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'volume'
                                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                    >
                        音量控制
                    </button>
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'general'
                                ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                                : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-700/50'
                        }`}
                    >
                        常规设置
                    </button>
                </div>

                {/* 内容区域 - 可滚动 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <div className="p-4">
                        {/* 音频处理标签页 */}
                        {activeTab === 'processing' && (
                            <div className="space-y-6">
                                {/* 标题和控制 */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                        </svg>
                                        音频处理设置
                                    </h3>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => setShowAdvanced(!showAdvanced)}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                                        >
                                            {showAdvanced ? '隐藏高级' : '显示高级'}
                                        </button>
                                        <button
                                            onClick={handleResetAudioSettings}
                                            className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                                            title="重置为默认设置"
                                        >
                                            重置
                                        </button>
                                    </div>
                                </div>

                                {/* 说明文字 */}
                                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                                    <p className="text-xs text-blue-300">
                                        💡 音频处理设置使用WebRTC原生功能，VAD提供智能语音检测
                                    </p>
                                </div>

                                {/* 基础音频处理设置 */}
                                <div className="space-y-4">
                                    <button
                                        onClick={() => toggleSection('basic')}
                                        className="flex items-center justify-between w-full text-left"
                                    >
                                        <h4 className="text-md font-medium text-white">基础音频处理</h4>
                                        <svg 
                                            className={`w-4 h-4 text-gray-400 transition-transform ${
                                                expandedSections.has('basic') ? 'rotate-180' : ''
                                            }`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {expandedSections.has('basic') && (
                                        <div className="space-y-4 pl-4 border-l-2 border-gray-600">
                                            {/* 自动增益控制 */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">自动增益控制</span>
                                                    <p className="text-xs text-gray-400">
                                                        {settings.autoGainControl 
                                                            ? '自动调节麦克风增益，确保音量稳定' 
                                                            : '关闭自动增益，手动控制音量'
                                                        }
                                                    </p>
                                                </div>
                                                <div className="flex items-center space-x-2 ml-4">
                                                    {isApplying('autoGainControl') && (
                                                        <div className="flex items-center space-x-1">
                                                            <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            <span className="text-xs text-yellow-400">应用中</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleSetting('autoGainControl', settings.autoGainControl)}
                                                        disabled={isApplying('autoGainControl')}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                            settings.autoGainControl ? 'bg-blue-600' : 'bg-gray-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                settings.autoGainControl ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 噪声抑制 */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">噪声抑制</span>
                                                    <p className="text-xs text-gray-400">过滤背景噪音，提升语音清晰度</p>
                                                </div>
                                                <div className="flex items-center space-x-2 ml-4">
                                                    {isApplying('noiseSuppression') && (
                                                        <div className="flex items-center space-x-1">
                                                            <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            <span className="text-xs text-yellow-400">应用中</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleSetting('noiseSuppression', settings.noiseSuppression)}
                                                        disabled={isApplying('noiseSuppression')}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                            settings.noiseSuppression ? 'bg-blue-600' : 'bg-gray-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                settings.noiseSuppression ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* 回声消除 */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">回声消除</span>
                                                    <p className="text-xs text-gray-400">消除声音回馈，防止回音干扰</p>
                                                </div>
                                                <div className="flex items-center space-x-2 ml-4">
                                                    {isApplying('echoCancellation') && (
                                                        <div className="flex items-center space-x-1">
                                                            <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            <span className="text-xs text-yellow-400">应用中</span>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleToggleSetting('echoCancellation', settings.echoCancellation)}
                                                        disabled={isApplying('echoCancellation')}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                                            settings.echoCancellation ? 'bg-blue-600' : 'bg-gray-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                                settings.echoCancellation ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* VAD语音检测设置 */}
                                <div className="space-y-4">
                                    <button
                                        onClick={() => toggleSection('vad')}
                                        className="flex items-center justify-between w-full text-left"
                                    >
                                        <h4 className="text-md font-medium text-white flex items-center">
                                            语音活动检测 (VAD)
                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                                settings.vadEnabled ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'
                                            }`}>
                                                {settings.vadEnabled ? '启用' : '禁用'}
                                            </span>
                                        </h4>
                                        <svg 
                                            className={`w-4 h-4 text-gray-400 transition-transform ${
                                                expandedSections.has('vad') ? 'rotate-180' : ''
                                            }`} 
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {expandedSections.has('vad') && (
                                        <div className="space-y-4 pl-4 border-l-2 border-green-600">
                                            {/* VAD开关 */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm text-white">启用VAD</span>
                                                    <p className="text-xs text-gray-400">
                                                        {settings.vadEnabled 
                                                            ? '实时检测语音活动，用于智能门限控制' 
                                                            : '关闭语音检测，使用简单门限'
                                                        }
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={handleVADToggle}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                        settings.vadEnabled ? 'bg-green-600' : 'bg-gray-600'
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                                            settings.vadEnabled ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                </button>
                                            </div>

                                            {settings.vadEnabled && (
                                                <>
                                                    {/* VAD实时状态 */}
                                                    {vadResult && (
                                                        <div className="bg-gray-700/30 rounded-lg p-3">
                                                            <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                                                                <div className="text-center">
                                                                    <div className="text-gray-400">语音概率</div>
                                                                    <div className="text-white font-mono">
                                                                        {(vadResult.probability * 100).toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-gray-400">音量</div>
                                                                    <div className="text-white font-mono">
                                                                        {(vadResult.volume * 100).toFixed(1)}%
                                                                    </div>
                                                                </div>
                                                                <div className="text-center">
                                                                    <div className="text-gray-400">状态</div>
                                                                    <div className={`font-medium ${vadResult.isSpeaking ? 'text-green-400' : 'text-gray-400'}`}>
                                                                        {vadResult.isSpeaking ? '🗣️ 说话中' : '🤫 静音'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* 音量可视化 */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-xs text-gray-400 w-12">音量:</span>
                                                                    <div className="flex-1 bg-gray-600 rounded-full h-2">
                                                                        <div 
                                                                            className={`h-2 rounded-full transition-all duration-100 ${
                                                                                vadResult.isSpeaking ? 'bg-green-400' : 'bg-gray-400'
                                                                            }`}
                                                                            style={{ width: `${vadResult.volume * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-xs text-gray-400 w-12">概率:</span>
                                                                    <div className="flex-1 bg-gray-600 rounded-full h-2">
                                                                        <div 
                                                                            className="h-2 bg-blue-400 rounded-full transition-all duration-100"
                                                                            style={{ width: `${vadResult.probability * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* VAD预设 */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm text-white">敏感度预设</span>
                                                            <span className="text-xs text-gray-400">{settings.vadSensitivity}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {['low', 'medium', 'high', 'custom'].map((sensitivity) => (
                                                                <button
                                                                    key={sensitivity}
                                                                    onClick={() => handleSensitivityChange(sensitivity as any)}
                                                                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                                                                        settings.vadSensitivity === sensitivity
                                                                            ? 'bg-blue-600 text-white'
                                                                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                                    }`}
                                                                >
                                                                    {sensitivity === 'low' ? '低敏感' :
                                                                     sensitivity === 'medium' ? '中等' :
                                                                     sensitivity === 'high' ? '高敏感' : '自定义'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* VAD阈值 */}
                                                    <div>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm text-white">检测阈值</span>
                                                            <span className="text-xs text-gray-400">{Math.round(settings.vadThreshold * 100)}%</span>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="1"
                                                                step="0.01"
                                                                value={settings.vadThreshold}
                                                                onChange={(e) => handleNumberChange('vadThreshold', parseFloat(e.target.value))}
                                                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                            />
                                                            <div 
                                                                className="absolute top-0 w-0.5 h-2 bg-yellow-400 pointer-events-none"
                                                                style={{ left: `${settings.vadThreshold * 100}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                            <span>敏感</span>
                                                            <span>不敏感</span>
                                                        </div>
                                                    </div>

                                                    {/* 高级VAD设置 */}
                                                    {showAdvanced && (
                                                        <div className="space-y-4 pt-4 border-t border-gray-600">
                                                            <h5 className="text-sm font-medium text-gray-300">高级VAD参数</h5>
                                                            
                                                            {/* 平滑因子 */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-white">平滑因子</span>
                                                                    <span className="text-xs text-gray-400">{settings.vadSmoothingFactor.toFixed(2)}</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="0.1"
                                                                    max="0.95"
                                                                    step="0.05"
                                                                    value={settings.vadSmoothingFactor}
                                                                    onChange={(e) => handleNumberChange('vadSmoothingFactor', parseFloat(e.target.value))}
                                                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">控制音量变化的平滑程度</p>
                                                            </div>

                                                            {/* 最小语音帧数 */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-white">最小语音帧数</span>
                                                                    <span className="text-xs text-gray-400">{settings.vadMinSpeechFrames}</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="1"
                                                                    max="10"
                                                                    step="1"
                                                                    value={settings.vadMinSpeechFrames}
                                                                    onChange={(e) => handleNumberChange('vadMinSpeechFrames', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">检测到语音前需要的连续帧数</p>
                                                            </div>

                                                            {/* 最小静音帧数 */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-white">最小静音帧数</span>
                                                                    <span className="text-xs text-gray-400">{settings.vadMinSilenceFrames}</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="5"
                                                                    max="20"
                                                                    step="1"
                                                                    value={settings.vadMinSilenceFrames}
                                                                    onChange={(e) => handleNumberChange('vadMinSilenceFrames', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">确认静音前需要的连续帧数</p>
                                                            </div>

                                                            {/* 分析窗口 */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-sm text-white">分析窗口</span>
                                                                    <span className="text-xs text-gray-400">{settings.vadAnalyzeWindow}ms</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="10"
                                                                    max="100"
                                                                    step="5"
                                                                    value={settings.vadAnalyzeWindow}
                                                                    onChange={(e) => handleNumberChange('vadAnalyzeWindow', parseInt(e.target.value))}
                                                                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                                />
                                                                <p className="text-xs text-gray-500 mt-1">音频分析的时间窗口大小</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 麦克风门限（兼容性设置） */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-white">
                                            {settings.vadEnabled ? '基础门限（与VAD结合）' : '麦克风收音门限'}
                                        </span>
                                        <span className="text-xs text-gray-400">{Math.round(settings.microphoneThreshold * 100)}%</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={settings.microphoneThreshold}
                                            onChange={(e) => handleNumberChange('microphoneThreshold', parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                        />
                                        <div 
                                            className="absolute top-0 w-0.5 h-2 bg-yellow-400 pointer-events-none"
                                            style={{ left: `${settings.microphoneThreshold * 100}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>敏感</span>
                                        <span>不敏感</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {settings.vadEnabled 
                                            ? '与VAD检测结合使用的基础音量门限' 
                                            : '简单的音量门限，低于此值将被忽略'
                                        }
                                    </p>
                                </div>

                                {/* 状态显示 */}
                                <div className="bg-gray-800/50 rounded-lg p-3">
                                    <h4 className="text-sm font-medium text-gray-300 mb-2">当前设置状态</h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center">
                                            <div className={`w-2 h-2 rounded-full mr-2 ${settings.autoGainControl ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="text-gray-400">自动增益</span>
                                        </div>
                                        <div className="flex items-center">
                                            <div className={`w-2 h-2 rounded-full mr-2 ${settings.noiseSuppression ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="text-gray-400">噪声抑制</span>
                                        </div>
                                        <div className="flex items-center">
                                            <div className={`w-2 h-2 rounded-full mr-2 ${settings.echoCancellation ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="text-gray-400">回声消除</span>
                                        </div>
                                        <div className="flex items-center">
                                            <div className={`w-2 h-2 rounded-full mr-2 ${settings.vadEnabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                                            <span className="text-gray-400">VAD {settings.vadEnabled ? '启用' : '禁用'}</span>
                                        </div>
                                    </div>
                                    {settings.vadEnabled && (
                                        <div className="mt-2 pt-2 border-t border-gray-600">
                                            <div className="text-xs text-gray-400">
                                                <span>VAD模式: {settings.vadSensitivity} | </span>
                                                <span>阈值: {Math.round(settings.vadThreshold * 100)}% | </span>
                                                <span>平滑: {settings.vadSmoothingFactor.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 音量控制标签页 */}
                        {activeTab === 'volume' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-white flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728"/>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8m-8 0V8.5m0 3.5v3.5"/>
                                    </svg>
                                    参与者音量控制
                                </h3>

                                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                                    <p className="text-xs text-blue-300">
                                        💡 可以独立调节每个参与者的音量大小，设置会自动保存
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {participants
                                        .filter(participant => !participant.isLocal)
                                        .map(participant => (
                                            <div key={participant.identity} className="bg-gray-700/30 rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                                                            {participant.identity?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-white">
                                                                {participant.identity || '未知用户'}
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {participant.isMicrophoneEnabled ? '🎤 麦克风开启' : '🔇 麦克风关闭'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-white">
                                                            {participantVolumes[participant.identity] || 100}%
                                                        </div>
                                                        <div className="text-xs text-gray-400">音量</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between text-xs text-gray-400">
                                                        <span>静音</span>
                                                        <span>正常</span>
                                                        <span>放大</span>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="200"
                                                            step="5"
                                                            value={participantVolumes[participant.identity] || 100}
                                                            onChange={(e) => updateParticipantVolume(participant.identity, parseInt(e.target.value))}
                                                            className="w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                                        />
                                                        {/* 标记线 */}
                                                        <div className="absolute top-0 left-1/2 w-0.5 h-3 bg-gray-400 pointer-events-none transform -translate-x-1/2" />
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>0%</span>
                                                        <span>100%</span>
                                                        <span>200%</span>
                                                    </div>
                                                </div>

                                                {/* 快速设置按钮 */}
                                                <div className="flex space-x-2 mt-3">
                                                    <button
                                                        onClick={() => updateParticipantVolume(participant.identity, 0)}
                                                        className="flex-1 px-3 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/30 transition-colors"
                                                    >
                                                        静音
                                                    </button>
                                                    <button
                                                        onClick={() => updateParticipantVolume(participant.identity, 100)}
                                                        className="flex-1 px-3 py-1 bg-gray-600/20 text-gray-400 rounded text-xs hover:bg-gray-600/30 transition-colors"
                                                    >
                                                        正常
                                                    </button>
                                                    <button
                                                        onClick={() => updateParticipantVolume(participant.identity, 150)}
                                                        className="flex-1 px-3 py-1 bg-green-600/20 text-green-400 rounded text-xs hover:bg-green-600/30 transition-colors"
                                                    >
                                                        放大
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    }
                                    
                                    {participants.filter(p => !p.isLocal).length === 0 && (
                                        <div className="text-center py-12 text-gray-400">
                                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                                            </svg>
                                            <h4 className="text-lg font-medium text-gray-300 mb-2">暂无其他参与者</h4>
                                            <p className="text-sm">当有其他人加入房间时，你可以在这里调节他们的音量</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 常规设置标签页 */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium text-white flex items-center">
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                                    </svg>
                                    常规设置
                                </h3>
                                
                                <div className="space-y-4">
                                    {/* 房间信息 */}
                                    <div className="bg-gray-700/30 rounded-lg p-4">
                                        <h4 className="text-sm font-medium text-white mb-3">房间信息</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">房间名称:</span>
                                                <span className="text-white">{room?.name || '未知'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">参与者数量:</span>
                                                <span className="text-white">{participants.length} 人</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-400">连接状态:</span>
                                                <span className={connectionStatus.color}>{connectionStatus.text}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 本地设备状态 */}
                                    {localParticipant && (
                                        <div className="bg-gray-700/30 rounded-lg p-4">
                                            <h4 className="text-sm font-medium text-white mb-3">本地设备状态</h4>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-300">麦克风</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-2 h-2 rounded-full ${
                                                            localParticipant.isMicrophoneEnabled ? 'bg-green-400' : 'bg-red-400'
                                                        }`} />
                                                        <span className="text-sm text-white">
                                                            {localParticipant.isMicrophoneEnabled ? '已启用' : '已禁用'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-300">摄像头</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <div className={`w-2 h-2 rounded-full ${
                                                            localParticipant.isCameraEnabled ? 'bg-green-400' : 'bg-red-400'
                                                        }`} />
                                                        <span className="text-sm text-white">
                                                            {localParticipant.isCameraEnabled ? '已启用' : '已禁用'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 音频处理状态摘要 */}
                                    <div className="bg-gray-700/30 rounded-lg p-4">
                                        <h4 className="text-sm font-medium text-white mb-3">音频处理状态</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">自动增益:</span>
                                                <span className={settings.autoGainControl ? 'text-green-400' : 'text-gray-400'}>
                                                    {settings.autoGainControl ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">噪声抑制:</span>
                                                <span className={settings.noiseSuppression ? 'text-green-400' : 'text-gray-400'}>
                                                    {settings.noiseSuppression ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">回声消除:</span>
                                                <span className={settings.echoCancellation ? 'text-green-400' : 'text-gray-400'}>
                                                    {settings.echoCancellation ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-400">VAD检测:</span>
                                                <span className={settings.vadEnabled ? 'text-green-400' : 'text-gray-400'}>
                                                    {settings.vadEnabled ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                        </div>
                                        {settings.vadEnabled && vadResult && (
                                            <div className="mt-3 pt-3 border-t border-gray-600">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-400">当前语音状态:</span>
                                                    <span className={vadResult.isSpeaking ? 'text-green-400' : 'text-gray-400'}>
                                                        {vadResult.isSpeaking ? '🗣️ 正在说话' : '🤫 静音中'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs mt-1">
                                                    <span className="text-gray-400">语音概率:</span>
                                                    <span className="text-white font-mono">
                                                        {(vadResult.probability * 100).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 其他设置占位 */}
                                    <div className="bg-gray-700/20 rounded-lg p-4 border-2 border-dashed border-gray-600">
                                        <div className="text-center text-gray-400">
                                            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <p className="text-sm">更多设置功能</p>
                                            <p className="text-xs text-gray-500 mt-1">即将推出...</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
                        {localParticipant && (
                            <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-gray-400">麦克风:</span>
                                <div className="flex items-center space-x-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                        localParticipant.isMicrophoneEnabled ? 'bg-green-400' : 'bg-red-400'
                                    }`} />
                                    <span className="text-gray-300">
                                        {localParticipant.isMicrophoneEnabled ? '已启用' : '已禁用'}
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* VAD状态简要显示 */}
                        {settings.vadEnabled && (
                            <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-gray-400">VAD:</span>
                                <div className="flex items-center space-x-1">
                                    <div className={`w-2 h-2 rounded-full ${
                                        vadActive ? 'bg-green-400' : 'bg-yellow-400'
                                    }`} />
                                    <span className="text-gray-300">
                                        {vadActive ? '活跃' : '未启动'}
                                    </span>
                                    {vadResult && vadActive && (
                                        <span className={`ml-1 ${vadResult.isSpeaking ? 'text-green-400' : 'text-gray-400'}`}>
                                            {vadResult.isSpeaking ? '🗣️' : '🤫'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="p-4">
                        <div className="flex justify-between items-center">
                            <div className="text-xs text-green-400 flex items-center">
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                设置已实时生效
                            </div>
                            
                            <div className="flex space-x-2">
                                {/* 快速切换按钮 */}
                                {activeTab === 'processing' && (
                                    <div className="flex space-x-1">
                                        {/* 快速VAD切换 */}
                                        <button
                                            onClick={handleVADToggle}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                                settings.vadEnabled 
                                                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                                                    : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                                            }`}
                                            title={settings.vadEnabled ? '关闭VAD' : '启用VAD'}
                                        >
                                            VAD
                                        </button>
                                        
                                        {/* 快速噪声抑制切换 */}
                                        <button
                                            onClick={() => handleToggleSetting('noiseSuppression', settings.noiseSuppression)}
                                            disabled={isApplying('noiseSuppression')}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                                                settings.noiseSuppression 
                                                    ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' 
                                                    : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                                            }`}
                                            title={settings.noiseSuppression ? '关闭噪声抑制' : '启用噪声抑制'}
                                        >
                                            {isApplying('noiseSuppression') ? '⏳' : '🔇'}
                                        </button>
                                    </div>
                                )}

                                {/* 开发环境调试按钮 */}
                                {process.env.NODE_ENV === 'development' && (
                                    <button
                                        onClick={handleDebugAudio}
                                        className="px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-500 transition-colors"
                                        title="音频调试"
                                    >
                                        🔧
                                    </button>
                                )}
                                
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-500 transition-colors"
                                >
                                    关闭
                                </button>
                            </div>
                        </div>

                        {/* 应用状态提示 */}
                        {applyingSettings.size > 0 && (
                            <div className="mt-2 text-xs text-yellow-400 flex items-center">
                                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                正在应用设置: {Array.from(applyingSettings).join(', ')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}