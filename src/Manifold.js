import Graph from "./Graph.js";
import { Diffuse } from "./Material.js";
import Scene from "./Scene.js";
import Sphere from "./Sphere.js";
import { groupBy } from "./Utils.js";
import { Vec3 } from "./Vector.js";


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
const GAME_COLORS_KEYS = Object.keys(GAME_COLORS);
const GAME_COLORS_KEY_INDEXES = Object.keys(GAME_COLORS).map((_, i) => i);

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
        this._graph = differentColorGraph(this._graph);
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

    asSpheres() {
        return this.graph.getVertices().map(x => x.sphere);
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

function getEdgeId(edge) {
    return edge.sort((a, b) => a - b).join("_");
}

function getFaceId(face) {
    return face.vertices.sort((a, b) => a - b).join("_");
}

function edgesFromFace(face) {
    const { vertices } = face;
    return [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]];
}

function createDualGraph(vertices, faces) {
    // create dual graph of faces;
    const graph = new Graph();
    const edgeMap = {};
    faces.forEach(fi => {
        const primalEdges = edgesFromFace(fi);
        primalEdges.forEach(edge => {
            const edgeKey = getEdgeId(edge);
            if (!(edgeKey in edgeMap)) {
                edgeMap[edgeKey] = [];
            }
            edgeMap[edgeKey].push({ edge, face: fi });
        })
    })

    Object.keys(edgeMap)
        .forEach(edgeKeys => {
            const edges = edgeMap[edgeKeys];
            if (edges.length >= 2) {
                const [edgeObjI, edgeObjJ] = edges;
                const fi = edgeObjI.face;
                const fj = edgeObjJ.face;
                const i = getFaceId(fi);
                const j = getFaceId(fj);
                graph.addVertex(i, { sphere: getSphereFromFace(fi.vertices.map(x => vertices[x]), i) })
                graph.addVertex(j, { sphere: getSphereFromFace(fj.vertices.map(x => vertices[x]), j) })
                graph.addEdge(i, j);
                graph.addEdge(j, i);
            }
        })
    return graph;
}

function getSphereFromFace(triangle, id) {
    const [p1, p2, p3] = triangle;
    const barycentric = p1.scale(1 / 3).add(p2.scale(1 / 3)).add(p3.scale(1 / 3));
    let radiusAverage = 0;
    let minRadius = Number.MAX_VALUE;
    for (let i = 0; i < triangle.length; i++) {
        const radius = barycentric.sub(
            triangle[i]
                .add(triangle[(i + 1) % triangle.length])
                .scale(0.5)
        )
            .length();
        radiusAverage += radius;
        minRadius = Math.min(minRadius, radius);

    }
    const colorKey = GAME_COLORS_KEY_INDEXES[Math.floor(Math.random() * GAME_COLORS_KEYS.length)];
    return new Sphere(
        barycentric,
        // radiusAverage / triangle.length,
        // 0.025,
        minRadius,
        {
            id: id,
            name: `sphere_${id}`,
            colorIndex: colorKey,
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


function differentColorGraph(graph) {
    const vertexStack = [];
    const verifiedVertexId = new Set();
    const vertices = graph.getVertices();
    vertexStack.push(vertices[0]);
    while (vertexStack.length > 0) {
        const v = vertexStack.pop();
        const vColorIndex = v.sphere.props.colorIndex;
        const neighbors = graph.getNeighbors(v.id);
        const neighborColors = neighbors.map(u => graph.getVertex(u).sphere.props.colorIndex);
        neighbors.forEach(u => {
            if (!verifiedVertexId.has(u)) {
                vertexStack.push(graph.getVertex(u));
            }
        })
        const fixedColorIndex = fixVertexColor(vColorIndex, neighborColors);
        v.sphere.props.colorIndex = fixedColorIndex;
        v.sphere.props.color = GAME_COLORS[GAME_COLORS_KEYS[fixedColorIndex]];
        verifiedVertexId.add(v.id);
    }
    return graph;
}

function fixVertexColor(colorIndex, colorIndexes) {
    let isDifferentColors = true;
    colorIndexes.forEach((cI) => isDifferentColors = isDifferentColors && cI !== colorIndex);
    if (isDifferentColors) return colorIndex;
    /**
     * Each color is indexed by an index, so each color can be represented by 1 hot encoding
     * as binary. Eg. 010000 = 1, 001000 = 2, ...
     */
    const colorBit = 1 << colorIndex; // encode vertex color
    const colorBites = colorIndexes.map(c => 1 << c); // encode neighbor colors
    // accumulate neighbor colors
    let bitAcc = colorBit;
    colorBites.forEach(b => {
        bitAcc = bitAcc | b;
    });
    const k = GAME_COLORS_KEYS.reduce((e, _, i) => e | 1 << i, 0);
    const availableColorBites = k ^ bitAcc; // available colors
    let availableColorIndex = 0;
    for (let i = 0; i < GAME_COLORS_KEYS.length; i++) {
        if ((availableColorBites >> i & 0x1) === 1) {
            availableColorIndex = i;
            break;
        }
    }
    return availableColorIndex;
}

function equalsColor(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i]) return false;
    return true;
}