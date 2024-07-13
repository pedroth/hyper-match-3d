import { clamp } from "./Utils.js";

const clamp01 = clamp(0,1);

export function rayCache(spatialGridSpacing = 0.001, directionGridSpacing = 0.0001) {
    const ray2ObjMap = {};
    const ans = {};
    ans.hash = (p, dir) => {
        const integerSpatialCoord = p.map(z => Math.floor(z / spatialGridSpacing));
        const h = (integerSpatialCoord.x * 92837111) ^ (integerSpatialCoord.y * 689287499) ^ (integerSpatialCoord.z * 283923481);

        const theta = Math.atan2(dir.y, dir.x) / (Math.PI);
        const alpha = Math.acos(-clamp01(dir.z)) / (Math.PI);

        const hDir = (Math.floor(theta / directionGridSpacing) * 9996991) ^ (Math.floor(alpha / directionGridSpacing) * 10005581);

        return Math.abs(h) * Math.abs(hDir);
    }
    ans.set = (ray, obj) => {
        const h = ans.hash(ray.init, ray.dir);
        ray2ObjMap[h] = obj;
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