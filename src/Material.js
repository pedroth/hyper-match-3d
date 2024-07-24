const Ray = require('./Ray.js');
const { randomPointInSphere } = require('./Utils.js');

function Diffuse() {
    return {
        scatter(inRay, point, element) {
            const normal = element.normalToPoint(point);
            const randomInSphere = randomPointInSphere(3);
            if (randomInSphere.dot(normal) >= 0) return Ray(point, randomInSphere);
            return Ray(point, randomInSphere.scale(-1));
        }
    }
}

function Metallic(fuzz = 0) {
    return {
        scatter(inRay, point, element) {
            fuzz = Math.min(1, Math.max(0, fuzz));
            const normal = element.normalToPoint(point);
            const v = inRay.dir;
            let reflected = v.sub(normal.scale(2 * v.dot(normal)));
            reflected = reflected.add(randomPointInSphere(3).scale(fuzz)).normalize();
            return Ray(point, reflected);
        }
    }
}

function Alpha(alpha = 1) {
    return {
        scatter(inRay, point, element) {
            if (Math.random() <= alpha) return Diffuse().scatter(inRay, point, element);
            const v = point.sub(inRay.init);
            let t = undefined
            if (inRay.dir.x !== 0) t = v.x / inRay.dir.x;
            if (inRay.dir.y !== 0) t = v.y / inRay.dir.y;
            if (inRay.dir.z !== 0) t = v.z / inRay.dir.z;
            return Ray(inRay.trace(t + 1e-2), inRay.dir);
        }
    }
}

function DiElectric(indexOfRefraction = 1.0) {
    return {
        scatter(inRay, point, element) {
            const p = point.sub(inRay.init);
            let t = undefined
            if (inRay.dir.x !== 0) t = p.x / inRay.dir.x;
            if (inRay.dir.y !== 0) t = p.y / inRay.dir.y;
            if (inRay.dir.z !== 0) t = p.z / inRay.dir.z;

            const isInside = element.isInside(point);
            const refractionRatio = isInside ? indexOfRefraction : 1 / indexOfRefraction;
            const vIn = inRay.dir;
            const n = element.normalToPoint(point).scale(-1);
            const cosThetaIn = Math.min(1, vIn.dot(n));
            const sinThetaIn = Math.sqrt(1 - cosThetaIn * cosThetaIn);
            const sinThetaOut = refractionRatio * sinThetaIn;
            if (sinThetaOut > 1) {
                // reflect
                const vOut = vIn.sub(n.scale(-2 * cosThetaIn));
                return Ray(inRay.trace(t + 1e-2), vOut);
            }
            // refract
            const cosThetaOut = Math.sqrt(1 - sinThetaOut * sinThetaOut)
            const vp = n.scale(cosThetaIn);
            const vo = vIn.sub(vp).normalize();
            const vOut = n.scale(cosThetaOut).add(vo.scale(sinThetaOut));

            return Ray(inRay.trace(t + 1e-2), vOut);
        }
    }
}

module.exports = {
    Diffuse,
    Metallic,
    Alpha,
    DiElectric
}