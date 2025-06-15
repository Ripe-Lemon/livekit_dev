import { AudioManager } from '../lib/audio/AudioManager';

// Function to play sound when a user joins the room
export const playUserJoinSound = () => {
    const audioManager = AudioManager.getInstance();
    audioManager.playSound('user-join');
};

// Function to play sound when a user leaves the room
export const playUserLeaveSound = () => {
    const audioManager = AudioManager.getInstance();
    audioManager.playSound('user-leave');
};

// Function to preload sounds
export const preloadSounds = () => {
    const audioManager = AudioManager.getInstance();
    // Use playSound with volume 0 to preload, or implement preloadSound method in AudioManager
    audioManager.playSound('user-join');
    audioManager.playSound('user-leave');
};