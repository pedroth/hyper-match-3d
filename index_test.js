import { readFileSync } from "node:fs";
import Window from "./src/Window.js";
import Image from "./src/Image.js";
import Manifold from "./src/Manifold.js";
import { loop } from "./src/Utils.js";
import Game from "./src/Game.js";

const params = process.argv.slice(2);
const isParallel = !(params.length > 0 && params[0] === "-s")

const width = 640;
const height = 480;
const window = Window.ofSize(width, height);
const backgroundImage = Image.ofUrl("./assets/nasa.png");
const meshObj = readFileSync("./assets/simple_bunny.obj", { encoding: "utf-8" });
const manifold = Manifold.readObj(meshObj, "manifold")

// Game
let game = Game({
    window,
    backgroundImage,
    manifold
});

// Game loop:
const loopHandle = loop((dt, time) => {
    if (isParallel) game.parallelRender();
    else game.render();
    game = game.update(dt, time);
});
gameState.onExit(() => loopHandle.stop())