import sdl from "@kmamal/sdl"
import Box from "./Box.js";
import { Vec2 } from "./Vector.js";
import { MAX_8BIT } from "./Constants.js";
import { clamp, memoize } from "./Utils.js";
import os from 'node:os';
import { Worker } from "node:worker_threads";

const clamp01 = clamp();

export default class Window {

    constructor(width, height, title = "") {
        this._width = width;
        this._height = height;
        this._title = title;
        this._window = sdl.video.createWindow({ title, resizable: true });
        this._image = new Float32Array(this._width * this._height * 4);
        this.box = new Box(Vec2(0, 0), Vec2(this._width, this._height));
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
        const newImage = new Float32Array(w * h * 4);
        // for (let k = 0; k < newImage.length; k += 4) {
        //     const i = Math.floor(k / (4 * w));
        //     const j = Math.floor((k / 4) % w);
        //     const iOrig = (i / w) * this._width;
        //     const jOrig = (j / h) * this._height;
        //     const index = 4 * (this._width * iOrig + jOrig);
        //     newImage[k] = this._image[index];
        //     newImage[k + 1] = this._image[index + 1];
        //     newImage[k + 2] = this._image[index + 2];
        //     newImage[k + 3] = this._image[index + 3];
        // }
        this._image = newImage;
        this._width = w;
        this._height = h;
        this.box = new Box(Vec2(0, 0), Vec2(w, h));
        // Object.keys(this._eventHandlers).forEach(eventName => {
        //     if (eventName !== "mouseWheel") {
        //         this._window.on(eventName, handleMouse(this, this._eventHandlers[eventName]));
        //     }
        // })
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
        this._window.render(this._width, this._height, this._width * 4, 'rgba32', buffer);
        return this;
    }

    /**
     * lambda: (x: Number, y: Number) => [r,g,b] 
     */
    map(lambda, paint = true) {
        const n = this._image.length;
        const w = this._width;
        const h = this._height;
        for (let k = 0; k < n; k += 4) {
            const i = Math.floor(k / (4 * w));
            const j = Math.floor((k / 4) % w);
            const x = j;
            const y = h - 1 - i;
            const color = lambda(x, y);
            if (!color) continue;
            this._image[k] = color[0];
            this._image[k + 1] = color[1];
            this._image[k + 2] = color[2];
            this._image[k + 3] = 1;
        }
        if (paint) return this.paint();
        return this;
    }

    mapBox = (lambda, box, paint = true) => {
        const init = box.min;
        const end = box.max;
        const w = box.diagonal.x;
        const h = box.diagonal.y;
        for (let x = init.x; x < end.x; x++) {
            for (let y = init.y; y < end.y; y++) {
                const color = lambda(x - init.x, y - init.y);
                if (!color) continue;
                this.setPxl(x, y, color);
            }
        }
        if (paint) return this.paint();
        return this;
    }

    mapParallel = memoize((lambda, dependencies = []) => {
        const N = os.cpus().length;
        const w = this._width;
        const h = this._height;
        const fun = ({ _start_row, _end_row, _width_, _height_, _worker_id_, _vars_ }) => {
            const image = new Float32Array(4 * _width_ * (_end_row - _start_row));
            const startIndex = 4 * _width_ * _start_row;
            const endIndex = 4 * _width_ * _end_row;
            let index = 0;
            for (let k = startIndex; k < endIndex; k += 4) {
                const i = Math.floor(k / (4 * _width_));
                const j = Math.floor((k / 4) % _width_);
                const x = j;
                const y = _height_ - 1 - i;
                const color = lambda(x, y, { ..._vars_ });
                if (!color) continue;
                const [red, green, blue] = color;
                image[index] = red;
                image[index + 1] = green;
                image[index + 2] = blue;
                image[index + 3] = 1;
                index += 4;
            }
            return { image, _start_row, _end_row, _worker_id_ };
        }
        const workers = [...Array(N)].map(() => createWorker(fun, lambda, dependencies));
        return {
            run: (vars = {}) => {
                return Promise
                    .all(workers.map((worker, k) => {
                        return new Promise((resolve) => {
                            worker.removeAllListeners('message');
                            worker.on("message", (message) => {
                                const { image, _start_row, _end_row, _worker_id_ } = message;
                                let index = 0;
                                const startIndex = 4 * w * _start_row;
                                const endIndex = 4 * w * _end_row;
                                for (let i = startIndex; i < endIndex; i++) {
                                    this._image[i] = image[index];
                                    index++;
                                }
                                return resolve();
                            });
                            const ratio = Math.floor(h / N);
                            worker.postMessage({
                                _start_row: k * ratio,
                                _end_row: Math.min(h - 1, (k + 1) * ratio),
                                _width_: w,
                                _height_: h,
                                _worker_id_: k,
                                _vars_: vars
                            });
                        })
                    }))
                    .then(() => this.paint());
            }
        }
    });

