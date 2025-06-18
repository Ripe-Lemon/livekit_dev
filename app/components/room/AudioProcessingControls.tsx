'use client';

import React from 'react';
import { useAudioProcessing, AudioProcessingSettings } from '../../hooks/useAudioProcessing';

interface AudioProcessingControlsProps {
    className?: string;
}

export function AudioProcessingControls({ className = '' }: AudioProcessingControlsProps) {
    const { settings, updateSetting, isApplying, resetToDefaults } = useAudioProcessing();

    const handleToggleSetting = async (key: keyof AudioProcessingSettings, currentValue: boolean) => {
        try {
            await updateSetting(key, !currentValue);
        } catch (error) {
            console.error(`切换 ${key} 失败:`, error);
            // 这里可以添加用户提示
        }
    };

    const handleThresholdChange = async (value: number) => {
        try {
            await updateSetting('microphoneThreshold', value);
        } catch (error) {
            console.error('调整麦克风门限失败:', error);
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
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    音频处理设置
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
                    💡 这些设置使用WebRTC原生音频处理功能，更改后会重新创建音频轨道
                </p>
            </div>

            {/* 音频处理开关 */}
            <div className="space-y-4">
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
                        {!settings.autoGainControl && (
                            <div className="mt-1 p-2 bg-yellow-900/20 border border-yellow-800 rounded text-xs text-yellow-300">
                                ⚠️ 关闭后可能需要手动调整系统麦克风音量
                            </div>
                        )}
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
                            onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
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
                        <div className="w-2 h-2 rounded-full mr-2 bg-blue-400" />
                        <span className="text-gray-400">门限 {Math.round(settings.microphoneThreshold * 100)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}