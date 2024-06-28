import Animation from "./src/Animation.js";
import Window from "./src/Window.js";

const width = 640;
const height = 480;
const window = Window.ofSize(width, height);
Animation.loop(({ time, dt }) => {
    window.map((x, y) => {
        return [((time * x) / width) % 1, ((time * y) / height) % 1, 0];
    });
    window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
}).play();