import { readFileSync } from "node:fs";
import Camera from "./src/Camera.js";
import Scene from "./src/Scene.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import Window from "./src/Window.js";
import Image from "./src/Image.js";
import Manifold from "./src/Manifold.js";
import { arrayEquals, loop } from "./src/Utils.js";
import { rayTrace } from "./src/RayTrace.js";
import os from "node:os";
import { Worker } from "node:worker_threads";

function clamp(min, max, x) {
    if (x < min) {
        return min;
    } else if (x > max) {
        return max;
    } else {
        return x;
    }
}

//========================================================================================
/*                                                                                      *
 *                                      GAME SETUP                                      *
 *                                                                                      */
//========================================================================================

let selectedObjects = [];
let selectedIndex = 0;
let neighbors = [];

const MIN_CAMERA_RADIUS = 0.5;
const MAX_CAMERA_RADIUS = 2;
const GOLDEN_RATIO = 1.618033988749;
const MOUSE_WHEEL_FORCE = 0.05;

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
const backgroundImage = Image.ofUrl("./assets/map4.jpg");
const meshObj = readFileSync("./assets/simple_bunny.obj", { encoding: "utf-8" });
const manifold = Manifold.readObj(meshObj, "manifold")
scene.addList(manifold.asSpheres());


//========================================================================================
/*                                                                                      *
 *                                    MOUSE HANDLING                                    *
 *                                                                                      */
//========================================================================================

let rightClick = false;
let mouse = Vec2();
const canvas2ray = camera.rayFromImage(width, height);
window.onMouseDown((x, y, e) => {
    if (e.button === Window.RIGHT_CLICK) rightClick = true;
    mouse = Vec2(x, y);
    if (rightClick) return;
    const hit = scene.interceptWithRay(canvas2ray(x, y))
    if (hit) {
        if (selectedIndex === 0) {
            selectedObjects[selectedIndex++] = hit[2];
        }
        if (selectedIndex === 1) {
            const hitId = hit[2].props.id;
            if (selectedObjects[0].props.id !== hitId && neighbors.some(x => x.props.id === hitId)) {
                selectedObjects[selectedIndex++] = hit[2];
            } else {
                neighbors = [];
                selectedIndex = 0;
                selectedObjects = [];
                selectedObjects[selectedIndex++] = hit[2];
            }
        }
    } else {
        neighbors = [];
        selectedIndex = 0;
        selectedObjects = [];
    }
    exposedWindow = window.exposure();
})
window.onMouseUp(() => {
    rightClick = false;
    mouse = Vec2();
})
window.onMouseMove((x, y) => {
    const newMouse = Vec2(x, y);
    if (!rightClick || newMouse.equals(mouse)) {
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
    const minCameraRadius = getMinCameraRadius();
    camera.orbit(orbitCoord => Vec3(clamp(minCameraRadius, MAX_CAMERA_RADIUS, orbitCoord.x), orbitCoord.y, orbitCoord.z));
    mouse = newMouse;
    exposedWindow = window.exposure();
})
window.onMouseWheel(({ dy }) => {
    const minCameraRadius = getMinCameraRadius();
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy * MOUSE_WHEEL_FORCE, 0, 0)));
    camera.orbit(orbitCoord => Vec3(clamp(minCameraRadius, MAX_CAMERA_RADIUS, orbitCoord.x), orbitCoord.y, orbitCoord.z))
    exposedWindow = window.exposure();
})

window.onKeyDown((event) => {
    if ("escape" === event.key) {
        loopControl.stop();
        window.close();
    }
})

