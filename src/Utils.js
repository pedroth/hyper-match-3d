import Vec from "./Vector.js";

export function measureTime(lambda) {
    const t = performance.now();
    lambda()
    return 1e-3 * (performance.now() - t);
}

export function logTime(lambda) {
    const t = performance.now();
    const result = lambda();
    console.log(`Took ${1e-3 * (performance.now() - t)}s`);
    return result;
}

export function measureTimeWithResult(lambda) {
    const t = performance.now();
    const result = lambda();
    return { result, time: 1e-3 * (performance.now() - t) };
}

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
        const random = Vec.RANDOM(dim).map(x => 2 * x - 1);
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
    return x => Math.max(min, Math.min(max, x));
}

const RANDOM = Array(1000).fill().map(Math.random);
let i = 0;
export function fRandom() {
    if (i > 1e6) i = 0;
    return RANDOM[i++ % RANDOM.length];
}

export function debounce(lambda, debounceTimeInMillis = 500) {
    let timerId;
    return function (...vars) {
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(() => {
            lambda(...vars);
        }, debounceTimeInMillis);
        return true;
    };
}