import sdl from "@kmamal/sdl"
import Box from "./Box.js";
import { Vec2 } from "./Vector.js";
import { MAX_8BIT } from "./Constants.js";
import { CHANNELS, clamp,  } from "./Utils.js";
import Image from "./Image.js";


const clamp01 = clamp();

export default class Window extends Image {

    constructor(width, height, title = "") {
        super(width, height)
        this._title = title;
        this._window = sdl.video.createWindow({ title, resizable: true });
        this._eventHandlers = {};
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    setTitle(title) {
        this._title = title;
        this._window.setTitle(title);
        return this;
    }

    setSize(w, h) {
        const newImage = new Float32Array(w * h * CHANNELS);
        this._image = newImage;
        this._width = w;
        this._height = h;
        this.box = new Box(Vec2(0, 0), Vec2(w, h));
        return this;
    }

    close() {
        this._window.hide();
        this._window.destroy();
        return this;
    }

    paint() {
        const buffer = Buffer.allocUnsafe(this._image.length);
        buffer.set(this._image.map(x => clamp01(x) * MAX_8BIT));
        this._window.render(this._width, this._height, this._width * CHANNELS, 'rgba32', buffer);
        return this;
    }

    onMouseDown(lambda) {
        this._eventHandlers.mouseButtonDown = lambda;
        this._window.on("mouseButtonDown", handleMouse(this, lambda));
        return this;
    }

    onMouseUp(lambda) {
        this._eventHandlers.mouseButtonUp = lambda;
        this._window.on("mouseButtonUp", handleMouse(this, lambda));
        return this;
    }

    onMouseMove(lambda) {
        this._eventHandlers.mouseMove = lambda;
        this._window.on("mouseMove", handleMouse(this, lambda));
        return this;
    }

    onMouseWheel(lambda) {
        this._eventHandlers.mouseWheel = lambda;
        this._window.on("mouseWheel", lambda);
        return this;
    }

    onKeyDown(lambda) {
        this._window.on("keyDown", lambda);
        return this;
    }

    onKeyUp(lambda) {
        this._window.on("keyDown", lambda);
        return this;
    }

    //========================================================================================
    /*                                                                                      *
     *                                    Static Methods                                    *
     *                                                                                      */
    //========================================================================================

    static ofSize(width, height) {
        return new Window(width, height);
    }

    static ofImage(image) {
        const w = image.width;
        const h = image.height;
        return Window.ofSize(w, h)
            .map((x, y) => {
                return image.get(x, y);
            })
    }

    static LEFT_CLICK = 1;
    static MIDDLE_CLICK = 2;
    static RIGHT_CLICK = 3;
}

//========================================================================================
/*                                                                                      *
 *                                   Private functions                                  *
 *                                                                                      */
//========================================================================================

function handleMouse(canvas, lambda) {
    return (e) => {
        let { x, y } = e;
        x = x / canvas._window.width;
        y = y / canvas._window.height;
        return lambda(x * canvas.width, canvas.height - 1 - y * canvas.height, e);
    }
}

