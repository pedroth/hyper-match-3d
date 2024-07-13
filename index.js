import os from "node:os";
import Scene from "./src/Scene.js";
import Image from "./src/Image.js";
import Camera from "./src/Camera.js";
import Window from "./src/Window.js";
import { readFileSync } from "node:fs";
import Manifold from "./src/Manifold.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import { Worker } from "node:worker_threads";
import { traceWithCache } from "./src/RayTrace.js";
import { arrayEquals, clamp, loop } from "./src/Utils.js";
import { GOLDEN_RATIO, MAX_CAMERA_RADIUS, MOUSE_WHEEL_FORCE } from "./src/Constants.js";

//========================================================================================
/*                                                                                      *
 *                                      GAME VARS                                       *
 *                                                                                      */
//========================================================================================

let neighbors = [];
let selectedIndex = 0;
let selectedObjects = [];

//========================================================================================
/*                                                                                      *
 *                                      SCENE SETUP                                     *
 *                                                                                      */
//========================================================================================


const width = 640;
const height = 480;
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
        exposedWindow = window.exposure();
        if (selectedIndex === 0) {
            selectedObjects[selectedIndex++] = hit[2];
            return;
        }
        if (selectedIndex === 1) {
            const hitId = hit[2].props.id;
            if (selectedObjects[0].props.id !== hitId && neighbors.some(x => x.props.id === hitId)) {
                selectedObjects[selectedIndex++] = hit[2];
            } else {
                neighbors = [];
                selectedIndex = 0;
                selectedObjects = [];
            }
        }
    } else {
        neighbors = [];
        selectedIndex = 0;
        selectedObjects = [];
    }
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
    camera.orbit(orbitCoord => Vec3(clamp(minCameraRadius, MAX_CAMERA_RADIUS)(orbitCoord.x), orbitCoord.y, orbitCoord.z));
    mouse = newMouse;
    exposedWindow = window.exposure();
})
window.onMouseWheel(({ dy }) => {
    const minCameraRadius = getMinCameraRadius();
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy * MOUSE_WHEEL_FORCE, 0, 0)));
    camera.orbit(orbitCoord => Vec3(clamp(minCameraRadius, MAX_CAMERA_RADIUS)(orbitCoord.x), orbitCoord.y, orbitCoord.z))
    exposedWindow = window.exposure();
})

window.onKeyDown((event) => {
    if ("escape" === event.key) {
        loopControl.stop();
        window.close();
    }
})

function getMinCameraRadius() {
    const iterations = 50;
    let samples = 0;
    const w = window.width;
    const h = window.height;
    const alpha = 2;
    const rangeX = w / alpha;
    const rangeY = h / alpha;
    const centerX = w / 2;
    const centerY = h / 2;
    let camera2SurfaceAvgDistance = 0;
    for (let i = 0; i < iterations; i++) {
        const ray = canvas2ray(
            centerX + Math.random() * rangeX,
            centerY + Math.random() * rangeY
        );
        const hit = scene.interceptWithRay(ray);
        if (hit) {
            camera2SurfaceAvgDistance += hit[0];
            samples++;
        }
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
    const render = ray =>
        traceWithCache(ray, scene, { bounces: 1, backgroundImage, selectedObjects, neighbors });
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
    const radius = selectedObjects[0].radius;
    const color = selectedObjects[0].props.color;

    selectedObjects[0].setRadius(selectedObjects[1].radius);
    selectedObjects[1].setRadius(radius);

    selectedObjects[0].props.color = selectedObjects[1].props.color;
    selectedObjects[1].props.color = color;
}

function findMatch(id) {
    const vertexIdStack = []
    const matchingVertices = [];
    const visitedVerticesSet = new Set().add(id);
    const graph = manifold.graph;
    const vertex = graph.getVertex(id);
    if (!vertex) return [];
    const baseColor = vertex.sphere.props.color;
    vertexIdStack.push(...graph.getNeighbors(id));
    while (vertexIdStack.length > 0) {
        const i = vertexIdStack.pop();
        visitedVerticesSet.add(i);
        const v = graph.getVertex(i);
        if (!v) continue;
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
    const v = graph.getVertex(id);
    if (!v) return;
    const sphere = v.sphere;
    scene.removeElementWithName(sphere.props.name);
    graph.removeVertex(id);
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
    const graph = manifold.graph;
    if (selectedObjects.length === 0) return;
    if (selectedObjects.length === 1) {
        neighbors = graph
            .getNeighbors(selectedObjects[0].props.id)
            .filter(id => graph.getVertex(id))
            .map(id => graph.getVertex(id).sphere);
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
        renderGame(exposedWindow);
        // renderGameFast(window);
    }
    gameUpdate();
    window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
})