    /**
     * color: Color 
     */
    fill(color) {
        if (!color) return;
        const n = this._image.length;
        for (let k = 0; k < n; k += 4) {
            this._image[k] = color[0];
            this._image[k + 1] = color[1];
            this._image[k + 2] = color[2];
            this._image[k + 3] = 1;
        }
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

    getPxl(x, y) {
        const w = this._width;
        const h = this._height;
        let [i, j] = this.canvas2grid(x, y);
        i = mod(i, h);
        j = mod(j, w);
        const index = 4 * (w * i + j);
        return [
            this._image[index],
            this._image[index + 1],
            this._image[index + 2],
            this._image[index + 3]
        ];
    }

    setPxl(x, y, color) {
        const w = this._width;
        const [i, j] = this.canvas2grid(x, y);
        const index = 4 * (w * i + j);
        this._image[index] = color[0];
        this._image[index + 1] = color[1];
        this._image[index + 2] = color[2];
        this._image[index + 3] = 1;
        return this;
    }

    setPxlData(index, [r, g, b]) {
        this._image[index] = r;
        this._image[index + 1] = g;
        this._image[index + 2] = b;
        this._image[index + 3] = 1.0;
        return this;
    }

    //========================================================================================
    /*                                                                                      *
     *                                     Window Utils                                     *
     *                                                                                      */
    //========================================================================================

    grid2canvas(i, j) {
        const h = this.height;
        const x = j;
        const y = h - 1 - i;
        return [x, y]
    }

    canvas2grid(x, y) {
        const h = this._height;
        const j = Math.floor(x);
        const i = Math.floor(h - 1 - y);
        return [i, j];
    }

    exposure(time = Number.MAX_VALUE) {
        let it = 1;
        const ans = {};
        for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
            if (descriptor && typeof descriptor.value === 'function') {
                ans[key] = descriptor.value.bind(this);
            }
        }
        ans.width = this.width;
        ans.height = this.height;
        ans.map = (lambda, paint = true) => {
            const n = this._image.length;
            const w = this._width;
            const h = this._height;
            for (let k = 0; k < n; k += 4) {
                const i = Math.floor(k / (4 * w));
                const j = Math.floor((k / 4) % w);
                const x = j;
                const y = h - 1 - i;
                const color = lambda(x, y);
                if (!color) continue;
                this._image[k] = this._image[k] + (color[0] - this._image[k]) / it;
                this._image[k + 1] = this._image[k + 1] + (color[1] - this._image[k + 1]) / it;
                this._image[k + 2] = this._image[k + 2] + (color[2] - this._image[k + 2]) / it;
                this._image[k + 3] = 1.0;
            }
            if (paint) return ans.paint();
            return ans;
        }

        ans.setPxlData = (index, [r, g, b]) => {
            this._image[index] = this._image[index] + (r - this._image[index]) / it;
            this._image[index + 1] = this._image[index + 1] + (g - this._image[index + 1]) / it;
            this._image[index + 2] = this._image[index + 2] + (b - this._image[index + 2]) / it;
            this._image[index + 3] = 1.0;
            return ans;
        }

        ans.paint = () => {
            if (it < time) it++
            return this.paint();
        }
        return ans;
    }

    //========================================================================================
    /*                                                                                      *
     *                                    Static Methods                                    *
     *                                                                                      */
    //========================================================================================

    static ofUrl(url) {
        // TODO
    }

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

const createWorker = (main, lambda, dependencies) => {
    const workerFile = `
    const { parentPort } = require("node:worker_threads");
    ${dependencies.map(d => d.toString()).join("\n")}
    const lambda = ${lambda.toString()};
    const __main__ = ${main.toString()};
    parentPort.on("message", message => {
        const output = __main__(message);
        parentPort.postMessage(output);
    });
    `;
    const worker = new Worker(workerFile, { eval: true });
    return worker;
};