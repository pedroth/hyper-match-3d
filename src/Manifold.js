import Graph from "./Graph.js";
import { Diffuse } from "./Material.js";
import Scene from "./Scene.js";
import Sphere from "./Sphere.js";
import { groupBy, measureTime } from "./Utils.js";
import Vec, { Vec3 } from "./Vector.js";


//========================================================================================
/*                                                                                      *
 *                                       CONSTANTS                                      *
 *                                                                                      */
//========================================================================================

let MANIFOLD_COUNTER = 0;
const GAME_COLORS = {
    RED: [1, 0, 0],
    GREEN: [0, 1, 0],
    BLUE: [0, 0, 1],
    YELLOW: [1, 1, 0],
    CYAN: [0, 1, 1],
    MAGENTA: [1, 1, 0],
    ORANGE: [1, 0.5, 0],
    PURPLE: [0.5, 0.1, 1],
}

//========================================================================================
/*                                                                                      *
 *                                      MAIN CLASS                                      *
 *                                                                                      */
//========================================================================================

export default class Manifold {
    constructor({ name, vertices, faces }) {
        this.name = name ?? `Manifold_${MANIFOLD_COUNTER++}`;
        this.props = { name: this.name }
        this.vertices = normalizeVertices(vertices);
        this.faces = faces;
        return this;
    }

    _initMesh() {
        if (this._meshScene) return this;
        this._meshScene = new Scene();
        this._meshScene.addList(this.graph.getVertices().map(x => x.sphere));
        this._meshScene.rebuild();
        return this;
    }

    _initGraph() {
        if (this._graph) return this;
        this._graph = createDualGraph(this.vertices, this.faces);
        return this;
    }

    get graph() {
        this._initGraph();
        return this._graph;
    }

    get meshScene() {
        this._initMesh();
        return this._meshScene;
    }

    getBoundingBox() {
        if (this.boundingBox) return this.boundingBox;
        this.boundingBox = this.meshScene.boundingBoxScene.box;
        return this.boundingBox;
    }

    distanceToPoint(x) {
        return this.meshScene.distanceToPoint(x);
    }

    normalToPoint(x) {
        throw Error("No implementation");
    }

    interceptWithRay(ray) {
        return this.meshScene.interceptWithRay(ray);
    }

    distanceOnRay(ray) {
        return this.meshScene.distanceOnRay(ray);
    }

    mapVertices(lambda) {
        const newVertices = [];
        for (let i = 0; i < this.vertices.length; i++) {
            newVertices.push(lambda(this.vertices[i]));
        }
        return new Manifold({
            name: this.name,
            vertices: newVertices,
            faces: this.faces,
        })
    }

    static readObj(objFile, name) {
        const vertices = [];
        const faces = [];
        const lines = objFile.split(/\n|\r/);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const spaces = line.split(" ")
                .filter(x => x !== "");
            const type = spaces[0];
            if (!type) continue;
            if (type === "v") {
                // 3 numbers
                const v = spaces.slice(1, 4)
                    .map(x => Number.parseFloat(x));
                vertices.push(Vec3(...v));
                continue;
            }
            if (type === "f") {
                triangulate(spaces.slice(1))
                    .forEach(triangleIdx => {
                        faces.push(parseFace(triangleIdx))
                    })
            }
        }
        return new Manifold({ name, vertices, faces })
    }
}

//========================================================================================
/*                                                                                      *
 *                                         UTILS                                        *
 *                                                                                      */
//========================================================================================

function getFaceId(face) {
    return face.vertices.reduce((e, x) => e * (x + 1), 1);
}

function commonEdge(fi, fj) {
    const fiSet = new Set(fi.vertices);
    const fjSet = new Set(fj.vertices);
    const commonEdge = new Set();
    fiSet.forEach(x => {
        if (fjSet.has(x)) {
            commonEdge.add(x);
        }
    })
    return commonEdge.size === 2;
}

function createDualGraph(vertices, faces) {
    // create dual graph of faces;
    const graph = new Graph();
    faces.forEach(fi => {
        faces.forEach(fj => {
            if (fi === fj) return;
            if (commonEdge(fi, fj)) {
                const i = getFaceId(fi);
                const j = getFaceId(fj);
                graph.addVertex(i, { id: i, sphere: getSphereFromFace(fi.vertices.map(x => vertices[x]), i) })
                graph.addVertex(j, { id: j, sphere: getSphereFromFace(fj.vertices.map(x => vertices[x]), j) })
                graph.addEdge(i, j);
            }
        })
    })
    return graph;
}

function getSphereFromFace(triangle, id) {
    const [p1, p2, p3] = triangle;
    const barycentric = p1.scale(1 / 3).add(p2.scale(1 / 3)).add(p3.scale(1 / 3));
    let radiusAverage = 0;
    for (let i = 0; i < triangle.length; i++) {
        radiusAverage +=
            barycentric.sub(
                triangle[i]
                    .add(triangle[(i + 1) % triangle.length])
                    .scale(0.5)
            )
                .length();
    }
    return new Sphere(
        barycentric,
        radiusAverage / triangle.length,
        {
            name: `sphere_${id}`,
            color: GAME_COLORS[Math.floor(Math.random() * GAME_COLORS.length)],
            material: Diffuse()
        }
    );

}

function triangulate(polygon) {
    if (polygon.length === 3) {
        return [polygon];
    }
    if (polygon.length === 4) {
        return [
            [polygon[0], polygon[1], polygon[2]],
            [polygon[2], polygon[3], polygon[0]]
        ]
    }
}

function parseFace(vertexInfo) {
    const facesInfo = vertexInfo
        .flatMap(x => x.split("/"))
        .map(x => Number.parseFloat(x));
    const length = facesInfo.length;
    const lengthDiv3 = Math.floor(length / 3);
    // vertex_index/texture_index/normal_index
    const group = groupBy(facesInfo, (_, i) => i % lengthDiv3);
    const face = { vertices: [] }
    Object.keys(group).map(k => {
        k = Number.parseInt(k);
        const indices = group[k].map(x => x - 1);
        if (k === 0) face.vertices = indices;
    });
    return face;
}


function normalizeVertices(vertices) {
    let min = Vec3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    let max = Vec3(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
    vertices.forEach(v => {
        min = min.op(v, Math.min);
        max = max.op(v, Math.max);

    })
    const diagonal = max.sub(min);
    const center = min.add(diagonal.scale(0.5));
    const scale = diagonal.fold((e, x) => Math.max(e, x), Number.MIN_VALUE);
    return vertices
        .map(v => v.sub(center).scale(1 / scale))
        .map(v => Vec3(-v.x, v.z, v.y));
}