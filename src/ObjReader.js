export function readObj(objFile) {
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
            continue;
        }
    }
    return { vertices, faces };
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
    const face = { vertices: [], textures: [], normals: [] }
    Object.keys(group).map(k => {
        k = Number.parseInt(k);
        const indices = group[k].map(x => x - 1);
        if (k === 0) face.vertices = indices;
        if (k === 1) face.textures = indices;
        if (k === 2) face.normals = indices;
    });
    return face;
}