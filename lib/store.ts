import { Redis } from "@upstash/redis";

export interface Store {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setNx(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  incr(key: string): Promise<number>;
  zadd(key: string, score: number, member: string): Promise<void>;
  zrangeByScore(key: string, min: number): Promise<string[]>;
}

export function createRedisStore(env: Record<string, string | undefined> = process.env): Store {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing Redis REST credentials");

  const redis = new Redis({ url, token, automaticDeserialization: false });

  return {
    get: async (key) => (await redis.get<string>(key)) ?? null,
    set: async (key, value, ttl) => {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    },
    setNx: async (key, value, ttl) => (await redis.set(key, value, { nx: true, ex: ttl })) === "OK",
    incr: (key) => redis.incr(key),
    zadd: async (key, score, member) => {
      await redis.zadd(key, { score, member });
    },
    zrangeByScore: (key, min) => redis.zrange<string[]>(key, min, "+inf", { byScore: true }),
  };
}

export class MemoryStore implements Store {
  private kv = new Map<string, { value: string; expiresAt: number | null }>();
  private zsets = new Map<string, Map<string, number>>();

  constructor(private now: () => number = Date.now) {}

  private live(key: string): string | null {
    const entry = this.kv.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.kv.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    return this.live(key);
  }

  async set(key: string, value: string, ttl?: number) {
    this.kv.set(key, { value, expiresAt: ttl ? this.now() + ttl * 1000 : null });
  }

  async setNx(key: string, value: string, ttl: number) {
    if (this.live(key) !== null) return false;
    this.kv.set(key, { value, expiresAt: this.now() + ttl * 1000 });
    return true;
  }

  async incr(key: string) {
    const next = Number(this.live(key) ?? "0") + 1;
    const entry = this.kv.get(key);
    this.kv.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  }

  async zadd(key: string, score: number, member: string) {
    const z = this.zsets.get(key) ?? new Map<string, number>();
    z.set(member, score);
    this.zsets.set(key, z);
  }

  async zrangeByScore(key: string, min: number) {
    const z = this.zsets.get(key);
    if (!z) return [];
    return [...z.entries()]
      .filter(([, score]) => score >= min)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }
}
