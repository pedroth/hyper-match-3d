import { readFileSync } from "node:fs";
import Animation from "./src/Animation.js";
import Camera from "./src/Camera.js";
import Scene from "./src/Scene.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import Window from "./src/Window.js";
import Image from "./src/Image.js";
import Manifold from "./src/Manifold.js";
import { clamp } from "./src/Utils.js";
import { rayTrace } from "./src/RayTrace.js";
import os from "node:os";
import { Worker } from "node:worker_threads";

//========================================================================================
/*                                                                                      *
 *                                      GAME SETUP                                      *
 *                                                                                      */
//========================================================================================

let selectedObjects = [];
let selectedIndex = 0;

const MIN_CAMERA_RADIUS = 0.7;
const MAX_CAMERA_RADIUS = 3

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

const meshObj = readFileSync("./assets/simple_bunny.obj", { encoding: "utf-8" });
const manifold = Manifold.readObj(meshObj, "manifold")
scene.addList(manifold.asSpheres());


//========================================================================================
/*                                                                                      *
 *                                    MOUSE HANDLING                                    *
 *                                                                                      */
//========================================================================================

let mousedown = false;
let mouse = Vec2();
const canvas2ray = camera.rayFromImage(width, height);
window.onMouseDown((x, y) => {
    mousedown = true;
    mouse = Vec2(x, y);
    const hit = scene.interceptWithRay(canvas2ray(x, y))
    if (hit) {
        exposedWindow = window.exposure();
        selectedObjects[selectedIndex++] = hit[2];
        if (selectedIndex === 2) {
            selectedIndex = 0;
            selectedObjects = [];
        }
    }
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
})
window.onMouseWheel(({ dy }) => {
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy * 0.5, 0, 0)));
    camera.orbit(orbitCoord => Vec3(clamp(MIN_CAMERA_RADIUS, MAX_CAMERA_RADIUS)(orbitCoord.x), orbitCoord.y, orbitCoord.z))
    exposedWindow = window.exposure();
})

//========================================================================================
/*                                                                                      *
 *                                       GAME LOOP                                      *
 *                                                                                      */
//========================================================================================

function renderGame(canvas) {
    return camera
        .rayMap(ray => rayTrace(ray, scene, { bounces: 1, backgroundImage, selectedObjects }))
        .to(canvas);
}

let isFirstTime = true;
const N = os.cpus().length;
const WORKERS = [...Array(N)].map(() => new Worker("./src/RayTraceWorker.js", { type: 'module' }));
function renderGameParallel(canvas) {
    const w = width;
    const h = height;
    return Promise
        .all(
            WORKERS.map((worker, k) => {
                return new Promise((resolve) => {
                    worker.removeAllListeners('message');
                    worker.on("message", message => {
                        const { image, startRow, endRow, } = message;
                        let index = 0;
                        const startIndex = 4 * w * startRow;
                        const endIndex = 4 * w * endRow;
                        for (let i = startIndex; i < endIndex; i += 4) {
                            canvas.setPxlData(i, [image[index++], image[index++], image[index++]]);
                            index++;
                        }
                        resolve();
                    });
                    const ratio = Math.floor(h / WORKERS.length);
                    const message = {
                        width: w,
                        height: h,
                        params: { bounces: 1 },
                        startRow: k * ratio,
                        endRow: Math.min(h - 1, (k + 1) * ratio),
                        camera: camera.serialize(),
                        selectedObjects: selectedObjects.map(x => x.serialize()),
                        isFirstTime
                    };
                    if (isFirstTime) {
                        message.backgroundImage = backgroundImage.serialize();
                        message.scene = scene.serialize();
                    }
                    worker.postMessage(message);
                });
            })
        )
        .then(() => {
            isFirstTime = false;
            return canvas.paint();
        })
}

const params = process.argv.slice(2);
if (params.length > 0 && params[0] === "-s") {
    Animation
        .loop(async ({ dt }) => {
            renderGame(exposedWindow);
            window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
        })
        .play();
} else {
    const play = async ({ time, oldT }) => {
        const newT = new Date().getTime();
        const dt = (newT - oldT) * 1e-3;
        await renderGameParallel(exposedWindow);
        window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
        setTimeout(() => play({
            oldT: newT,
            time: time + dt,
        }));
    }
    play({ oldT: new Date().getTime(), time: 0 });
}



