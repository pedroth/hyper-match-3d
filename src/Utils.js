import Vec, { Vec2, Vec3 } from "./Vector.js";

export function groupBy(array, groupFunction) {
    const ans = {};
    array.forEach((x, i) => {
        const key = groupFunction(x, i);
        if (!ans[key]) ans[key] = [];
        ans[key].push(x);
    });
    return ans;
}

export function argmin(array, costFunction = x => x) {
    let argminIndex = -1;
    let cost = Number.MAX_VALUE;
    // faster than forEach
    for (let i = 0; i < array.length; i++) {
        const newCost = costFunction(array[i], i);
        if (newCost < cost) {
            cost = newCost;
            argminIndex = i;
        }
    }
    return argminIndex;
}

export function memoize(func) {
    const cache = {}
    return (...args) => {
        const key = JSON.stringify(args.map(x => typeof x === "object" ? JSON.stringify(x) : x.toString()));
        if (key in cache) return cache[key];
        const ans = func(...args);
        cache[key] = ans;
        return ans;
    }
}

export function randomPointInSphere(dim) {
    let randomInSphere;
    while (true) {
        const random = dim === 2 ?
            Vec2(2 * Math.random() - 1, 2 * Math.random() - 1) :
            Vec3(2 * Math.random() - 1, 2 * Math.random() - 1, 2 * Math.random() - 1);
        if (random.squareLength() >= 1) continue;
        randomInSphere = random.normalize();
        break;
    }
    return randomInSphere;
}

export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function clamp(min = 0, max = 1) {
    return x => {
        if (x < min) return min;
        if (x > max) return max;
        return x;
    }
}

const RANDOM = Array(1e6).fill().map(Math.random);
let i = 0;
export function fRandom() {
    if (i > 1e6) i = 0;
    return RANDOM[i++ % RANDOM.length];
}

export function debounce(lambda, debounceTimeInMillis = 500) {
    let timerId;
    return (...vars) => {
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
            lambda(...vars);
        }, debounceTimeInMillis);
        return true;
    };
}

export function loop(lambda) {
    let isFinished = false;
    const loopControl = {
        stop: () => {
            isFinished = true;
        }
    };
    const play = async ({ time, oldT }) => {
        const newT = new Date().getTime();
        const dt = (newT - oldT) * 1e-3;

        await lambda(dt, time);

        if (isFinished) return;
        setTimeout(() => play({
            oldT: newT,
            time: time + dt,
        }));
    }
    play({ oldT: new Date().getTime(), time: 0 });
    return loopControl;
}

export function arrayEquals(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}