class Graph {
    constructor() {
        this.vertices = {}; // vertices map<id, vertex>
        this.vertexNeigh = {}; // neighbor map<id, map<id, bool>>
        this.edges = {};
    }

    getVertices() {
        return Object.values(this.vertices);
    }

    getEdges() {
        return Object.values(this.edges);
    }

    addVertex(id, vertex = {}) {
        this.vertices[id] = vertex;
        this.vertices[id].id = id;
        return this;
    }

    getVertex(id) {
        return this.vertices[id];
    }

    addEdge(i, j, edge = {}) {
        const edgeIDs = [i, j];
        if (!this.getVertex(i)) return new Error(`Vertex ${i} needs to be created before adding an edge`);
        if (!this.getVertex(j)) return new Error(`Vertex ${j} needs to be created before adding an edge`);
        edgeIDs.forEach(id => {
            if (!this.vertexNeigh[id]) this.vertexNeigh[id] = {};
        })
        const edgeKeyID = edgeKey(i, j);
        this.edges[edgeKeyID] = edge;
        this.edges[edgeKeyID].id = edgeKeyID;
        this.vertexNeigh[i][j] = true;
        return this;
    }

    getEdge(i, j) {
        return this.edges[edgeKey(i, j)];
    }

    getNeighbors(i) {
        return Object.keys(this.vertexNeigh[i] ?? {});
    }

    removeVertex(i) {
        if (!this.vertices[i]) return this;
        this.getVertices().forEach(j => {
            if (j in this.vertexNeigh && i in this.vertexNeigh[j]) {
                this.removeEdge(j, i);
            }
        })
        this.getNeighbors(i).forEach(j => {
            this.removeEdge(i, j);
        })
        delete this.vertices[i];
        return this;
    }

    removeEdge(i, j) {
        const edgeKeyID = edgeKey(i, j);
        if (!this.edges[edgeKeyID]) return this;
        delete this.edges[edgeKeyID];
        return this;
    }
}

module.exports = Graph;

function edgeKey(i, j) {
    return `${i}_${j}`
}