const Box = require('./Box.js');
const { Diffuse, Metallic } = require('./Material.js');
const { randomPointInSphere } = require('./Utils.js');
const {default: Vec} = require('./Vector.js');


class Sphere {
    constructor(position, radius, props = {}) {
        this.radius = radius;
        this.position = position;
        this.props = props;
    }

    setPosition(pos) {
        this.position = pos;
        // re-do bounding box
        this.boundingBox = undefined;
    }

    setRadius(r) {
        this.radius = r;
        // re-do bounding box
        this.boundingBox = undefined;
    }

    getBoundingBox() {
        if (this.boundingBox) return this.boundingBox;
        const n = this.position.dim;
        this.boundingBox = new Box(
            this.position.add(Vec.ONES(n).scale(-this.radius)),
            this.position.add(Vec.ONES(n).scale(this.radius))
        );
        return this.boundingBox;
    }

    distanceToPoint(p) {
        return this.position.sub(p).length() - this.radius;
    }

    normalToPoint(p) {
        const r = p.sub(this.position);
        const length = r.length();
        return length > this.radius ? r.normalize() : r.scale(-1).normalize();
    }

    interceptWithRay(ray) {
        const epsilon = 1e-9;
        const t = sphereInterception(this, ray);
        return !t ? undefined : [t, ray.trace(t - epsilon), this];
    }

    sample() {
        return randomPointInSphere(this.position.dim).scale(this.radius).add(this.position);
    }

    isInside(p) {
        return p.sub(this.position).length() < this.radius;
    }

    serialize() {
        return {
            type: Sphere.name,
            radius: this.radius,
            position: this.position.toArray(),
            props: serializeProps(this.props)
        }
    }

    static deserialize(json) {
        return new Sphere(Vec.fromArray(json.position), json.radius, deserializeProps(json.props));
    }

}

function serializeProps(props) {
    return { color: props.color, name: props.name };
}

function deserializeProps(props) {
    return {
        color: props.color,
        name: props.name,
        material: Diffuse()
    }
}

function sphereInterception(point, ray) {
    const { init, dir } = ray;
    const diff = init.sub(point.position);
    const b = 2 * dir.dot(diff);
    const c = diff.squareLength() - point.radius * point.radius;
    const discriminant = b * b - 4 * c; // a = 1
    if (discriminant < 0) return;
    const sqrt = Math.sqrt(discriminant);
    const [t1, t2] = [(-b - sqrt) / 2, (-b + sqrt) / 2];
    const t = Math.min(t1, t2);
    const tM = Math.max(t1, t2);
    if (t1 * t2 < 0) return tM;
    return t1 >= 0 && t2 >= 0 ? t : undefined;
}

module.exports = Sphere;