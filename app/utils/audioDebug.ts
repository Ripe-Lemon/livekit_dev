'use client';

// 音频调试工具
export class AudioDebugger {
    static logCurrentAudioSettings(localParticipant: any) {
        console.log('🎤 === 当前音频轨道信息 ===');
        
        if (!localParticipant) {
            console.log('❌ 没有本地参与者');
            return;
        }

        try {
            const audioPublication = localParticipant.getTrackPublication('microphone');
            if (!audioPublication?.track) {
                console.log('❌ 没有找到麦克风轨道');
                
                // 尝试其他方式获取轨道
                const allPublications = Array.from(localParticipant.trackPublications.values());
                console.log('📋 所有轨道发布:', allPublications);
                return;
            }

            const track = audioPublication.track.mediaStreamTrack;
            const settings = track.getSettings();
            const constraints = track.getConstraints();
            const capabilities = track.getCapabilities();

            console.log('✅ 轨道状态:', track.readyState);
            console.log('🔧 设置 (Settings):', settings);
            console.log('📏 约束 (Constraints):', constraints);
            console.log('🎛️ 能力 (Capabilities):', capabilities);
            
            return { settings, constraints, capabilities };
        } catch (error) {
            console.error('❌ 获取音频设置失败:', error);
        }
    }

    static async testAudioConstraints() {
        console.log('🧪 === 测试音频约束支持 ===');
        
        const testConstraints = [
            { noiseSuppression: true },
            { noiseSuppression: false },
            { echoCancellation: true },
            { echoCancellation: false },
            { autoGainControl: true },
            { autoGainControl: false },
            { 
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true
            }
        ];

        for (const constraint of testConstraints) {
            try {
                console.log(`🔄 测试约束:`, constraint);
                
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: constraint
                });
                
                const track = stream.getAudioTracks()[0];
                const settings = track.getSettings();
                
                console.log(`✅ 约束支持 - 实际设置:`, {
                    requested: constraint,
                    actual: {
                        noiseSuppression: settings.noiseSuppression,
                        echoCancellation: settings.echoCancellation,
                        autoGainControl: settings.autoGainControl
                    }
                });
                
                track.stop();
                stream.getTracks().forEach(t => t.stop());
                
                // 短暂延迟避免资源冲突
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.log(`❌ 约束不支持:`, constraint, error);
            }
        }
    }

    static findAllAudioElements() {
        console.log('🔍 === 查找页面音频元素 ===');
        
        const audioElements = document.querySelectorAll('audio');
        console.log(`找到 ${audioElements.length} 个音频元素:`);
        
        audioElements.forEach((audio, index) => {
            const htmlElement = audio as HTMLElement;
            const audioElement = audio as HTMLAudioElement;
            
            console.log(`🎵 音频元素 ${index}:`, {
                src: audioElement.src || '(无源)',
                volume: `${Math.round(audioElement.volume * 100)}%`,
                muted: audioElement.muted,
                paused: audioElement.paused,
                readyState: audioElement.readyState,
                dataset: Object.keys(htmlElement.dataset).length > 0 ? htmlElement.dataset : '(无数据)',
                classes: htmlElement.className || '(无类名)',
                id: htmlElement.id || '(无ID)'
            });
        });

        // 查找 LiveKit 特定元素
        const lkElements = document.querySelectorAll('[data-lk-participant], [class*="lk-"], [data-participant]');
        console.log(`🎭 找到 ${lkElements.length} 个 LiveKit 相关元素:`);
        
        lkElements.forEach((element, index) => {
            const htmlElement = element as HTMLElement;
            console.log(`🎭 LiveKit 元素 ${index}:`, {
                tagName: element.tagName,
                dataset: Object.keys(htmlElement.dataset).length > 0 ? htmlElement.dataset : '(无数据)',
                classes: htmlElement.className || '(无类名)',
                audioChildren: element.querySelectorAll('audio').length
            });
        });

        return audioElements;
    }

    static monitorVolumeChanges() {
        console.log('📊 === 开始监控音量变化 ===');
        
        const audioElements = document.querySelectorAll('audio');
        
        audioElements.forEach((audio, index) => {
            const audioElement = audio as HTMLAudioElement;
            let lastVolume = audioElement.volume;
            
            // 定期检查音量变化
            const intervalId = setInterval(() => {
                if (audioElement.volume !== lastVolume) {
                    console.log(`🔊 音频元素 ${index} 音量变化: ${Math.round(lastVolume * 100)}% → ${Math.round(audioElement.volume * 100)}%`);
                    lastVolume = audioElement.volume;
                }
            }, 1000);

            // 5分钟后停止监控
            setTimeout(() => {
                clearInterval(intervalId);
                console.log(`⏹️ 停止监控音频元素 ${index}`);
            }, 300000);
        });
        
        console.log(`👀 正在监控 ${audioElements.length} 个音频元素...`);
        console.log('💡 提示: 监控将在5分钟后自动停止');
    }

    // 新增：测试特定参与者的音频元素
    static findParticipantAudio(participantId: string) {
        console.log(`🎯 === 查找参与者 ${participantId} 的音频元素 ===`);
        
        const selectors = [
            `audio[data-lk-participant="${participantId}"]`,
            `audio[data-participant-id="${participantId}"]`,
            `audio[data-participant="${participantId}"]`,
            `[data-lk-participant-id="${participantId}"] audio`,
            `[data-participant-identity="${participantId}"] audio`,
            `[data-testid="participant-${participantId}"] audio`,
            `.lk-participant-tile[data-lk-participant-id="${participantId}"] audio`,
            `.lk-audio-track[data-lk-participant="${participantId}"]`
        ];

        let foundElements: HTMLAudioElement[] = [];
        
        selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                console.log(`✅ 选择器 "${selector}" 找到 ${elements.length} 个元素`);
                elements.forEach(element => {
                    if (element instanceof HTMLAudioElement) {
                        foundElements.push(element);
                    }
                });
            }
        });

        if (foundElements.length === 0) {
            console.log(`❌ 未找到参与者 ${participantId} 的音频元素`);
            // 显示所有可能的参与者元素
            this.findAllAudioElements();
        } else {
            console.log(`✅ 找到 ${foundElements.length} 个音频元素`);
            foundElements.forEach((audio, index) => {
                console.log(`🎵 元素 ${index}:`, {
                    volume: `${Math.round(audio.volume * 100)}%`,
                    src: audio.src,
                    muted: audio.muted,
                    paused: audio.paused
                });
            });
        }

        return foundElements;
    }

    // 新增：实时音频信息面板
    static showAudioInfo() {
        // 创建浮动信息面板
        const panel = document.createElement('div');
        panel.id = 'audio-debug-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            max-width: 400px;
            max-height: 300px;
            overflow-y: auto;
        `;

        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: red;
            color: white;
            border: none;
            border-radius: 3px;
            width: 20px;
            height: 20px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            panel.remove();
            clearInterval(intervalId);
        };

        const content = document.createElement('div');
        content.style.marginTop = '25px';
        
        panel.appendChild(closeBtn);
        panel.appendChild(content);
        document.body.appendChild(panel);

        // 定时更新信息
        const intervalId = setInterval(() => {
            const audioElements = document.querySelectorAll('audio');
            let info = `音频元素数量: ${audioElements.length}\n\n`;
            
            audioElements.forEach((audio, index) => {
                const htmlAudio = audio as HTMLAudioElement;
                const htmlElement = audio as HTMLElement;
                info += `元素 ${index}:\n`;
                info += `  音量: ${Math.round(htmlAudio.volume * 100)}%\n`;
                info += `  状态: ${htmlAudio.paused ? '暂停' : '播放'}\n`;
                info += `  数据: ${JSON.stringify(htmlElement.dataset)}\n\n`;
            });
            
            content.textContent = info;
        }, 1000);

        console.log('📊 音频信息面板已显示，点击 ✕ 关闭');
    }
}

// 在开发环境中暴露到全局
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    (window as any).AudioDebugger = AudioDebugger;
    console.log('🔧 AudioDebugger 已加载到全局，可在控制台使用以下命令:');
    console.log('- AudioDebugger.logCurrentAudioSettings(localParticipant)');
    console.log('- AudioDebugger.testAudioConstraints()');
    console.log('- AudioDebugger.findAllAudioElements()');
    console.log('- AudioDebugger.monitorVolumeChanges()');
    console.log('- AudioDebugger.findParticipantAudio("participantId")');
    console.log('- AudioDebugger.showAudioInfo()');
}