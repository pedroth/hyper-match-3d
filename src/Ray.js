import { clamp } from "./Utils.js";

const clamp01 = clamp(0, 1);

export function rayCache(spatialGridSpacing = 0.01, directionGridSpacing = 0.01, maxSize = 1e4) {
    const ray2ObjMap = {};
    let size = 0;
    const ans = {};
    ans.hash = (p, dir) => {
        const integerSpatialCoord = p.map(z => Math.floor(z / spatialGridSpacing));
        const h = (integerSpatialCoord.x * 92837111) ^ (integerSpatialCoord.y * 689287499) ^ (integerSpatialCoord.z * 283923481);

        const integerDirCoord = dir.map(z => Math.floor(z / directionGridSpacing));
        const hDir = (integerDirCoord.x * 9996991) ^ (integerDirCoord.y * 10005581) ^ (integerDirCoord.z * 689287499);

        return Math.abs(h) * Math.abs(hDir);
    }
    ans.set = (ray, obj) => {
        if (size > maxSize) return;
        const h = ans.hash(ray.init, ray.dir);
        ray2ObjMap[h] = obj;
        size++;
        return ans;
    }

    ans.get = ray => {
        const h = ans.hash(ray.init, ray.dir);
        return ray2ObjMap[h];
    }
    return ans;
}

export default function Ray(init, dir) {
    const ans = {};
    ans.init = init;
    ans.dir = dir;
    ans.trace = t => init.add(dir.scale(t));
    ans.dirInv = dir.map(x => 1 / x);
    return ans;
}