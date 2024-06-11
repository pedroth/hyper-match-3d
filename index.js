import Animation from "./src/Animation.js";
import Camera from "./src/Camera.js";
import Color from "./src/Color.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import Window from "./src/Window.js";

const width = 640;
const height = 480;
const window = Window.ofSize(width, height);

const camera = new Camera().orbit(5);
// const { scene, manifoldGraph } = buildSceneWith("./bunny.obj");
// let gameState = createGameState(scene, manifoldGraph);

//========================================================================================
/*                                                                                      *
 *                                    MOUSE HANDLING                                    *
 *                                                                                      */
//========================================================================================

let mousedown = false;
let mouse = Vec2();
window.onMouseDown((x, y) => {
    mousedown = true;
    mouse = Vec2(x, y);
})
window.onMouseUp(() => {
    mousedown = false;
    mouse = Vec2();
})
window.onMouseMove((x, y) => {
    const newMouse = Vec2(x, y);
    if (!mousedown || newMouse.equals(mouse)) {
        return;
    }
    const [dx, dy] = newMouse.sub(mouse).toArray();
    camera.orbit(orbitCoord => orbitCoord.add(
        Vec3(
            0,
            -2 * Math.PI * (dx / window.width),
            -2 * Math.PI * (dy / window.height)
        )
    ));
    mouse = newMouse;
})
window.onMouseWheel(({ dy }) => {
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy, 0, 0)));
})

Animation
    .loop(({ time, dt }) => {
        window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
        camera.rayMap((ray) => ray.dir.map(x => (x + 1) / 2).toArray()).to(window);
        // window.map((x, y) => [((x * time) / width) % 1, ((y * time) / height) % 1, 0]);
    })
    .play();