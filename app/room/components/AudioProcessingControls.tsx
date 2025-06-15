'use client';

// 音频处理控制组件的属性类型
interface AudioProcessingControlsProps {
    isNoiseSuppressionEnabled: boolean;
    onToggleNoiseSuppression: () => void;
    isEchoCancellationEnabled: boolean;
    onToggleEchoCancellation: () => void;
}

// 自定义音频控制按钮
export function AudioProcessingControls({
                                            isNoiseSuppressionEnabled,
                                            onToggleNoiseSuppression,
                                            isEchoCancellationEnabled,
                                            onToggleEchoCancellation,
                                        }: AudioProcessingControlsProps) {
    // 按钮的基础样式 (适配 LiveKit ControlBar)
    const baseButtonStyles = "lk-button";
    // 激活状态的样式
    const enabledStyles = "lk-button-primary";

    return (
        <>
            <button
                onClick={onToggleNoiseSuppression}
                className={`${baseButtonStyles} ${isNoiseSuppressionEnabled ? enabledStyles : ''}`}
            >
                降噪 {isNoiseSuppressionEnabled ? '开' : '关'}
            </button>
            <button
                onClick={onToggleEchoCancellation}
                className={`${baseButtonStyles} ${isEchoCancellationEnabled ? enabledStyles : ''}`}
            >
                回声消除 {isEchoCancellationEnabled ? '开' : '关'}
            </button>
        </>
    );
}