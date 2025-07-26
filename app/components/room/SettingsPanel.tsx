'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRoomContext, useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { AudioProcessingControls } from './AudioProcessingControls';
import { useAudioProcessing } from '../../hooks/useAudioProcessing';

interface SettingsPanelProps {
    onClose: () => void;
    audioProcessing: ReturnType<typeof useAudioProcessing>; // 🎯 接收外部的音频处理对象
}

// 🎯 修复4：将需要频繁渲染的音量条单独封装成组件
const RealtimeVolumeMeter = React.memo(({ 
    audioLevel, 
    activationThreshold, 
    deactivationThreshold 
}: { 
    audioLevel: number;
    activationThreshold: number;
    deactivationThreshold: number;
}) => {

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">VAD 输入音量</span>
            </div>
            {/* 容器：相对定位，用于放置阈值标线 */}
            <div className="relative w-full h-4 bg-gray-700 rounded-lg overflow-hidden">
                {/* 音量条本体 */}
                <div 
                    className="h-full bg-blue-500 transition-all duration-75"
                    style={{ width: `${audioLevel * 100}%` }}
                />

                {/* 上门限阈值标线 (激活) */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-green-400"
                    style={{ left: `${activationThreshold * 100}%` }}
                    title={`激活阈值: ${(activationThreshold * 100).toFixed(0)}%`}
                >
                    <div className="absolute -top-1.5 -translate-x-1/2 w-2 h-2 bg-green-400 rounded-full" />
                </div>

                {/* 下门限阈值标线 (停止) */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                    style={{ left: `${deactivationThreshold * 100}%` }}
                    title={`停止阈值: ${(deactivationThreshold * 100).toFixed(0)}%`}
                >
                    <div className="absolute -bottom-1.5 -translate-x-1/2 w-2 h-2 bg-red-400 rounded-full" />
                </div>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-1.5" />
                    <span>激活</span>
                </div>
                <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-400 rounded-full mr-1.5" />
                    <span>停止</span>
                </div>
            </div>
        </div>
    );
});
RealtimeVolumeMeter.displayName = 'RealtimeVolumeMeter';

export function SettingsPanel({ onClose, audioProcessing }: SettingsPanelProps) {
    const room = useRoomContext();
    const participants = useParticipants();
    const { localParticipant } = useLocalParticipant();

    const [activeTab, setActiveTab] = useState<'processing' | 'volume' | 'general'>('processing');
    const [participantVolumes, setParticipantVolumes] = useState<{ [key: string]: number }>({});

    // 处理点击背景关闭
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
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

    return (
        <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={handleBackdropClick}
        >
            <div className={`
                bg-gray-800 rounded-xl border border-gray-600 shadow-2xl
                w-full max-w-2xl max-h-[85vh] flex flex-col
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

                {/* 🎯 新增：固定的实时音量条 */}
                <div className="p-4 border-b border-gray-700 flex-shrink-0 bg-gray-800">
                     <RealtimeVolumeMeter 
                        audioLevel={audioProcessing.audioLevel}
                        activationThreshold={audioProcessing.settings.vadActivationThreshold}
                        deactivationThreshold={audioProcessing.settings.vadDeactivationThreshold}
                    />
                </div>

                {/* 内容区域 - 可滚动 */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    <div className="p-4">
                        {/* 音频处理标签页 */}
                        {activeTab === 'processing' && (
                            <AudioProcessingControls 
                                audioProcessing={audioProcessing} // 🎯 传递音频处理对象到控件
                            />
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
                                                <span className="text-gray-400">连接质量:</span>
                                                <span className="text-green-400">良好</span>
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

                {/* 底部状态栏和操作按钮 - 显示音频处理状态 */}
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
                            <span className="text-gray-400">音频处理:</span>
                            <div className="flex items-center space-x-1">
                                <div className={`w-2 h-2 rounded-full ${
                                    audioProcessing.isProcessingActive ? 'bg-green-400' : 'bg-yellow-400'
                                }`} />
                                <span className="text-gray-300">
                                    {audioProcessing.isProcessingActive ? '活跃' : audioProcessing.isInitialized ? '已初始化' : '未初始化'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-400">参与者:</span>
                            <span className="text-gray-300">{participants.length} 人</span>
                        </div>
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
        </div>
    );
}