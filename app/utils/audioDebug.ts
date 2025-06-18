'use client';

// 音频调试工具
export class AudioDebugger {
    static logCurrentAudioSettings(localParticipant: any) {
        if (!localParticipant) {
            console.log('❌ 没有本地参与者');
            return;
        }

        const audioPublication = localParticipant.getTrackPublication('microphone');
        if (!audioPublication?.track) {
            console.log('❌ 没有找到麦克风轨道');
            return;
        }

        const track = audioPublication.track.mediaStreamTrack;
        const settings = track.getSettings();
        const constraints = track.getConstraints();
        const capabilities = track.getCapabilities();

        console.log('🎤 当前音频轨道信息:');
        console.log('设置 (Settings):', settings);
        console.log('约束 (Constraints):', constraints);
        console.log('能力 (Capabilities):', capabilities);
        
        return { settings, constraints, capabilities };
    }

    static async testAudioConstraints() {
        console.log('🧪 测试音频约束支持...');
        
        const testConstraints = [
            { noiseSuppression: true },
            { noiseSuppression: false },
            { echoCancellation: true },
            { echoCancellation: false },
            { autoGainControl: true },
            { autoGainControl: false }
        ];

        for (const constraint of testConstraints) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: constraint
                });
                
                const track = stream.getAudioTracks()[0];
                const settings = track.getSettings();
                
                console.log(`✅ 约束 ${JSON.stringify(constraint)} 支持:`, settings);
                
                track.stop();
                stream.getTracks().forEach(t => t.stop());
            } catch (error) {
                console.log(`❌ 约束 ${JSON.stringify(constraint)} 不支持:`, error);
            }
        }
    }

    static findAllAudioElements() {
        const audioElements = document.querySelectorAll('audio');
        console.log(`🔍 找到 ${audioElements.length} 个音频元素:`);
        
        audioElements.forEach((audio, index) => {
            const htmlElement = audio as HTMLElement;
            const audioElement = audio as HTMLAudioElement;
            console.log(`音频元素 ${index}:`, {
                src: audioElement.src,
                volume: audioElement.volume,
                muted: audioElement.muted,
                paused: audioElement.paused,
                dataset: htmlElement.dataset,
                attributes: Array.from(audio.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
            });
        });

        return audioElements;
    }

    static monitorVolumeChanges() {
        const audioElements = document.querySelectorAll('audio');
        
        audioElements.forEach((audio, index) => {
            const audioElement = audio as HTMLAudioElement;
            const originalVolume = audioElement.volume;
            
            // 定期检查
            setInterval(() => {
                console.log(`📊 音频元素 ${index} 当前音量: ${audioElement.volume}`);
            }, 5000);
        });
    }
}

// 在开发环境中暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).AudioDebugger = AudioDebugger;
}