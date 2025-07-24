// app/components/room/AudioProcessingControls.tsx
'use client';

import React from 'react';
import { useAudioProcessing, AudioProcessingSettings } from '../../hooks/useAudioProcessing';

interface AudioProcessingControlsProps {
    className?: string;
    audioProcessing: ReturnType<typeof useAudioProcessing>; // 🎯 接收外部的音频处理对象
}

export function AudioProcessingControls({ className = '', audioProcessing }: AudioProcessingControlsProps) {
    // 🎯 不再在这里调用 useAudioProcessing()，而是使用传入的对象
    const { 
        settings, 
        updateSetting, 
        isApplying, 
        resetToDefaults, 
        isProcessingActive, 
        isInitialized,
        isVADActive,
        audioLevel,
    } = audioProcessing;

    const handleToggleSetting = async (key: keyof AudioProcessingSettings, currentValue: boolean) => {
        try {
            await updateSetting(key, !currentValue);
        } catch (error) {
            console.error(`切换 ${key} 失败:`, error);
        }
    };

    const handleNumberChange = async (key: keyof AudioProcessingSettings, value: string) => {
        await updateSetting(key, parseFloat(value));
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
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${
                        isProcessingActive 
                            ? 'bg-green-900/30 text-green-300 border border-green-600' 
                            : isInitialized
                            ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-600'
                            : 'bg-red-900/30 text-red-300 border border-red-600'
                    }`}>
                        {isProcessingActive ? (
                            <>
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                <span>处理活跃</span>
                            </>
                        ) : isInitialized ? (
                            <>
                                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                                <span>已初始化</span>
                            </>
                        ) : (
                            <>
                                <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                <span>未初始化</span>
                            </>
                        )}
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
                    💡 音频处理系统常驻运行，不受设置界面打开/关闭影响
                </p>
                {!isInitialized && (
                    <p className="text-xs text-yellow-300 mt-1">
                        ⚠️ 等待房间连接后自动初始化...
                    </p>
                )}
                {isInitialized && !isProcessingActive && (
                    <p className="text-xs text-orange-300 mt-1">
                        ⚠️ 已初始化但处理未激活，可能存在问题
                    </p>
                )}
            </div>

            {/* 其余的 UI 控件保持不变... */}
            <div className="space-y-4">
                {/* 🎯 2. 新增 VAD (语音激活检测) 开关 */}
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex-1">
                        <span className="text-sm text-white flex items-center">
                            语音激活检测 (VAD)
                            <span className="ml-2 px-2 py-0.5 text-xs bg-green-600 text-white rounded">推荐</span>
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                            仅在您说话时发送音频，有效过滤背景噪音。
                        </p>
                        {/* 实时 VAD 状态 */}
                        <div className="flex items-center text-xs mt-2">
                            <span className="mr-2 text-gray-400">状态:</span>
                            {settings.vadEnabled ? (
                                <span className={`px-2 py-0.5 rounded flex items-center ${isVADActive ? 'bg-green-500/30 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                    <span className={`w-2 h-2 rounded-full mr-1.5 ${isVADActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                                    {isVADActive ? '语音传输中' : '等待语音'}
                                </span>
                            ) : (
                                <span className="text-yellow-400">已禁用</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                        {isApplying('vadEnabled') && (
                            <div className="flex items-center space-x-1">
                                <svg className="w-4 h-4 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">{/* ... */}</svg>
                                <span className="text-xs text-yellow-400">应用中</span>
                            </div>
                        )}
                        <button
                            onClick={() => handleToggleSetting('vadEnabled', settings.vadEnabled)}
                            disabled={isApplying('vadEnabled')}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                settings.vadEnabled ? 'bg-green-600' : 'bg-gray-600'
                            }`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.vadEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* 实时音量计 (可选但推荐)，可以放在VAD模块下面 */}
                 <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-white">实时麦克风音量</span>
                    </div>
                    <div className="w-full h-2 bg-gray-600 rounded-lg overflow-hidden">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-75"
                            style={{ width: `${audioLevel * 100}%` }}
                        />
                    </div>
                 </div>

                 {/* 🎯 2. 新增：VAD 参数调整模块 (仅在VAD启用时显示) */}
                {settings.vadEnabled && isInitialized && (
                    <div className="space-y-4 p-3 border border-gray-700 rounded-lg">
                        <h4 className="text-xs font-medium text-gray-300">VAD 参数微调</h4>
                        
                        {/* VAD 灵敏度滑块 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white">触发灵敏度</span>
                                <span className="text-xs text-gray-400">{settings.vadPositiveSpeechThreshold.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.3"
                                max="0.8" // 建议范围，可调整
                                step="0.05"
                                value={settings.vadPositiveSpeechThreshold}
                                onChange={(e) => handleNumberChange('vadPositiveSpeechThreshold', e.target.value)}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>不易触发</span>
                                <span>容易触发</span>
                            </div>
                        </div>

                        {/* 🎯 新增：VAD 结束灵敏度滑块 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white">结束灵敏度</span>
                                <span className="text-xs text-gray-400">{settings.vadNegativeSpeechThreshold.toFixed(2)}</span>
                            </div>
                            <input
                                type="range"
                                min="0.1"
                                max="0.5" // negative 阈值通常低于 positive
                                step="0.05"
                                value={settings.vadNegativeSpeechThreshold}
                                onChange={(e) => handleNumberChange('vadNegativeSpeechThreshold', e.target.value)}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>不易断句</span>
                                <span>容易断句</span>
                            </div>
                        </div>

                        {/* VAD 静音延迟滑块 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-white">静音延迟</span>
                                <span className="text-xs text-gray-400">{settings.vadRedemptionFrames} 帧</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                step="1"
                                value={settings.vadRedemptionFrames}
                                onChange={(e) => handleNumberChange('vadRedemptionFrames', e.target.value)}
                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                             <div className="flex justify-between text-xs text-gray-500 mt-1">
                                <span>快速静音</span>
                                <span>延迟静音</span>
                            </div>
                        </div>
                    </div>
                )}

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
            </div>

            {/* 状态显示 */}
            <div className="bg-gray-800/50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-gray-300 mb-2">音频处理系统状态</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">初始化状态:</span>
                            <span className={isInitialized ? 'text-green-400' : 'text-red-400'}>
                                {isInitialized ? '✅ 已初始化' : '❌ 未初始化'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">处理状态:</span>
                            <span className={isProcessingActive ? 'text-green-400' : 'text-yellow-400'}>
                                {isProcessingActive ? '✅ 活跃' : '⏸️ 停止'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">静音轨道停止:</span>
                            <span className="text-green-400">✅ 已启用</span>
                        </div>
                    </div>
                    <div>
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
                        <div className="flex justify-between">
                            <span className="text-gray-400">回声消除:</span>
                            <span className={settings.echoCancellation ? 'text-green-400' : 'text-gray-400'}>
                                {settings.echoCancellation ? '开启' : '关闭'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="mt-3 pt-2 border-t border-gray-600">
                    <p className="text-xs text-gray-500">
                        💡 <strong>常驻音频处理：</strong><br/>
                        • 房间级别管理，不受UI影响<br/>
                        • 设置变更立即生效<br/>
                        • stopMicTrackOnMute 自动启用<br/>
                        • Hook 在房间顶层常驻运行
                    </p>
                </div>
            </div>
        </div>
    );
}