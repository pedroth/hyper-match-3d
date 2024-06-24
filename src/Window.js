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
        for (let k = 0; k < newImage.length; k += 4) {
            const i = Math.floor(k / (4 * w));
            const j = Math.floor((k / 4) % w);
            const iOrig = Math.floor(i / h) * this._height;
            const jOrig = Math.floor(j / w) * this._width;
            const index = w * iOrig + jOrig;
            newImage[k] = this._image[index];
            newImage[k + 1] = this._image[index + 1];
            newImage[k + 2] = this._image[index + 2];
            newImage[k + 3] = this._image[index + 3];
        }
        this._image = newImage;
        this._width = w;
        this._height = h;
        this.box = new Box(Vec2(0, 0), Vec2(this._width, this._height));
        Object.keys(this._eventHandlers).forEach(eventName => {
            if (eventName !== "mouseWheel") {
                this._window.on(eventName, handleMouse(this, this._eventHandlers[eventName]));
            }
        })
        return this;
    }

    paint() {
        const buffer = Buffer.allocUnsafe(this._image.length);
        buffer.set(this._image.map(x => clamp01(x) * MAX_8BIT));
        this._window.render(this._width, this._height, this._width * 4, 'rgba32', buffer);
        return this;
    }

    /**
     * lambda: (x: Number, y: Number) => Color 
     */
    map(lambda) {
        const n = this._image.length;
        const w = this._width;
        const h = this._height;
        for (let k = 0; k < n; k += 4) {
            const i = Math.floor(k / (4 * w));
            const j = Math.floor((k / 4) % w);
            const x = j;
            const y = h - 1 - i;
            const color = lambda(x, y);
            if (!color) return;
            this._image[k] = color[0];
            this._image[k + 1] = color[1];
            this._image[k + 2] = color[2];
            this._image[k + 3] = 1;
        }
        return this.paint();
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
                if (!color) return;
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
                return new Promise((resolve) => {
                    const allWorkersDone = [...Array(N)].fill(false);
                    workers.forEach((worker, k) => {
                        worker.on("message", (message) => {
                            const { image, _start_row, _end_row, _worker_id_ } = message;
                            let index = 0;
                            const startIndex = 4 * w * _start_row;
                            const endIndex = 4 * w * _end_row;
                            for (let i = startIndex; i < endIndex; i++) {
                                this._image[i] = image[index];
                                index++;
                            }
                            allWorkersDone[_worker_id_] = true;
                            if (allWorkersDone.every(x => x)) {
                                return resolve(this.paint());
                            }
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
                })
            }
        }
    });

    /**
     * color: Color 
     */
    fill(color) {
        this._image.fill(color);
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

    drawLine(p1, p2, shader) {
        const w = this._width;
        const h = this._height;
        const line = clipLine(p1, p2, this.box);
        if (line.length <= 1) return;
        const [pi, pf] = line;
        const v = pf.sub(pi);
        const n = v.map(Math.abs).fold((e, x) => e + x);
        for (let k = 0; k < n; k++) {
            const s = k / n;
            const lineP = pi.add(v.scale(s)).map(Math.floor);
            const [x, y] = lineP.toArray();
            const j = x;
            const i = h - 1 - y;
            const index = w * i + j;
            const color = shader(x, y);
            if (!color) continue;
            this._image[index] = color;
        }
        return this;
    }

    drawTriangle(x1, x2, x3, shader) {
        return drawConvexPolygon(this, [x1, x2, x3], shader);
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
        for (let key of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
            if (descriptor && typeof descriptor.value === 'function') {
                ans[key] = descriptor.value.bind(this);
            }
        }
        ans.width = this.width;
        ans.height = this.height;
        ans.map = (lambda) => {
            const n = this._image.length;
            const w = this._width;
            const h = this._height;
            for (let k = 0; k < n; k += 4) {
                const i = Math.floor(k / (4 * w));
                const j = Math.floor((k / 4) % w);
                const x = j;
                const y = h - 1 - i;
                const color = lambda(x, y);
                if (!color) return;
                this._image[k] = this._image[k] + (color[0] - this._image[k]) / it;
                this._image[k + 1] = this._image[k + 1] + (color[1] - this._image[k + 1]) / it;
                this._image[k + 2] = this._image[k + 2] + (color[2] - this._image[k + 2]) / it;
                this._image[k + 3] = 1;
            }
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
        return lambda(x * canvas.width, canvas.height - 1 - y * canvas.height);
    }
}

const createWorker = (main, lambda, dependencies) => {
    const workerFile = `
    const {parentPort} = require("worker_threads")
    const MAX_8BIT=${MAX_8BIT};
    ${dependencies.map(d => d.toString()).join("\n")}
    const lambda = ${lambda.toString()};
    const __main__ = ${main.toString()};
    parentPort.on("message", message => {
        const output = __main__(message);
        parentPort.postMessage(output);
    });
    `;
    const worker = new Worker(workerFile, { eval: true });
    // worker.setMaxListeners(50);
    return worker;
};