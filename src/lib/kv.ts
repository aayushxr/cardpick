// Key-value store. Upstash Redis in production. When no Redis env is set
// (local dev, tests) it falls back to an in-process Map so the app still runs;
// settings then reset on every restart, which the settings page flags.

import { Redis } from "@upstash/redis";

type Store = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  persistent: boolean;
};

const memory = new Map<string, unknown>();

function memoryStore(): Store {
  return {
    async get<T>(key: string) {
      return (memory.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T) {
      memory.set(key, value);
    },
    async del(key: string) {
      memory.delete(key);
    },
    persistent: false,
  };
}

function redisStore(url: string, token: string): Store {
  const redis = new Redis({ url, token });
  return {
    async get<T>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async set<T>(key: string, value: T) {
      await redis.set(key, value);
    },
    async del(key: string) {
      await redis.del(key);
    },
    persistent: true,
  };
}

let store: Store | null = null;

export function kv(): Store {
  if (store) return store;
  // Vercel Marketplace Upstash sets KV_REST_API_*; a direct Upstash setup sets UPSTASH_REDIS_REST_*.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? redisStore(url, token) : memoryStore();
  return store;
}

export const KEYS = {
  settings: "cardpick:settings",
  fx: "cardpick:fx",
  secret: "cardpick:secret",
} as const;
