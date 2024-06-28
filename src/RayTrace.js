import Ray from "./Ray.js";
import { clamp } from "./Utils.js";

const clampAcos = clamp(-1, 1);

export function rayTrace(ray, scene, options) {
    const { bounces, selectedObjects, backgroundImage } = options;
    if (bounces < 0) return colorFromSelectedObjects(ray.init, scene, selectedObjects);
    const hit = scene.interceptWithRay(ray);
    if (!hit) return renderBackground(ray, backgroundImage);
    const [, p, e] = hit;
    const color = e.props?.color ?? [0, 0, 0];
    console.log(">>>>", e.props.name === selectedObjects[0]);
    if (selectedObjects.length > 0 && e.props.name === selectedObjects[0]) return color;
    const mat = e.props?.material ?? Diffuse();
    const r = mat.scatter(ray, p, e);
    const finalC = rayTrace(
        r,
        scene,
        { bounces: bounces - 1, selectedObjects, backgroundImage }
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
        if (e === first) {
            return e.props.color;
        }
    }
    return [0, 0, 0];
}