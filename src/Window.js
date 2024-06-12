import sdl from "@kmamal/sdl"
import Box from "./Box.js";
import { Vec2 } from "./Vector.js";
import { MAX_8BIT } from "./Constants.js";
import Color from "./Color.js";

export default class Window {

    constructor(width, height, title = "") {
        this._width = width;
        this._height = height;
        this._title = title;
        this._window = sdl.video.createWindow({ title, resizable: true });
        this._image = Buffer.alloc(this._width * this._height * 4)
        this.box = new Box(Vec2(0, 0), Vec2(this._width, this._height))
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

    paint() {
        this._window.render(this._width, this._height, this._width * 4, 'rgba32', this._image)
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
            this._image[k] = color[0] * MAX_8BIT;
            this._image[k + 1] = color[1] * MAX_8BIT;
            this._image[k + 2] = color[2] * MAX_8BIT;
            this._image[k + 3] = MAX_8BIT;
        }
        return this.paint();
    }

    /**
     * color: Color 
     */
    fill(color) {
        this._image.fill(color);
        return this;
    }

    onMouseDown(lambda) {
        this._window.on("mouseButtonDown", handleMouse(this, lambda));
        return this;
    }

    onMouseUp(lambda) {
        this._window.on("mouseButtonUp", handleMouse(this, lambda));
        return this;
    }

    onMouseMove(lambda) {
        this._window.on("mouseMove", handleMouse(this, lambda));
        return this;
    }

    onMouseWheel(lambda) {
        this._window.on("mouseWheel", lambda);
        return this;
    }

    setPxl(x, y, color) {
        const w = this._width;
        const [i, j] = this.canvas2grid(x, y);
        let index = 4 * (w * i + j);
        this._image[index] = color[0] * MAX_8BIT;
        this._image[index + 1] = color[1] * MAX_8BIT;
        this._image[index + 2] = color[2] * MAX_8BIT;
        this._image[index + 3] = MAX_8BIT;
        return this;
    }

    getPxl(x, y) {
        const w = this._width;
        const h = this._height;
        let [i, j] = this.canvas2grid(x, y);
        i = mod(i, h);
        j = mod(j, w);
        let index = 4 * (w * i + j);
        return [this._image[index], this._image[index + 1], this._image[index + 2], this._image[index + 2]];
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
            for (let k = 0; k < n; k++) {
                const i = Math.floor(k / w);
                const j = k % w;
                const x = j;
                const y = h - 1 - i;
                const color = lambda(x, y);
                if (!color) continue;
                this._image[k] = Color.ofRGB(
                    this._image[k].red + (color.red - this._image[k].red) / it,
                    this._image[k].green + (color.green - this._image[k].green) / it,
                    this._image[k].blue + (color.blue - this._image[k].blue) / it,
                );
            }
            if (it < time) it++
            return this.paint();
        }
        return ans;
    }

    toArray() {
        const w = this._width;
        const h = this._height;
        const imageData = Buffer.alloc(w * h * 4);

        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let index = w * i + j;
                const color = this._image[index];
                index <<= 2; // multiply by 4
                imageData[index] = Math.min(color.red * MAX_8BIT, MAX_8BIT);
                imageData[index + 1] = Math.min(color.green * MAX_8BIT, MAX_8BIT);
                imageData[index + 2] = Math.min(color.blue * MAX_8BIT, MAX_8BIT);
                imageData[index + 3] = MAX_8BIT;
            }
        }
        return imageData;
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
    return ({ x, y }) => {
        return lambda(x, canvas.height - 1 - y);
    }
}