import Camera from "./Camera.js";
import Image from "./Image.js";
import { renderBackground, selectShader } from "./RayTrace.js";
import Scene from "./Scene.js"
import Sphere from "./Sphere.js";
import { parentPort } from "node:worker_threads";

let scene;
let backgroundImage;

function main(inputs) {
    const {
        width,
        height,
        endRow,
        params,
        startRow,
        isFirstTime,
        camera: serializedCamera,
        selectedObjects: serializedSelectedObjects,
        neighbors: serializedNeighbors
    } = inputs;
    if (isFirstTime) {
        const {
            scene: serializedScene,
            backgroundImage: serializedBackgroundImage,
        } = inputs;
        scene = Scene.deserialize(serializedScene).rebuild();
        backgroundImage = Image.deserialize(serializedBackgroundImage);
    }
    const camera = Camera.deserialize(serializedCamera);
    const rayGen = camera.rayFromImage(width, height);
    const selectedObjects = serializedSelectedObjects.map(x => Sphere.deserialize(x));
    const neighbors = serializedNeighbors.map(x => Sphere.deserialize(x));
    const bufferSize = width * (endRow - startRow + 1) * 4;
    const image = new Float32Array(bufferSize);
    const bounces = params.bounces;
    let index = 0;
    // the order does matter
    for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < width; x++) {
            const ray = rayGen(x, height - 1 - y)
            // const [red, green, blue] = traceWithCache(ray, scene, { bounces, backgroundImage, selectedObjects, neighbors});
            const [red, green, blue] = rayTrace(ray, scene, { bounces, backgroundImage, selectedObjects, neighbors});
            // const [red, green, blue] = simpleTrace(ray, scene, { bounces, backgroundImage, selectedObjects, neighbors });
            image[index++] = red;
            image[index++] = green;
            image[index++] = blue;
            image[index++] = 1.0;
        }
    }
    return { image, startRow, endRow };
}

parentPort.on("message", message => {
    const input = message;
    const output = main(input);
    parentPort.postMessage(output);
});

let PREV_OBJ = undefined;
function simpleTrace(ray, scene, options) {
    const { selectedObjects, backgroundImage, neighbors } = options;
    let hit;
    if (PREV_OBJ) hit = PREV_OBJ.interceptWithRay(ray);
    if (!hit) hit = scene.interceptWithRay(ray);
    if (!hit) return renderBackground(ray, backgroundImage);
    const [, , e] = hit;
    PREV_OBJ = e;
    const color = e.props?.color ?? [0, 0, 0];
    if (selectedObjects.some(s => s.props.name === e.props.name)) {
        return selectShader(ray, hit);
    }
    if (neighbors.some(s => s.props.name === e.props.name)) {
        return color
    };
    return color;
}

export function rayTrace(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage, neighbors } = options;
    if (bounces < 0) return [0, 0, 0];
    let hit;
    if (PREV_OBJ && bounces >= 1) {
        hit = PREV_OBJ.interceptWithRay(ray);
    }
    if (!hit && bounces >= 1) {
        hit = scene.interceptWithRay(ray);
        if (hit) PREV_OBJ = hit[2];
    }
    if (!hit) hit = scene.interceptWithRay(ray);
    if (!hit) return renderBackground(ray, backgroundImage);
    const [, p, e] = hit;
    const color = e.props?.color ?? [0, 0, 0];
    if (selectedObjects.some(s => s.props.name === e.props.name)) {
        return selectShader(ray, hit);
    }
    if (neighbors.some(s => s.props.name === e.props.name)) {
        return color
    };
    const mat = e.props?.material ?? Diffuse();
    const r = mat.scatter(ray, p, e);
    const finalC = rayTrace(
        r,
        scene,
        { bounces: bounces - 1, selectedObjects, backgroundImage, neighbors }
    );
    return [
        finalC[0] + finalC[0] * color[0],
        finalC[1] + finalC[1] * color[1],
        finalC[2] + finalC[2] * color[2],
    ];
}
