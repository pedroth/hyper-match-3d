import os from "node:os";
import Scene from "./src/Scene.js";
import Image from "./src/Image.js";
import Camera from "./src/Camera.js";
import Window from "./src/Window.js";
import { readFileSync } from "node:fs";
import Manifold from "./src/Manifold.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import { Worker } from "node:worker_threads";
import { rayTrace, renderBackground, traceWithCache } from "./src/RayTrace.js";
import { arrayEquals, CHANNELS, clamp, loop, memoize } from "./src/Utils.js";
import { GOLDEN_RATIO, MAX_CAMERA_RADIUS, MOUSE_WHEEL_FORCE } from "./src/Constants.js";
import { playSoundLoop } from "./src/Music.js";
import { imageFromString } from "./src/Fonts.js";
import Box from "./src/Box.js";

//========================================================================================
/*                                                                                      *
 *                                      GAME VARS                                       *
 *                                                                                      */
//========================================================================================

let neighbors = [];
let selectedIndex = 0;
let selectedObjects = [];
let vertexMatched = 0;
const percentageToWin = 0.1;
let totalVertices = undefined;
let vertex2Win = undefined;
let finalTime = 0;

//========================================================================================
/*                                                                                      *
 *                                      SCENE SETUP                                     *
 *                                                                                      */
//========================================================================================


const width = 640;
const height = 480;
let window = Window.ofSize(width, height);
let exposedWindow = window.exposure();
const camera = new Camera().orbit(2);
const scene = new Scene();
const backgroundImage = Image.ofPPM("./assets/index.ppm");
const meshObj = readFileSync("./assets/index.obj", { encoding: "utf-8" });
let manifold = Manifold.readObj(meshObj, "manifold")
const spheres = manifold.asSpheres();
totalVertices = spheres.length;
vertex2Win = Math.floor(percentageToWin * totalVertices);
scene.addList(spheres);

// const musicLoopHandler = playSoundLoop("./assets/index.wav");
// musicLoopHandler.play();


//========================================================================================
/*                                                                                      *
 *                                    MOUSE HANDLING                                    *
 *                                                                                      */
//========================================================================================

