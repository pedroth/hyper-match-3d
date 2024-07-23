import Box from "./Box.js";
import Image from "./Image.js";
import { Vec2 } from "./Vector.js";

const gridX = 3;
const gridY = 13;
const fontImage = Image.ofPPM("./assets/fonts.ppm");
const fontImageWidth = fontImage.width;
const fontImageHeight = fontImage.height;
const deltaX = fontImageWidth / gridX;
const deltaY = fontImageHeight / gridY;
const epsilon = 0.09;
let fontMap = {
    "a": Vec2(0, 12),
    "b": Vec2(1, 12),
    "c": Vec2(2, 12),
    "d": Vec2(0, 11),
    "e": Vec2(1, 11),
    "f": Vec2(2, 11),
    "g": Vec2(0, 10),
    "h": Vec2(1, 10),
    "i": Vec2(2, 10),
    "j": Vec2(0, 9),
    "k": Vec2(1, 9),
    "l": Vec2(2, 9),
    "m": Vec2(0, 8),
    "n": Vec2(1, 8),
    "o": Vec2(2, 8),
    "p": Vec2(0, 7),
    "q": Vec2(1, 7),
    "r": Vec2(2, 7),
    "s": Vec2(0, 6),
    "t": Vec2(1, 6),
    "u": Vec2(2, 6),
    "v": Vec2(0, 5),
    "w": Vec2(1, 5),
    "x": Vec2(2, 5),
    "y": Vec2(0, 4),
    "z": Vec2(1, 4),
    "0": Vec2(2, 4),
    "1": Vec2(0, 3),
    "2": Vec2(1, 3),
    "3": Vec2(2, 3),
    "4": Vec2(0, 2),
    "5": Vec2(1, 2),
    "6": Vec2(2, 2),
    "7": Vec2(0, 1),
    "8": Vec2(1, 1),
    "9": Vec2(2, 1),
    ":": Vec2(0, 0),
    "!": Vec2(1, 0),
    ".": Vec2(1, 0),
};
fontMap = Object.entries(fontMap)
    .reduce(
        (e, x) => {
            const [k, gridCoord] = x;
            const boxImage = new Box(
                Vec2((gridCoord.x + epsilon) * deltaX, (gridCoord.y + epsilon) * deltaY).map(Math.floor),
                Vec2((gridCoord.x - epsilon + 1) * deltaX, (gridCoord.y - epsilon + 1) * deltaY).map(Math.floor)
            )
            e[k] = {
                gridCoord,
                boxImage
            }
            return e;
        },
        {}
    );



export const imageFromString = (string) => {
    const chars = [...string].map(x => x.toLowerCase());
    const ans = {};
    /**
     * in texture space, x \in [0,1], y \in [0,1]
     * @returns Color
     */
    ans.getPxl = (x, y) => {
        const charIndex = Math.floor((x * chars.length)) % chars.length;
        const char = chars[charIndex];
        if (char === " ") return;
        if (!(char in fontMap)) return;
        const { boxImage } = fontMap[char];
        const px = x * chars.length - charIndex;
        const py = y;
        const color = fontImage.getPxl(boxImage.min.x + boxImage.diagonal.x * px, boxImage.min.y + boxImage.diagonal.y * py);
        return color[0] === 1 ?
            undefined :
            [1 - color[0], 1 - color[1], 1 - color[2], 1];
    }
    return ans;
}