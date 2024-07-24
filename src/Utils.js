const { Vec2, Vec3 } = require('./Vector.js');

function groupBy(array, groupFunction) {
    const ans = {};
    array.forEach((x, i) => {
        const key = groupFunction(x, i);
        if (!ans[key]) ans[key] = [];
        ans[key].push(x);
    });
    return ans;
}

function argmin(array, costFunction = x => x) {
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

function memoize(func) {
    const cache = {}
    return (...args) => {
        const key = JSON.stringify(args.map(x => typeof x === "object" ? JSON.stringify(x) : x.toString()));
        if (key in cache) return cache[key];
        const ans = func(...args);
        cache[key] = ans;
        return ans;
    }
}

function randomPointInSphere(dim) {
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

function mod(n, m) {
    return ((n % m) + m) % m;
}

function clamp(min = 0, max = 1) {
    return x => {
        if (x < min) return min;
        if (x > max) return max;
        return x;
    }
}

const RANDOM = Array(1000).fill().map(Math.random);
let i = 0;
function fRandom() {
    if (i > 1e6) i = 0;
    return RANDOM[i++ % RANDOM.length];
}

function debounce(lambda, debounceTimeInMillis = 500) {
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

function loop(lambda) {
    let isFinished = false;
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
    const loopControl = {
        stop: () => {
            isFinished = true;
        },
        play: () => play({ oldT: new Date().getTime(), time: 0 })
    };

    return loopControl;
}

function arrayEquals(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

module.exports = {
    groupBy,
    argmin,
    memoize,
    randomPointInSphere,
    mod,
    clamp,
    fRandom,
    debounce,
    loop,
    arrayEquals
};
