import Box from "./Box.js";
import Image from "./Image.js";
import { Vec2 } from "./Vector.js";

const gridX = 3;
const gridY = 13;
const fontImage = Image.ofUrl("./assets/fonts.png");
const fontImageWidth = fontImage.width;
const fontImageHeight = fontImage.height;
const deltaX = fontImageWidth / gridX;
const deltaY = fontImageHeight / gridY;
const epsilon = 0.09;
let fontMap = {
    "d": Vec2(0, 11),
    "e": Vec2(1, 11),
    "h": Vec2(1, 10),
    "l": Vec2(2, 9),
    "o": Vec2(2, 8),
    "r": Vec2(2, 7),
    "w": Vec2(1, 5),
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