function getMinCameraRadius() {
    const samples = 50;
    const w = window.width;
    const h = window.height;
    const alpha = 4;
    const rangeX = w / alpha;
    const rangeY = h / alpha;
    const centerX = w / 2;
    const centerY = h / 2;
    let camera2SurfaceAvgDistance = 0;
    for (let i = 0; i < samples; i++) {
        const ray = canvas2ray(
            centerX + Math.random() * rangeX,
            centerY + Math.random() * rangeY
        );
        const hit = scene.interceptWithRay(ray);
        if (hit) camera2SurfaceAvgDistance += hit[0];
        else camera2SurfaceAvgDistance += MIN_CAMERA_RADIUS;
    }
    camera2SurfaceAvgDistance = (camera2SurfaceAvgDistance / samples);
    const radius = camera.position.length();
    const distance2Surface = radius - camera2SurfaceAvgDistance;
    return GOLDEN_RATIO * distance2Surface;
}

//========================================================================================
/*                                                                                      *
 *                                       GAME LOOP                                      *
 *                                                                                      */
//========================================================================================

function renderGame(canvas) {
    const render = ray => rayTrace(ray, scene, { bounces: 1, backgroundImage, selectedObjects, neighbors });
    return camera
        .rayMap(render)
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
                        neighbors: neighbors.map(x => x.serialize()),
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

function renderGameFast(canvas) {
    camera.raster(scene, backgroundImage).to(canvas);
}

function switchSpheres() {
    const [i, j] = selectedObjects.map(x => x.props.id);
    selectedObjects.forEach(s => scene.removeElementWithName(s.props.name));
    const p = selectedObjects[0].position;
    const id = selectedObjects[0].props.id;
    const name = selectedObjects[0].props.name;
    selectedObjects[0].setPosition(selectedObjects[1].position);
    selectedObjects[1].setPosition(p);
    selectedObjects[0].props.id = selectedObjects[1].props.id;
    selectedObjects[1].props.id = id;
    selectedObjects[0].props.name = selectedObjects[1].props.name;
    selectedObjects[1].props.name = name;
    selectedObjects.forEach(s => scene.add(s));
    manifold.graph.switchVertices(i, j);
}

function findMatch(id) {
    const vertexIdStack = []
    const matchingVertices = [];
    const visitedVerticesSet = new Set().add(id);
    const graph = manifold.graph;
    const baseColor = graph.getVertex(id).sphere.props.color;
    vertexIdStack.push(...graph.getNeighbors(id));
    while (vertexIdStack.length > 0) {
        const i = vertexIdStack.pop();
        visitedVerticesSet.add(i);
        const v = graph.getVertex(i);
        const color = v.sphere.props.color;
        if (arrayEquals(baseColor, color)) {
            matchingVertices.push(v.id);
            const neighbors = graph.getNeighbors(i);
            neighbors.forEach(n => {
                if (!visitedVerticesSet.has(n)) {
                    vertexIdStack.push(n);
                }
            })
        }
    }
    if (matchingVertices.length < 2) return [];
    matchingVertices.push(id);
    return matchingVertices;

}

function removeSpheresWithId(id) {
    const graph = manifold.graph;
    const sphere = graph.getVertex(id).sphere;
    graph.removeVertex(id);
    scene.removeElementWithName(sphere.props.name);
}

function updateManifold() {
    const ids = selectedObjects.map(x => x.props.id);
    ids.forEach(id => {
        findMatch(id)
            .forEach(sphereIds => {
                removeSpheresWithId(sphereIds)
            });
    })
}

function gameUpdate() {
    if (selectedObjects.length === 0) return;
    if (selectedObjects.length === 1) {
        neighbors = manifold
            .graph
            .getNeighbors(selectedObjects[0].props.id)
            .map(id => manifold.graph.getVertex(id).sphere);
    }
    if (selectedObjects.length === 2) {
        switchSpheres();
        updateManifold();
        scene.rebuild(); // also need to rebuild scene in main thread
        isFirstTime = true;
        neighbors = [];
        selectedIndex = 0;
        selectedObjects = [];
    }
}

const params = process.argv.slice(2);
const isParallel = !(params.length > 0 && params[0] === "-s")
// Game loop
const loopControl = loop(async (dt, time) => {
    if (isParallel) await renderGameParallel(exposedWindow);
    else {
        // renderGame(exposedWindow);
        renderGameFast(window);
    }
    gameUpdate();
    // simulate(dt);
    window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
})



