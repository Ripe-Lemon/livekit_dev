export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private isEnabled: boolean = true;

    private constructor() {}

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    async initialize(): Promise<void> {
        // 预加载音效文件
        const soundFiles = [
            'user-join',
            'user-leave',
            'message-notification'
        ];

        for (const soundName of soundFiles) {
            try {
                const audio = new Audio(`/sounds/${soundName}.mp3`);
                audio.preload = 'auto';
                audio.volume = 0.3; // 设置音量为30%
                this.sounds.set(soundName, audio);
            } catch (error) {
                console.warn(`Failed to load sound: ${soundName}`, error);
            }
        }
    }

    playSound(soundName: string): void {
        if (!this.isEnabled) return;

        const audio = this.sounds.get(soundName);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch((error) => {
                console.warn(`Failed to play sound: ${soundName}`, error);
            });
        }
    }

    setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
    }

    isAudioEnabled(): boolean {
        return this.isEnabled;
    }

    setVolume(volume: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));
        this.sounds.forEach(audio => {
            audio.volume = clampedVolume;
        });
    }
}