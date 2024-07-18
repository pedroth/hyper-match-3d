import Camera from "./Camera.js";
import Image from "./Image.js";
import { debugCache, rayTrace, traceWithCache } from "./RayTrace.js";
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