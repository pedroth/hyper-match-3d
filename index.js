import { readFileSync } from "fs";
import Animation from "./src/Animation.js";
import Camera from "./src/Camera.js";
import Scene from "./src/Scene.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import Window from "./src/Window.js";
import Image from "./src/Image.js";
import Manifold from "./src/Manifold.js";
import { Diffuse } from "./src/Material.js";
import { clamp } from "./src/Utils.js";

//========================================================================================
/*                                                                                      *
 *                                      GAME SETUP                                      *
 *                                                                                      */
//========================================================================================

const MAX_LIGHT_SIMULATION_STEPS = 100;
let lightSimSteps = 0;


//========================================================================================
/*                                                                                      *
 *                                      SCENE SETUP                                     *
 *                                                                                      */
//========================================================================================


const width = 640 / 2;
const height = 480 / 2;
const window = Window.ofSize(width, height);
let exposedWindow = window.exposure();
const camera = new Camera().orbit(2);
const scene = new Scene();

const backgroundImage = Image.ofUrl("./assets/nasa.png");
const uiImage = Image.ofSize(width, height);

const meshObj = readFileSync("./assets/bob.obj", { encoding: "utf-8" });
const manifold = Manifold.readObj(meshObj, "manifold")
scene.add(manifold);


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
    exposedWindow = window.exposure();
    lightSimSteps = 0;
})
window.onMouseWheel(({ dy }) => {
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy * 0.5, 0, 0)));
    camera.orbit(orbitCoord => Vec3(clamp(0.7, 3)(orbitCoord.x), orbitCoord.y, orbitCoord.z))
    exposedWindow = window.exposure();
    lightSimSteps = 0;
})

//========================================================================================
/*                                                                                      *
 *                                       GAME LOOP                                      *
 *                                                                                      */
//========================================================================================

const clampAcos = clamp(-1, 1);

function renderBackground(ray) {
    const dir = ray.dir;
    const theta = Math.atan2(dir.y, dir.x) / (Math.PI);
    const alpha = Math.acos(-clampAcos(dir.z)) / (Math.PI);
    return backgroundImage.getPxl(theta * backgroundImage.width, alpha * backgroundImage.height);
}

function trace(ray, scene, options) {
    const { bounces } = options;
    if (bounces < 0) return [0, 0, 0];
    const hit = scene.interceptWithRay(ray);
    if (!hit) return renderBackground(ray);
    const [, p, e] = hit;
    const color = e.props?.color ?? [0, 0, 0];
    const mat = e.props?.material ?? Diffuse();
    let r = mat.scatter(ray, p, e);
    let finalC = trace(
        r,
        scene,
        { bounces: bounces - 1 }
    );
    return [
        finalC[0] + finalC[0] * color[0],
        finalC[1] + finalC[1] * color[1],
        finalC[2] + finalC[2] * color[2],
    ];
}

function render(ray) {
    // return renderBackground(ray);
    return trace(ray, scene, { bounces: 1 });
    // const hit = scene.interceptWithRay(ray);
    // if(!hit) return renderBackground(ray);
    // const [, p, e] = hit;
    // const color = e.props?.color ?? [0, 0, 0];
    // return color;
}

Animation
    .loop(({ time, dt }) => {
        window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
        if (lightSimSteps++ < MAX_LIGHT_SIMULATION_STEPS)
            camera.rayMap(render).to(exposedWindow);
    })
    .play();