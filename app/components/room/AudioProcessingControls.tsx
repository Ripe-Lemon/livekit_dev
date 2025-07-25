// app/components/room/AudioProcessingControls.tsx
'use client';

import React from 'react';
import { useAudioProcessing, AudioProcessingSettings } from '../../hooks/useAudioProcessing';

interface AudioProcessingControlsProps {
    className?: string;
    audioProcessing: ReturnType<typeof useAudioProcessing>; // 🎯 接收外部的音频处理对象
}

// 🎯 修复4：将需要频繁渲染的音量条单独封装成组件
const RealtimeVolumeMeter = React.memo(({ audioLevel }: { audioLevel: number }) => {
    return (
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
    );
});
RealtimeVolumeMeter.displayName = 'RealtimeVolumeMeter';

// 🎯 修复5：将不频繁更新的控件封装，阻止因 audioLevel 变化而渲染
const MainControls = React.memo(({ 
    settings, 
    isApplying, 
    isVADActive,
    handleToggleSetting,
    handleNumberChange 
}: {
    settings: any;
    isApplying: (key: keyof AudioProcessingSettings) => boolean;
    isVADActive: boolean;
    handleToggleSetting: (key: keyof AudioProcessingSettings, value: boolean) => void;
    handleNumberChange: (key: keyof AudioProcessingSettings, value: string) => void;
}) => {
    return (
        <div className="space-y-4">
            {/* 调整前置增益滑块的范围和标签 */}
            <div className="p-3 border border-gray-700 rounded-lg">
                <h4 className="text-xs font-medium text-gray-300 mb-2">输入音量</h4>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white">前置增益</span>
                        <span className="text-xs text-gray-400">
                            x{settings.preamp.toFixed(1)}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="0.5" // 最小值设为0.5倍
                        max="5.0" // 最大值设为5倍，提供更大空间
                        step="0.1" 
                        defaultValue={settings.preamp} 
                        onChange={(e) => handleNumberChange('preamp', e.target.value)} 
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>较小</span>
                        <span className="font-bold text-gray-300">正常</span>
                        <span>更大</span>
                    </div>
                </div>
            </div>

            {/* 🎯 新增：输出音量模块 */}
            <div className="p-3 border border-gray-700 rounded-lg">
                <h4 className="text-xs font-medium text-gray-300 mb-2">输出音量</h4>
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white">后置增益 (补偿增益)</span>
                        <span className="text-xs text-gray-400">
                            x{settings.postamp.toFixed(1)}
                        </span>
                    </div>
                    <input 
                        type="range" 
                        min="0.5" 
                        max="20.0"
                        step="0.1" 
                        defaultValue={settings.postamp} 
                        onChange={(e) => handleNumberChange('postamp', e.target.value)} 
                        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>较小</span>
                        <span>正常</span>
                        <span>更大</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                        💡 在所有处理完成后，对最终音量进行补偿。如果整体声音依然偏小，请调高此值。
                    </p>
                </div>
            </div>

            {/* VAD 主开关 */}
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex-1">
                    <span className="text-sm text-white flex items-center">语音激活检测</span>
                    <p className="text-xs text-gray-400 mt-1">仅在您说话时发送音频，有效过滤背景噪音。</p>
                    <div className="flex items-center text-xs mt-2">
                        <span className="mr-2 text-gray-400">状态:</span>
                        {settings.vadEnabled ? (
                            <span className={`px-2 py-0.5 rounded flex items-center ${isVADActive ? 'bg-green-500/30 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${isVADActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
                                {isVADActive ? '语音传输中' : '等待语音'}
                            </span>
                        ) : (<span className="text-yellow-400">已禁用</span>)}
                    </div>
                </div>
                <button
                    onClick={() => handleToggleSetting('vadEnabled', settings.vadEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.vadEnabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settings.vadEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* 使用新的自定义VAD参数替换旧的UI */}
            {settings.vadEnabled && (
                 <div className="space-y-4 p-3 border border-gray-700 rounded-lg">
                     <h4 className="text-xs font-medium text-gray-300">自定义VAD参数</h4>
                     <div>
                         <div className="flex items-center justify-between mb-2">
                             <span className="text-sm text-white">激活阈值</span>
                             <span className="text-xs text-gray-400">{(settings.vadThreshold * 100).toFixed(0)}%</span>
                         </div>
                         <input type="range" min="0.01" max="0.5" step="0.01" defaultValue={settings.vadThreshold} onChange={(e) => handleNumberChange('vadThreshold', e.target.value)} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                         <p className="text-xs text-gray-400 mt-1">音量超过此值时，判定为开始说话。</p>
                     </div>
                     <div>
                         <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white">激活前缓冲</span>
                            <span className="text-xs text-gray-400">{settings.vadAttackTime} ms</span>
                         </div>
                         <input type="range" min="0" max="300" step="10" defaultValue={settings.vadAttackTime} onChange={(e) => handleNumberChange('vadAttackTime', e.target.value)} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                         <p className="text-xs text-gray-400 mt-1">语音持续超过此时长，才会打开音频门，可防止短促噪音误触发。</p>
                     </div>
                     <div>
                         <div className="flex items-center justify-between mb-2">
                             <span className="text-sm text-white">静音延迟</span>
                             <span className="text-xs text-gray-400">{settings.vadReleaseTime} ms</span>
                         </div>
                         <input type="range" min="100" max="2000" step="50" defaultValue={settings.vadReleaseTime} onChange={(e) => handleNumberChange('vadReleaseTime', e.target.value)} className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                         <p className="text-xs text-gray-400 mt-1">语音停止后，等待此时长再关闭音频门，可防止句间停顿被切断。</p>
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
    );
});
MainControls.displayName = 'MainControls';

export function AudioProcessingControls({ className = '', audioProcessing }: AudioProcessingControlsProps) {
    const { 
        settings, 
        updateSetting, 
        isApplying, 
        isVADActive,
        audioLevel,
    } = audioProcessing;

    const handleToggleSetting = React.useCallback((key: string, currentValue: boolean) => {
        updateSetting(key as any, !currentValue);
    }, [updateSetting]);

    const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleNumberChange = React.useCallback((key: keyof AudioProcessingSettings, value: string) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            updateSetting(key, parseFloat(value));
        }, 250); // 250ms 防抖
    }, [updateSetting]);

    return (
        <div className="space-y-4">
            {/* 实时音量条：这个组件会频繁渲染 */}
            <RealtimeVolumeMeter audioLevel={audioLevel} />
            
            {/* 主要控件：这个组件不会因为 audioLevel 变化而渲染 */}
            <MainControls 
                settings={settings}
                isApplying={isApplying}
                isVADActive={isVADActive}
                handleToggleSetting={handleToggleSetting}
                handleNumberChange={handleNumberChange}
            />
        </div>
    );
}