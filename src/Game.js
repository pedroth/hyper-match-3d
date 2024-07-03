import { rayTrace } from "./RayTrace.js";

function renderGame(camera, canvas) {
    const render = ray => rayTrace(ray, scene, { bounces: 1, backgroundImage, selectedObjects });
    return camera
        .rayMap(render)
        .to(canvas);
}


export default function game({
    window,
    backgroundImage,
    manifold
}) {
    let exposedWindow = window.exposure();
    const camera = new Camera().orbit(2);
    const scene = new Scene();
    scene.addList(manifold.asSpheres())


    let mousedown = false;
    let mouse = Vec2();
    const canvas2ray = camera.rayFromImage(width, height);
    window.onMouseDown((x, y) => {
        mousedown = true;
        mouse = Vec2(x, y);
        const hit = scene.interceptWithRay(canvas2ray(x, y))
        if (hit) {
            exposedWindow = window.exposure();
            selectedObjects[selectedIndex++] = hit[2];
            if (selectedIndex === 2) {
                selectedIndex = 0;
                selectedObjects = [];
            }
        }
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
        exposedWindow = window.exposure();
    })
    window.onMouseWheel(({ dy }) => {
        camera.orbit(orbitCoord => orbitCoord.add(Vec3(-dy * 0.5, 0, 0)));
        camera.orbit(orbitCoord => Vec3(clamp(MIN_CAMERA_RADIUS, MAX_CAMERA_RADIUS)(orbitCoord.x), orbitCoord.y, orbitCoord.z))
        exposedWindow = window.exposure();
    })

    window.onKeyDown((event) => {
        loopControl.stop();
        window.close();
    })

    const ans = {
        render: () => {

        },
        parallelRender: () => {

        },
        update: (dt, time) => {

        }
    };
    return ans;
}