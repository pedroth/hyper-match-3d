import sdl from '@kmamal/sdl';
import { readFileSync } from "node:fs";

/**
 * play sounds in special wav format:
 * 
 * ffmpeg -i <input audio file> -ac 1 -ar 48000 -f f32le -c:a pcm_f32le <output audio file>
 */
export function playSound(file) {
    const channels = 1;
    const frequency = 48e3;
    const audioInstance = sdl
        .audio
        .openDevice({ type: 'playback' }, {
            channels,
            frequency,
            format: 'f32lsb',
        });
    const soundFile = readFileSync(file);
    const buffer = Buffer.allocUnsafe(soundFile.length);
    soundFile.forEach((chunk, i) => buffer[i] = chunk);
    audioInstance.enqueue(buffer);
    audioInstance.play();
}

export function playSoundLoop(file) {
    const channels = 1;
    const frequency = 48e3;
    const audioInstance = sdl
        .audio
        .openDevice({ type: 'playback' }, {
            channels,
            frequency,
            format: 'f32lsb',
        });
    const soundFile = readFileSync(file);
    const buffer = Buffer.allocUnsafe(soundFile.length);
    soundFile.forEach((chunk, i) => buffer[i] = chunk);

    const ans = {};
    let id = 0;
    ans.play = () => {
        audioInstance.enqueue(buffer);
        audioInstance.play();
        id = setInterval(() => {
            if(audioInstance.queued === 0) {
                ans.play();
            }    
        }, 100);
    }
    ans.stop = () => {
        audioInstance.close();
        clearInterval(id);
    };
    return ans;
}