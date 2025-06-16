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
            console.log('🔇 播放静音音效');
            try {
                audioManager.playSound('mute', { volume });
                console.log('✅ 静音音效播放成功');
            } catch (error) {
                console.error('❌ 静音音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过静音音效');
        }
    }, [enabled, volume]);

    // 取消静音音效
    const playUnmuteSound = useCallback(() => {
        if (enabled) {
            console.log('🔊 播放取消静音音效');
            try {
                audioManager.playSound('unmute', { volume });
                console.log('✅ 取消静音音效播放成功');
            } catch (error) {
                console.error('❌ 取消静音音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过取消静音音效');
        }
    }, [enabled, volume]);

    // 摄像头开启音效
    const playCameraOnSound = useCallback(() => {
        if (enabled) {
            console.log('📹 播放摄像头开启音效');
            try {
                audioManager.playSound('camera-on', { volume });
                console.log('✅ 摄像头开启音效播放成功');
            } catch (error) {
                console.error('❌ 摄像头开启音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过摄像头开启音效');
        }
    }, [enabled, volume]);

    // 摄像头关闭音效
    const playCameraOffSound = useCallback(() => {
        if (enabled) {
            console.log('📹❌ 播放摄像头关闭音效');
            try {
                audioManager.playSound('camera-off', { volume });
                console.log('✅ 摄像头关闭音效播放成功');
            } catch (error) {
                console.error('❌ 摄像头关闭音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过摄像头关闭音效');
        }
    }, [enabled, volume]);

    // 屏幕共享开始音效
    const playScreenShareStartSound = useCallback(() => {
        if (enabled) {
            console.log('🖥️ 播放屏幕共享开始音效');
            try {
                audioManager.playSound('screen-share-start', { volume });
                console.log('✅ 屏幕共享开始音效播放成功');
            } catch (error) {
                console.error('❌ 屏幕共享开始音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过屏幕共享开始音效');
        }
    }, [enabled, volume]);

    // 屏幕共享结束音效
    const playScreenShareStopSound = useCallback(() => {
        if (enabled) {
            console.log('🖥️❌ 播放屏幕共享结束音效');
            try {
                audioManager.playSound('screen-share-stop', { volume });
                console.log('✅ 屏幕共享结束音效播放成功');
            } catch (error) {
                console.error('❌ 屏幕共享结束音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过屏幕共享结束音效');
        }
    }, [enabled, volume]);

    // 错误音效
    const playErrorSound = useCallback(() => {
        if (enabled) {
            console.log('⚠️ 播放错误音效');
            try {
                audioManager.playSound('error', { volume });
                console.log('✅ 错误音效播放成功');
            } catch (error) {
                console.error('❌ 错误音效播放失败:', error);
            }
        } else {
            console.log('⏸️ 控制音效已禁用，跳过错误音效');
        }
    }, [enabled, volume]);

    console.log('🎮 useControlAudio Hook 初始化完成', { enabled, volume });

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