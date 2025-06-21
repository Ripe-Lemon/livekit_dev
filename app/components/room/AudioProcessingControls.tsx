// app/components/room/AudioProcessingControls.tsx
'use client';

import React from 'react';
import { useAudioProcessing, AudioProcessingSettings } from '../../hooks/useAudioProcessing';

interface AudioProcessingControlsProps {
    className?: string;
}

export function AudioProcessingControls({ className = '' }: AudioProcessingControlsProps) {
    const { settings, updateSetting, isApplying, resetToDefaults, isProcessingActive } = useAudioProcessing();

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
        } catch (error) {
            console.error(`调整 ${key} 失败:`, error);
        }
    };

    const handleReset = async () => {
        try {
            await resetToDefaults();
        } catch (error) {
            console.error('重置设置失败:', error);
        }
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* 标题和状态 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    音频处理设置
                    {/* 状态指示器 */}
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                        isProcessingActive 
                            ? 'bg-green-900/30 text-green-300 border border-green-600' 
                            : 'bg-yellow-900/30 text-yellow-300 border border-yellow-600'
                    }`}>
                        {isProcessingActive ? '🎛️ 处理活跃' : '⏸️ 处理停止'}
                    </span>
                </h3>
                <button
                    onClick={handleReset}
                    className="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-700"
                    title="重置为默认设置"
                >
                    重置
                </button>
            </div>

            {/* 说明文字 */}
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 使用 LiveKit 官方 AudioCaptureOptions，设置会自动持续生效
                </p>
                {!isProcessingActive && (
                    <p className="text-xs text-yellow-300 mt-1">
                        ⚠️ 音频处理未激活，设置将在连接后自动应用
                    </p>
                )}
            </div>

            {/* 音频处理开关 */}
            <div className="space-y-4">
                {/* 自动增益控制 */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <span className="text-sm text-white">自动增益控制</span>
                        <p className="text-xs text-gray-400">
                            LiveKit 原生自动增益控制，确保音量稳定
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
                        <p className="text-xs text-gray-400">LiveKit 原生噪声抑制，过滤背景噪音</p>
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
                        <p className="text-xs text-gray-400">LiveKit 原生回声消除，防止回音</p>
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

                {/* 新增：语音隔离 */}
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <span className="text-sm text-white flex items-center">
                            语音隔离 
                            <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">实验性</span>
                        </span>
                        <p className="text-xs text-gray-400">更强的噪声抑制，浏览器支持有限</p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                        {isApplying('voiceIsolation') && (
                            <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="text-xs text-yellow-400">应用中</span>
                            </div>
                        )}
                        <button
                            onClick={() => handleToggleSetting('voiceIsolation', settings.voiceIsolation)}
                            disabled={isApplying('voiceIsolation')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                settings.voiceIsolation ? 'bg-yellow-600' : 'bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                    settings.voiceIsolation ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* 麦克风收音门限 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white">麦克风收音门限</span>
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
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>敏感</span>
                        <span>不敏感</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">调整麦克风开始收音的音量阈值</p>
                </div>
            </div>

            {/* 状态显示 */}
            <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">LiveKit 音频处理状态</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">处理状态:</span>
                            <span className={isProcessingActive ? 'text-green-400' : 'text-yellow-400'}>
                                {isProcessingActive ? '✅ 活跃' : '⏸️ 停止'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">自动增益:</span>
                            <span className={settings.autoGainControl ? 'text-green-400' : 'text-gray-400'}>
                                {settings.autoGainControl ? '开启' : '关闭'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">噪声抑制:</span>
                            <span className={settings.noiseSuppression ? 'text-green-400' : 'text-gray-400'}>
                                {settings.noiseSuppression ? '开启' : '关闭'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">回声消除:</span>
                            <span className={settings.echoCancellation ? 'text-green-400' : 'text-gray-400'}>
                                {settings.echoCancellation ? '开启' : '关闭'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">语音隔离:</span>
                            <span className={settings.voiceIsolation ? 'text-yellow-400' : 'text-gray-400'}>
                                {settings.voiceIsolation ? '实验性开启' : '关闭'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">门限:</span>
                            <span className="text-blue-400">{Math.round(settings.microphoneThreshold * 100)}%</span>
                        </div>
                    </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-gray-600">
                    <p className="text-xs text-gray-500">
                        💡 <strong>官方 API 优势：</strong><br/>
                        • 使用浏览器/系统原生音频处理<br/>
                        • 更好的性能和稳定性<br/>
                        • 自动持续生效，无需手动管理
                    </p>
                </div>
            </div>
        </div>
    );
}