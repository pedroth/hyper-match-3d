import Box from "./Box.js";
import { MAX_8BIT } from "./Constants.js";
import { Vec2 } from "./Vector.js";
import { clamp, mod } from "./Utils.js";
import { unlinkSync, readFileSync } from "fs";
import { execSync } from "child_process";

const clamp01 = clamp();


export default class Image {

    constructor(width, height) {
        this._width = width;
        this._height = height;
        this._image = new Float32Array(this._width * this._height * 4);
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
    * lambda: (x: Number, y: Number) => [r,g,b] 
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

    /**
     * color: Color 
     */
    fill(color) {
        return this.map(() => color);
    }

    setPxl(x, y, color) {
        const w = this._width;
        const [i, j] = this.canvas2grid(x, y);
        let index = 4 * (w * i + j);
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
        let index = 4 * (w * i + j);
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
                if (!color) continue;
                this._image[k] = this._image[k] + (color.red - this._image[k]) / it;
                this._image[k + 1] = this._image[k + 1] + (color.green - this._image[k + 1]) / it;
                this._image[k + 2] = this._image[k + 2] + (color.blue - this._image[k + 2]) / it;
                this._image[k + 3] = 1;
            }
            if (it < time) it++
            return this.paint();
        }
        return ans;
    }

    toArray() {
        const imageData = new Uint8Array(this._width * this._height * 4);
        const n = this._image.length;
        for (let k = 0; k < n; k += 4) {
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