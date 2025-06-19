'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAudioProcessing, type AudioProcessingSettings } from '../../hooks/useAudioProcessing';
import { useVAD } from '../../hooks/useVAD';

interface AudioProcessingControlsProps {
    className?: string;
}

export function AudioProcessingControls({ className = '' }: AudioProcessingControlsProps) {
    const { 
        settings, 
        updateSetting, 
        updateMultipleSettings,
        isApplying, 
        resetToDefaults,
        applyPreset,
        getPresets
    } = useAudioProcessing();
    
    const { 
        vadResult, 
        isActive: vadActive, 
        startVAD, 
        stopVAD, 
        updateThreshold, 
        vadProcessor,
        isGatewayControlling,  // 新增
        gatewayState           // 新增
    } = useVAD({
        threshold: settings.vadThreshold,
        smoothingFactor: settings.vadSmoothingFactor,
        minSpeechFrames: settings.vadMinSpeechFrames,
        minSilenceFrames: settings.vadMinSilenceFrames,
        analyzeWindow: settings.vadAnalyzeWindow
    });
    
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));
    const [showAdvanced, setShowAdvanced] = useState(false);

    const vadPresets = getPresets();

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

    const handleReset = async () => {
        try {
            if (vadActive) {
                stopVAD();
            }
            await resetToDefaults();
        } catch (error) {
            console.error('重置设置失败:', error);
        }
    };

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

    // 添加VAD测试功能
    const handleVADTest = useCallback(() => {
        if (vadProcessor) {
            console.log('🧪 开始VAD测试...');
            vadProcessor.testAudioInput();
            
            // 显示调试信息
            setTimeout(() => {
                const debugInfo = vadProcessor?.getDebugInfo();
                console.log('🔍 VAD调试信息:', debugInfo);
            }, 1000);
        } else {
            console.error('❌ VAD处理器未初始化');
        }
    }, [vadProcessor]);

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
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-900/20"
                    >
                        {showAdvanced ? '隐藏高级' : '显示高级'}
                    </button>
                    <button
                        onClick={handleReset}
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
                                {/* VAD实时状态 - 更新显示双轨道信息 */}
                                {vadResult && (
                                    <div className="bg-gray-700/30 rounded-lg p-3">
                                        <h6 className="text-xs font-medium text-gray-400 mb-2">🎛️ VAD双轨道系统状态</h6>
                                        
                                        {/* 现有的音量和状态显示 */}
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
                                        
                                        {/* 新增：双轨道系统状态 */}
                                        <div className="border-t border-gray-600 pt-3 mt-3">
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">分析轨道:</span>
                                                        <span className={vadActive ? 'text-green-400' : 'text-gray-400'}>
                                                            {vadActive ? '✅ 活跃' : '❌ 停止'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">音频网关:</span>
                                                        <span className={isGatewayControlling ? 'text-green-400' : 'text-gray-400'}>
                                                            {isGatewayControlling ? '✅ 控制中' : '❌ 禁用'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">发布轨道:</span>
                                                        <span className={gatewayState?.isTransmitting ? 'text-green-400' : 'text-red-400'}>
                                                            {gatewayState?.isTransmitting ? '📤 传输中' : '🚫 已静音'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-400">输出音量:</span>
                                                        <span className="text-blue-400">
                                                            {gatewayState?.outputVolume 
                                                                ? `${Math.round(gatewayState.outputVolume * 100)}%`
                                                                : '100%'
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 现有的音量可视化保持不变 */}
                                        <div className="space-y-2 mt-3">
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
                                            {/* 新增：发布音量条 */}
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-400 w-12">发布:</span>
                                                <div className="flex-1 bg-gray-600 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all duration-100 ${
                                                            gatewayState?.isTransmitting ? 'bg-green-400' : 'bg-red-400'
                                                        }`}
                                                        style={{ 
                                                            width: `${gatewayState?.isTransmitting 
                                                                ? (gatewayState?.outputVolume || 1) * 100 
                                                                : 0}%` 
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 工作原理说明 */}
                                        <div className="border-t border-gray-600 pt-2 mt-3">
                                            <div className="text-xs text-gray-400 space-y-1">
                                                <p>💡 <strong>双轨道VAD系统：</strong></p>
                                                <p>• 🎤 分析轨道：原始音频用于VAD检测，不发布到服务器</p>
                                                <p>• 📤 发布轨道：经VAD控制的音频发布给其他参与者</p>
                                                <p>• 🎛️ 音频网关：根据VAD结果控制发布轨道的音量</p>
                                                <p>• ⚡ 实时控制：检测到语音时发送原音，静音时发送静音</p>
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

            {/* 开发环境调试工具 */}
            {process.env.NODE_ENV === 'development' && (
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-yellow-300 mb-2">🧪 VAD调试工具</h5>
                    <div className="flex space-x-2">
                        <button
                            onClick={handleVADTest}
                            className="px-3 py-2 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-500 transition-colors"
                        >
                            测试音频输入
                        </button>
                        <button
                            onClick={() => {
                                const debugInfo = vadProcessor?.getDebugInfo();
                                console.log('🔍 VAD状态:', debugInfo);
                                alert(`VAD状态已输出到控制台\n音量: ${vadResult?.volume.toFixed(3) || 0}\n活跃: ${vadActive}`);
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors"
                        >
                            状态检查
                        </button>
                    </div>
                    <p className="text-xs text-yellow-400 mt-2">
                        💡 测试时请说话，检查控制台是否有音频数据输出
                    </p>
                </div>
            )}
        </div>
    );
}