import os from 'node:os';
import Box from "./Box.js";
import { Vec2 } from "./Vector.js";
import { execSync } from "child_process";
import { MAX_8BIT } from "./Constants.js";
import { Worker } from "node:worker_threads";
import { unlinkSync, readFileSync } from "fs";
import { CHANNELS, clamp, mod, memoize } from "./Utils.js";

const clamp01 = clamp();
export default class Image {

    constructor(width, height) {
        this._width = width;
        this._height = height;
        this._image = new Float32Array(this._width * this._height * CHANNELS);
        this.box = new Box(Vec2(0, 0), Vec2(this._width, this._height))
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    paint() {
        // to implement the same interface as canvas
        return this;
    }

    /**
    * color: Color 
    */
    fill(color) {
        if (!color) return;
        const n = this._image.length;
        for (let k = 0; k < n; k += CHANNELS) {
            this._image[k] = color[0];
            this._image[k + 1] = color[1];
            this._image[k + 2] = color[2];
            this._image[k + 3] = 1;
        }
    }

    getPxl(x, y) {
        const w = this._width;
        const h = this._height;
        let [i, j] = this.canvas2grid(x, y);
        i = mod(i, h);
        j = mod(j, w);
        let index = CHANNELS * (w * i + j);
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
        let index = CHANNELS * (w * i + j);
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

    /**
    * lambda: (x: Number, y: Number) => [r,g,b] 
    * paint: boolean
    */
    map(lambda, paint = true) {
        const n = this._image.length;
        const w = this._width;
        const h = this._height;
        for (let k = 0; k < n; k += CHANNELS) {
            const i = Math.floor(k / (CHANNELS * w));
            const j = Math.floor((k / CHANNELS) % w);
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
            const image = new Float32Array(CHANNELS * _width_ * (_end_row - _start_row));
            const startIndex = CHANNELS * _width_ * _start_row;
            const endIndex = CHANNELS * _width_ * _end_row;
            let index = 0;
            for (let k = startIndex; k < endIndex; k += CHANNELS) {
                const i = Math.floor(k / (CHANNELS * _width_));
                const j = Math.floor((k / CHANNELS) % _width_);
                const x = j;
                const y = _height_ - 1 - i;
                const color = lambda(x, y, { ..._vars_ });
                if (!color) continue;
                const [red, green, blue] = color;
                image[index] = red;
                image[index + 1] = green;
                image[index + 2] = blue;
                image[index + 3] = 1;
                index += CHANNELS;
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
                                const startIndex = CHANNELS * w * _start_row;
                                const endIndex = CHANNELS * w * _end_row;
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
     *                                      Image Utils                                     *
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
            for (let k = 0; k < n; k += CHANNELS) {
                const i = Math.floor(k / (CHANNELS * w));
                const j = Math.floor((k / CHANNELS) % w);
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

    toArray() {
        const imageData = new Uint8Array(this._width * this._height * CHANNELS);
        const n = this._image.length;
        for (let k = 0; k < n; k += CHANNELS) {
            imageData[k] = clamp01(this._image[k]) * MAX_8BIT;
            imageData[k + 1] = clamp01(this._image[k + 1]) * MAX_8BIT;
            imageData[k + 2] = clamp01(this._image[k + 2]) * MAX_8BIT;
            imageData[k + 3] = MAX_8BIT;
        }
        return imageData;
    }

    serialize() {
        return { width: this.width, height: this.height, image: this._image }
    }

    //========================================================================================
    /*                                                                                      *
     *                                    Static Methods                                    *
     *                                                                                      */
    //========================================================================================

    static deserialize(json) {
        const img = new Image(json.width, json.height);
        img._image = json.image;
        return img;
    }

    static ofUrl(url) {
        const { fileName } = getFileNameAndExtensionFromAddress(url);
        execSync(`ffmpeg -i ${url} ${fileName}.ppm`);
        const imageFile = readFileSync(`${fileName}.ppm`);
        const { width: w, height: h, pixels } = parsePPM(imageFile);
        unlinkSync(`${fileName}.ppm`);
        const img = Image.ofSize(w, h);
        for (let k = 0; k < pixels.length; k++) {
            const { r, g, b } = pixels[k];
            const i = Math.floor(k / w);
            const j = k % w;
            const x = j;
            const y = h - 1 - i;
            img.setPxl(x, y, [r / MAX_8BIT, g / MAX_8BIT, b / MAX_8BIT]);
        }
        return img;
    }

    static ofPPM(path) {
        const imageFile = readFileSync(path);
        const { width: w, height: h, pixels } = parsePPM(imageFile);
        const img = Image.ofSize(w, h);
        for (let k = 0; k < pixels.length; k++) {
            const { r, g, b } = pixels[k];
            const i = Math.floor(k / w);
            const j = k % w;
            const x = j;
            const y = h - 1 - i;
            img.setPxl(x, y, [r / MAX_8BIT, g / MAX_8BIT, b / MAX_8BIT]);
        }
        return img;
    }

    static ofSize(width, height) {
        return new Image(width, height);
    }

    static ofImage(image) {
        const w = image.width;
        const h = image.height;
        return Image.ofSize(w, h)
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

function drawConvexPolygon(canvas, positions, shader) {
    const { width, height } = canvas;
    const canvasBox = canvas.box;
    let boundingBox = Box.EMPTY;
    positions.forEach((x) => {
        boundingBox = boundingBox.add(new Box(x, x));
    });
    const finalBox = canvasBox.intersection(boundingBox);
    if (finalBox.isEmpty) return canvas;
    const [xMin, yMin] = finalBox.min.toArray();
    const [xMax, yMax] = finalBox.max.toArray();

    const isInsideFunc = isInsideConvex(positions);
    for (let x = xMin; x < xMax; x++) {
        for (let y = yMin; y < yMax; y++) {
            if (isInsideFunc(Vec2(x, y))) {
                const j = x;
                const i = height - 1 - y;
                const color = shader(x, y);
                if (!color) continue;
                const index = width * i + j;
                canvas._image[index] = color;
            }
        }
    }
    return canvas;
}

function getFileNameAndExtensionFromAddress(address) {
    const lastDotIndex = address.lastIndexOf(".");
    const fileName = address.slice(0, lastDotIndex);
    const extension = address.slice(lastDotIndex + 1);
    return { fileName, extension };
}

function parsePPM(data) {
    const NEW_LINE_CHAR = 10;
    let index = 0;
    let headerLines = 3;
    // read until end of header
    while (headerLines > 0) {
        if (data[index] === NEW_LINE_CHAR) headerLines--;
        index++;
    }
    const [, width, height, maxColor] = Array.from(data.slice(0, index))
        .map(x => String.fromCharCode(x))
        .join("")
        .match(/\d+/g)
        .map(Number);

    const pixelStart = index;
    const pixels = [];
    for (let i = pixelStart; i < data.length; i += 3) {
        pixels.push({
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
        });
    }
    return { width, height, maxColor, pixels };
}


const createWorker = (main, lambda, dependencies) => {
    const workerFile = `
    const { parentPort } = require("node:worker_threads");
    const CHANNELS = ${CHANNELS};
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