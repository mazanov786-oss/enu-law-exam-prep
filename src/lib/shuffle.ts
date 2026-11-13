/**
 * PRNG & unbiased Fisher-Yates shuffle utilities for tests, cloze, flashcards, and tickets.
 */

export function generateRandomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return (arr[0] % 2147483646) + 1;
  }
  return Math.floor(Math.random() * 2147483646) + 1;
}

/**
 * Mulberry32 deterministic 32-bit PRNG returning values in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let state = (seed | 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string into a deterministic 32-bit integer seed.
 */
export function hashStringSeed(input: string, baseSeed = 0): number {
  let hash = 2166136261 ^ baseSeed;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

/**
 * Returns a shuffled shallow copy of `items` using Fisher-Yates + Mulberry32.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const copy = [...items];
  const rng = createSeededRng(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
