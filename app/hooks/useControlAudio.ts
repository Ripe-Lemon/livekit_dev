import { useCallback } from 'react';
import { AudioManager } from '../lib/audio/AudioManager';

const audioManager = AudioManager.getInstance();

export function useControlAudio(options: {
    enabled?: boolean;
    volume?: number;
} = {}) {
    const {
        enabled = true,
        volume = 0.6
    } = options;

    // 静音音效
    const playMuteSound = useCallback(() => {
        if (enabled) {
            console.log('播放静音音效');
            audioManager.playSound('mute', { volume });
        }
    }, [enabled, volume]);

    // 取消静音音效
    const playUnmuteSound = useCallback(() => {
        if (enabled) {
            console.log('播放取消静音音效');
            audioManager.playSound('unmute', { volume });
        }
    }, [enabled, volume]);

    // 摄像头开启音效
    const playCameraOnSound = useCallback(() => {
        if (enabled) {
            console.log('播放摄像头开启音效');
            audioManager.playSound('camera-on', { volume });
        }
    }, [enabled, volume]);

    // 摄像头关闭音效
    const playCameraOffSound = useCallback(() => {
        if (enabled) {
            console.log('播放摄像头关闭音效');
            audioManager.playSound('camera-off', { volume });
        }
    }, [enabled, volume]);

    // 屏幕共享开始音效
    const playScreenShareStartSound = useCallback(() => {
        if (enabled) {
            console.log('播放屏幕共享开始音效');
            audioManager.playSound('screen-share-start', { volume });
        }
    }, [enabled, volume]);

    // 屏幕共享结束音效
    const playScreenShareStopSound = useCallback(() => {
        if (enabled) {
            console.log('播放屏幕共享结束音效');
            audioManager.playSound('screen-share-stop', { volume });
        }
    }, [enabled, volume]);

    // 错误音效
    const playErrorSound = useCallback(() => {
        if (enabled) {
            console.log('播放错误音效');
            audioManager.playSound('error', { volume });
        }
    }, [enabled, volume]);

    return {
        playMuteSound,
        playUnmuteSound,
        playCameraOnSound,
        playCameraOffSound,
        playScreenShareStartSound,
        playScreenShareStopSound,
        playErrorSound
    };
}