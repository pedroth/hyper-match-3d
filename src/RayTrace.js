import Ray from "./Ray.js";
import { clamp, randomPointInSphere } from "./Utils.js";

const clampAcos = clamp(-1, 1);

function selectShader(ray, hit) {
    const r = hit[1].sub(hit[2].position).normalize();
    const d = ray.dir;
    let dot = Math.abs(d.dot(r));
    dot = dot * dot;
    let c = hit[2].props.color;
    return [(1 - dot) + dot * c[0], (1 - dot) + dot * c[1], (1 - dot) + dot * c[2]];
}

export function rayTrace(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage, neighbors } = options;
    // if (bounces < 0) return colorFromSelectedObjects(ray.init, scene, selectedObjects);
    if (bounces < 0) return [0, 0, 0];
    const hit = scene.interceptWithRay(ray);
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

export function renderBackground(ray, backgroundImage) {
    const dir = ray.dir;
    const theta = Math.atan2(dir.y, dir.x) / (Math.PI);
    const alpha = Math.acos(-clampAcos(dir.z)) / (Math.PI);
    return backgroundImage.getPxl(theta * backgroundImage.width, alpha * backgroundImage.height);
}

export function colorFromSelectedObjects(p, scene, selectedObjects) {
    if (selectedObjects.length <= 0) return [0, 0, 0];
    const [first] = selectedObjects;
    const pointSample = first.sample();
    const v = pointSample.sub(p);
    const dir = v.normalize();
    const hit = scene.interceptWithRay(Ray(p, dir));
    if (hit) {
        const e = hit[2];
        if (e.props.name === first.props.name) {
            return e.props.color;
        }
    }
    return [0, 0, 0];
}

const colorCache = (gridSpace, maxSamples = 1e5) => {
    const point2ColorMap = {};
    const ans = {};
    ans.hash = (p) => {
        const integerCoord = p.map(z => Math.floor(z / gridSpace));
        const h = (integerCoord.x * 92837111) ^ (integerCoord.y * 689287499) ^ (integerCoord.z * 283923481);
        return Math.abs(h);
    }
    ans.set = (p, c) => {
        const h = ans.hash(p);
        if (h in point2ColorMap) {
            const { color, samples } = point2ColorMap[h]
            const newColor = [
                color[0] + (c[0] - color[0]) / samples,
                color[1] + (c[1] - color[1]) / samples,
                color[2] + (c[2] - color[2]) / samples,
            ]
            const newSamples = samples < maxSamples ? samples + 1 : samples;
            point2ColorMap[h] = { color: newColor, samples: newSamples };
        } else {
            point2ColorMap[h] = { color: c, samples: 1 };
        }
        return ans;
    }
    ans.get = p => {
        const h = ans.hash(p);
        const cachedObj = point2ColorMap[h];
        if (!cachedObj) return undefined;
        const { color } = cachedObj
        return Math.random() < 0.5 ? color : undefined;
    }

    return ans;
}
const cache = colorCache(0.005);
export function traceWithCache(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage, neighbors } = options;
    // if (bounces < 0) return colorFromSelectedObjects(ray.init, scene, selectedObjects);
    if (bounces < 0) return [0, 0, 0];
    const hit = scene.interceptWithRay(ray)
    if (!hit) return renderBackground(ray, backgroundImage);
    const [, p, e] = hit;
    let color = e.props?.color ?? [0, 0, 0];
    if (selectedObjects.some(s => s.props.name === e.props.name)) {
        return selectShader(ray, hit);
    }
    if (neighbors.some(s => s.props.name === e.props.name)) {
        return color
    };
    const cachedColor = cache.get(p);
    if (cachedColor) return cachedColor;
    const mat = e.props?.material ?? Diffuse();
    const r = mat.scatter(ray, p, e);
    const finalC = traceWithCache(
        r,
        scene,
        { bounces: bounces - 1, selectedObjects, backgroundImage, neighbors }
    );
    const finalColor = [
        finalC[0] + finalC[0] * color[0],
        finalC[1] + finalC[1] * color[1],
        finalC[2] + finalC[2] * color[2],
    ];
    cache.set(p, finalColor);
    return finalColor;
}

export function debugCache(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage, neighbors } = options;
    if (bounces < 0) return [0, 0, 0];
    const hit = scene.interceptWithRay(ray)
    if (!hit) return [0, 0, 0]
    const [, p, e] = hit;
    let color = e.props?.color ?? [0, 0, 0];
    if (
        selectedObjects.some(s => s.props.name === e.props.name) ||
        neighbors.some(s => s.props.name === e.props.name)
    ) {
        return color
    };
    const cachedColor = cache.get(p);
    if (cachedColor) return [0, 1, 0];
    const mat = e.props?.material ?? Diffuse();
    const r = mat.scatter(ray, p, e);
    const finalC = traceWithCache(
        r,
        scene,
        { bounces: bounces - 1, selectedObjects, backgroundImage, neighbors }
    );
    const finalColor = [
        finalC[0] + finalC[0] * color[0],
        finalC[1] + finalC[1] * color[1],
        finalC[2] + finalC[2] * color[2],
    ];
    cache.set(p, finalColor);
    return [0, 0, 1];
}

export function simpleRayTrace(ray, scene) {
    const hit = scene.interceptWithRay(ray);
    if (!hit) return renderBackground(ray, backgroundImage);
    const [, , e] = hit;
    return e.props?.color ?? [0, 0, 0]
}


export function rayTraceBlur(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage, neighbors, blurSize = 0.1, step = 0, focalD = 0.5, centerRayDir } = options;
    if (bounces < 0) return [0, 0, 0];
    // if(selectedObjects.length > 0) console.log(`Distance2Selected: ${selectedObjects[0].position.sub(ray.init).length()}, focalD: ${focalD}`)
    const focalDistance = selectedObjects.length > 0 ? selectedObjects[0].position.sub(ray.init).length() : focalD;
    const endP = ray.init.add(ray.dir.scale(focalDistance / centerRayDir.dot(ray.dir)));
    const delta = randomPointInSphere(3).scale(Math.random() * blurSize);
    const deltaProj = delta.sub(centerRayDir.scale(delta.dot(centerRayDir)));
    const newInit = step === 0 ? ray.init.add(deltaProj) : ray.init;
    const newRay = Ray(newInit, endP.sub(newInit).normalize());
    const hit = scene.interceptWithRay(newRay);
    if (!hit) return renderBackground(newRay, backgroundImage);
    const [, p, e] = hit;
    // if (Math.random() < 0.9 && step === 0) {
    //     const distanceToFocalPlane = centerRayDir.dot(p.sub(ray.init))
    //     if (Math.abs(distanceToFocalPlane - focalDistance) > 1e-1) {
    //         return [Math.random(), Math.random(), Math.random()];
    //     }
    // }
    const color = e.props?.color ?? [0, 0, 0];
    if (selectedObjects.some(s => s.props.name === e.props.name)) {
        return selectShader(newRay, hit);
    }
    if (neighbors.some(s => s.props.name === e.props.name)) {
        return color
    };
    const mat = e.props?.material ?? Diffuse();
    const r = mat.scatter(newRay, p, e);
    const finalC = rayTrace(
        r,
        scene,
        { bounces: bounces - 1, selectedObjects, backgroundImage, neighbors, blurSize, step: step + 1 }
    );
    return [
        finalC[0] + finalC[0] * color[0],
        finalC[1] + finalC[1] * color[1],
        finalC[2] + finalC[2] * color[2],
    ];
}