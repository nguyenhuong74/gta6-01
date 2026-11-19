// Seeded random numbers: a small mulberry32 generator plus helpers, so the
// city and traffic are the same for a given seed and different otherwise.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function range(rng, min, max) {
  return min + rng.next() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng.next() * list.length)];
}

export function chance(rng, p) {
  return rng.next() < p;
}
