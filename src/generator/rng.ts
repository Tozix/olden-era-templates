/**
 * Детерминированный PRNG (xoshiro256**), заменяющий System.Random из C#-версии.
 *
 * Гарантия: одинаковый seed → одинаковая последовательность на всех платформах.
 * НЕ совместим по битам с .NET Random: шаблон с тем же seed будет другим (но
 * валидным). Семантика методов повторяет System.Random:
 *   - nextInt(maxExclusive) ≈ Random.Next(max)
 *   - nextIntInclusive(min, max) ≈ Random.Next(min, max + 1)
 *   - nextDouble() ≈ Random.NextDouble(), [0, 1)
 */

function splitmix64(state: bigint): bigint {
  state = (state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  let z = state;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
  return z ^ (z >> 31n);
}

export class Rng {
  private s0 = 0n;
  private s1 = 0n;
  private s2 = 0n;
  private s3 = 0n;

  /** seed: int из настроек; без seed — энтропия системы. */
  constructor(seed?: number | null) {
    let initial: bigint;
    if (seed === null || seed === undefined) {
      initial = (BigInt(Date.now()) << 20n) ^ BigInt(Math.floor(Math.random() * 0xfffff));
      initial &= 0xffffffffffffffffn;
    } else {
      initial = BigInt(seed | 0) & 0xffffffffn;
    }
    let sm = initial;
    this.s0 = splitmix64((sm += 0x9e3779b97f4a7c15n));
    this.s1 = splitmix64((sm += 0x9e3779b97f4a7c15n));
    this.s2 = splitmix64((sm += 0x9e3779b97f4a7c15n));
    this.s3 = splitmix64((sm += 0x9e3779b97f4a7c15n));
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0n) {
      this.s0 = this.s1 = this.s2 = this.s3 = 0x9e3779b97f4a7c15n & 0xffffffffffffffffn;
    }
  }

  private rotl(x: bigint, k: number): bigint {
    return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & 0xffffffffffffffffn;
  }

  /** Сырой uint64 (xoshiro256**). */
  private nextU64(): bigint {
    const result = (this.rotl((this.s1 * 5n) & 0xffffffffffffffffn, 7) * 9n) & 0xffffffffffffffffn;
    const t = (this.s1 << 17n) & 0xffffffffffffffffn;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = this.rotl(this.s3, 45);
    return result;
  }

  /** [0, 2^53) целое — основа для производных методов. */
  private next53(): number {
    const hi = this.nextU64() >> 11n; // 53 бита
    return Number(hi);
  }

  /** Random.Next(maxExclusive) — [0, max). */
  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) throw new Error("maxExclusive должен быть > 0");
    return this.next53() % maxExclusive;
  }

  /** Random.Next() — [0, int.MaxValue). */
  nextIntFull(): number {
    return this.next53() % 2147483647;
  }

  /** Random.Next(min, max + 1) — включительно по обоим концам. */
  nextIntInclusive(min: number, max: number): number {
    if (max < min) throw new Error("max < min");
    return min + this.nextInt(max - min + 1);
  }

  /** Random.NextDouble() — [0, 1). */
  nextDouble(): number {
    return this.next53() / 9007199254740992; // 2^53
  }

  /** Тасование Фишера—Йетса на месте (как ручные shuffle-циклы в C#). */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Случайный элемент массива. */
  pick<T>(array: readonly T[]): T {
    return array[this.nextInt(array.length)];
  }

  /** Случайный int seed для кнопки «Пересидировать» (Random.Shared.Next(0, int.MaxValue)). */
  static randomSeed(): number {
    return Math.floor(Math.random() * 2147483647);
  }
}