let rightClick = false;
let mouse = Vec2();
const canvas2ray = camera.rayFromImage(window.width, window.height);
window.onMouseDown((x, y, e) => {
    if (e.button === Window.RIGHT_CLICK) rightClick = true;
    mouse = Vec2(x, y);
    if (rightClick) return;
    exposedWindow = window.exposure();
    const hit = scene.interceptWithRay(canvas2ray(x, y))
    if (hit) {
        if (selectedIndex === 0) {
            selectedObjects[selectedIndex++] = hit[2];
            return;
        }
        if (selectedIndex === 1) {
            const hitId = hit[2].props.id;
            if (neighbors.some(x => x.props.id === hitId)) {
                selectedObjects[selectedIndex++] = hit[2];
                return;
            }
            if (selectedObjects[0].props.id === hitId) {
                neighbors = [];
                selectedIndex = 0;
                selectedObjects = [];
                return;
            }
            neighbors = [];
            selectedIndex = 1;
            selectedObjects = [hit[2]]
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
        return;
    }
    if ("return" === event.key && gameState !== GAME_STATES.LOOP) {
        gameState = GAME_STATES.LOOP;
        scene.clear();
        manifold = Manifold.readObj(meshObj, "manifold");
        scene.addList(manifold.asSpheres());
        finalTime = 0;
        vertexMatched = 0;
        isFirstTime = true;
        return;
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
 *                                    GAMEPLAY LOGIC                                    *
 *                                                                                      */
//========================================================================================


function renderGame(canvas) {
    // const render = ray => rayTrace(ray, scene, { bounces: 1, backgroundImage, selectedObjects, neighbors });
    const render = ray => traceWithCache(ray, scene, { bounces: 1, backgroundImage, selectedObjects, neighbors });
    return camera
        .rayMap(render)
        .to(canvas);
}

let isFirstTime = true;
const N = os.cpus().length;
const WORKERS = [...Array(N)].map(() => new Worker("./src/RayTraceWorker.js", { type: 'module' }));
function renderGameParallel(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    return Promise
        .all(
            WORKERS.map((worker, k) => {
                return new Promise((resolve) => {
                    worker.removeAllListeners('message');
                    worker.on("message", message => {
                        const { image, startRow, endRow, } = message;
                        let index = 0;
                        const startIndex = CHANNELS * w * startRow;
                        const endIndex = CHANNELS * w * endRow;
                        for (let i = startIndex; i < endIndex; i += CHANNELS) {
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
                vertexMatched++;
                removeSpheresWithId(sphereIds)
            });
    })
}

function gameUpdate(dt) {
    finalTime += dt;
    const graph = manifold.graph;
    if (vertexMatched > vertex2Win) {
        gameState = GAME_STATES.END;
        return;
    }
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
        exposedWindow = window.exposure();
    }
}

const titleImg = imageFromString("HyperMatch 3D");
const titleBox = new Box(Vec2(width / 10, 5 * height / 9), Vec2(9 / 10 * width, 7 * height / 9));
const startBtnImg = imageFromString("Start Demo")
const startBtnBox = new Box(Vec2(3 * width / 10, 1 * height / 9), Vec2(7 / 10 * width, 3 * height / 9));
function renderStartScreen(time) {
    const render = ray => renderBackground(ray, backgroundImage);
    window = camera
        .rayMap(render, false)
        .to(window);
    window.mapBox(
        (x, y) => {
            let p = Vec2(x, y).div(Vec2(titleBox.diagonal.x, titleBox.diagonal.y));
            const c = titleImg.getPxl(p.x, p.y);
            return c ? [1, 1, 1] : undefined
        },
        titleBox,
        false
    );
    window.mapBox(
        (x, y) => {
            let p = Vec2(x, y).div(Vec2(startBtnBox.diagonal.x, titleBox.diagonal.y));
            const c = startBtnImg.getPxl(p.x, p.y);
            if (startBtnBox.collidesWith(mouse)) {
                return c ? [0.9, 0.8, 0.1] : undefined
            } else {
                return c ?
                    [0.1, Math.abs(Math.sin(time)), Math.abs(Math.cos(time))] :
                    undefined
            }
        },
        startBtnBox,
        false
    )
    window.paint();
    if (startBtnBox.collidesWith(mouse)) {
        setTimeout(
            () => {
                gameState = GAME_STATES.LOOP
            },
            10
        );
    }
}

const endImg = imageFromString("Finished!");
const endBox = new Box(Vec2(width / 10, 5 * height / 9), Vec2(9 / 10 * width, 7 * height / 9));
const renderEndScreen = memoize((score) => {
    const scoreImg = imageFromString(`Score: ${score}`);
    const scoreBox = new Box(Vec2(0, 1 * height / 9), Vec2(width, 3 * height / 9));
    return () => {
        const render = ray => renderBackground(ray, backgroundImage);
        window = camera
            .rayMap(render, false)
            .to(window);
        window.mapBox(
            (x, y) => {
                let p = Vec2(x, y).div(Vec2(endBox.diagonal.x, endBox.diagonal.y));
                const c = endImg.getPxl(p.x, p.y);
                return c ? [1, 1, 1] : undefined
            },
            endBox,
            false
        );
        window.mapBox(
            (x, y) => {
                let p = Vec2(x, y).div(Vec2(scoreBox.diagonal.x, scoreBox.diagonal.y));
                const c = scoreImg.getPxl(p.x, p.y);
                return c ? [1, 1, 1] : undefined
            },
            scoreBox,
            false
        );
        window.paint();
    }
});

const scoreFunc = (score, time) => {
    return Math.floor(1e6 * score / time);
}

//========================================================================================
/*                                                                                      *
 *                                         MAIN                                         *
 *                                                                                      */
//========================================================================================


const params = process.argv.slice(2);
const isParallel = !params.length > 0;
const isRaster = params.length > 0 && params[0] === "-r";
const GAME_STATES = {
    START: 0,
    LOOP: 1,
    END: 2
}
let gameState = GAME_STATES.START;

// Game loop
const loopControl = loop(async (dt, time) => {
    if (gameState === GAME_STATES.START) {
        renderStartScreen(time)
    }
    if (gameState === GAME_STATES.LOOP) {
        if (isParallel) await renderGameParallel(exposedWindow);
        else if (isRaster) renderGameFast(window);
        else renderGame(exposedWindow);

        gameUpdate(dt);
        window.setTitle(`HyperMatch 3D | Vertex Matched: ${vertexMatched}/${vertex2Win} | Time: ${Math.floor(finalTime)}`);
    }
    if (gameState === GAME_STATES.END) {
        renderEndScreen(scoreFunc(vertexMatched / vertex2Win, finalTime))();
    }
    // window.setTitle(`HyperMatch 3D |FPS: ${Math.floor(1 / dt)}`);
}).play();







