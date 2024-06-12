import { readFileSync } from "fs";
import Animation from "./src/Animation.js";
import Camera from "./src/Camera.js";
import Scene from "./src/Scene.js";
import { Vec2, Vec3 } from "./src/Vector.js";
import Window from "./src/Window.js";
import Mesh from "./src/Mesh.js";
import Image from "./src/Image.js";

const width = 640;
const height = 480;
const radius = 0.05;
const window = Window.ofSize(width, height);
const camera = new Camera().orbit(5);
const scene = new Scene();

const backgroundImage = Image.ofUrl("./assets/map1.jpg");

const meshObj = readFileSync("./assets/bunny.obj", { encoding: "utf-8" });
let mesh = Mesh.readObj(meshObj, "mesh");
const meshBox = mesh.getBoundingBox();
const scale = meshBox.diagonal.fold((e, x) => Math.max(e, x), Number.MIN_VALUE);
mesh = mesh.mapVertices(v => v.sub(meshBox.center).scale(2 / scale))
scene.addList(
    mesh.asSpheres(radius, (x, i) => Math.floor(i % 1.05) !== 0)
)


//========================================================================================
/*                                                                                      *
 *                                    MOUSE HANDLING                                    *
 *                                                                                      */
//========================================================================================

let mousedown = false;
let mouse = Vec2();
window.onMouseDown((x, y) => {
    mousedown = true;
    mouse = Vec2(x, y);
})
window.onMouseUp(() => {
    mousedown = false;
    mouse = Vec2();
})
window.onMouseMove((x, y) => {
    const newMouse = Vec2(x, y);
    if (!mousedown || newMouse.equals(mouse)) {
        return;
    }
    const [dx, dy] = newMouse.sub(mouse).toArray();
    camera.orbit(orbitCoord => orbitCoord.add(
        Vec3(
            0,
            -2 * Math.PI * (dx / window.width),
            -2 * Math.PI * (dy / window.height)
        )
    ));
    mouse = newMouse;
})
window.onMouseWheel(({ dy }) => {
    camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy, 0, 0)));
})

//========================================================================================
/*                                                                                      *
 *                                       GAME LOOP                                      *
 *                                                                                      */
//========================================================================================

function render(ray) {
    const hit = scene.interceptWithRay(ray)
    if (hit) {
        const [, point, element] = hit;
        const normal = element.normalToPoint(point);
        return [
            (normal.get(0) + 1) / 2,
            (normal.get(1) + 1) / 2,
            (normal.get(2) + 1) / 2
        ]
    }
    const dir = ray.dir;
    const theta = Math.atan2(dir.y, dir.x) / (Math.PI);
    const alpha = Math.acos(-dir.z) / (Math.PI);
    // console.log(`theta: ${theta}, alpha: ${alpha}`)
    return backgroundImage.getPxl(theta * backgroundImage.width, alpha * backgroundImage.height);
}

Animation
    .loop(({ time, dt }) => {
        window.setTitle(`FPS: ${Math.floor(1 / dt)}`);
        camera.rayMap(render).to(window);
        // camera.rayMap((ray) => ray.dir.map(x => (x + 1) / 2).toArray()).to(window);
        // window.map((x, y) => [((x * time) / width) % 1, ((y * time) / height) % 1, 0]);
    })
    .play();