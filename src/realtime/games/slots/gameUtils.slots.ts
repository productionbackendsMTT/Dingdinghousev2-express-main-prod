import crypto from 'crypto';
export function shuffleArray<T>(array: T[]): T[] {
    // List of RNG functions
    const rngFunctions = [
        (max: number) => generateRandomNumber(Date.now(), max), // RNG1
        (max: number) => chaoticRandom(generateUniqueSeed()) * max, // RNG2
        (max: number) => generatelcgRandomNumbers(generateUniqueSeed(), max), // RNG3
        (max: number) => generatetrueRandomNumber(max) // RNG4
    ];

    for (let i = array.length - 1; i > 0; i--) {
        const rngIndex = Math.floor(Math.random() * rngFunctions.length);
        const rngFunction = rngFunctions[rngIndex];
        const j = Math.floor(rngFunction(i + 1));

        // Swap elements at index i and j
        [array[i], array[j]] = [array[j], array[i]];
    }

    // Return the shuffled array
    return array;
}
// RNG1

function newtonRng(seed: number, maxIterations = 10) {
    let x = seed;
    const constant = 71;

    const epsilon = 1e-10;

    for (let i = 0; i < maxIterations; i++) {
        let fx = Math.sin(x * x) - constant;
        let fpx = 2 * x * Math.cos(x);

        let nextX = x - fx / (fpx + epsilon);

        if (Math.abs(nextX - x) < epsilon) {
            break;
        }

        x = nextX + Math.random();
    }

    return Math.abs(x % 1);
}

function generateBetRng(seed: number, number: number, maxIterations = 20) {
    const randomValue = newtonRng(seed, maxIterations);
    return Math.floor(randomValue * number);
}

export function generateRandomNumber(seed: number, number: number) {
    let randomNum = generateBetRng(seed, number);
    seed = (seed * Math.random() * Math.sin(seed) + Date.now()) % (1e10 * Math.random()) + Math.random();
    return randomNum;
}

// RNG2

function chaoticRandom(seed: number) {
    const noise = Math.sin(seed) * 10000;
    const randomValue = (Math.random() + noise) % 1;

    return Math.abs(randomValue);
}

// RNG3 - LCG

function lcg(seed: number) {
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    seed = (a * seed + c) % m;

    return seed / m;
}

export function generatelcgRandomNumbers(seed: number, count: number) {
    seed = Math.abs(seed + Math.random() * 1000);
    const randomValue = lcg(seed >>> 0);
    const randomNumber = Math.round(randomValue * count);
    return randomNumber;
}

// RNG4 - TRUE RANDOM

function trueRandom(min: number, max: number) {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0);
    return min + (randomValue % (max - min));
}

export function generatetrueRandomNumber(max: number) {
    const randomNumber = trueRandom(0, max);
    return randomNumber;
}
function generateUniqueSeed(): number {
    return Math.floor(Date.now() * Math.random() + performance.now());
}

