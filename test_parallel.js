import Window from "./src/Window.js";

const width = 640;
const height = 480;
const window = Window.ofSize(width, height);
const play = async ({ time, oldT }) => {
    const newT = new Date().getTime();
    const dt = (newT - oldT) * 1e-3;
    await window
        .mapParallel((x, y, { width, height, time }) => {
            return [((time * x) / width) % 1, ((time * y) / height) % 1, 0];
        })
        .run({ width, height, time });

    setTimeout(() => play({
        oldT: newT,
        time: time + dt,
    }));
}

play({ oldT: new Date().getTime(), time: 0 });