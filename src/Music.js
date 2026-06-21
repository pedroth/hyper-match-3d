import sdl from './SDL.js';
import { readFileSync } from "node:fs";

/**
 * play sounds in special wav format:
 *
 * ffmpeg -i <input audio file> -ac 1 -ar 48000 -f f32le -c:a pcm_f32le <output audio file>
 */
export function playSound(file) {
    const audioInstance = sdl.audio.openDevice({ channels: 1, frequency: 48000 });
    const buffer = readFileSync(file);
    audioInstance.enqueue(buffer);
    audioInstance.play();
}

export function playSoundLoop(file) {
    const audioInstance = sdl.audio.openDevice({ channels: 1, frequency: 48000 });
    const buffer = readFileSync(file);

    const ans = {};
    let id = 0;
    ans.play = () => {
        audioInstance.enqueue(buffer);
        audioInstance.play();
        id = setInterval(() => {
            if (audioInstance.queued === 0) {
                ans.play();
            }
        }, 100);
    };
    ans.stop = () => {
        audioInstance.close();
        clearInterval(id);
    };
    return ans;
}