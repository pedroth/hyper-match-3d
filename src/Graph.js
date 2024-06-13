export default class Graph {
    constructor() {
        this.vertices = {}; // vertices map<id, vertex>
        this.vertexNeigh = {}; // neighbor map<id, list<id>>
        this.edges = {};
    }

    getVertices() {
        return Object.values(this.vertices);
    }

    addVertex(id, vertex = { id }) {
        this.vertices[id] = vertex;
        return this;
    }

    getVertex(id) {
        return this.vertices[id];
    }

    addEdge(i, j, edge = { id: edgeKey(i, j) }) {
        const edgeIDs = [i, j];
        edgeIDs.forEach(id => {
            if (!this.vertices[id]) this.addVertex(id, { id });
            if (!this.vertexNeigh[id]) this.vertexNeigh[id] = {};
        })
        this.edges[edgeKey(i, j)] = edge;
        this.vertexNeigh[i][j] = true;
        return this;
    }

    getEdge(i, j) {
        return this.edges[edgeKey(i, j)];
    }

    getNeighbors(i) {
        return Object.keys(this.vertexNeigh[i] ?? {});
    }
}

function edgeKey(i, j) {
    return `${i}_${j}`
}