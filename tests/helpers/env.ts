import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Env, D1Like, KVNamespaceLike } from '../../functions/_lib/shared';

const require = createRequire(import.meta.url);

// قاعدة D1 وهمية فوق SQLite الحقيقي (node:sqlite) وبنفس ملفات الهجرة الفعلية
export function makeD1(): D1Like & { raw: { exec(sql: string): void; prepare(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown; run(...p: unknown[]): unknown } } } {
  const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (p: string) => { exec(sql: string): void; prepare(sql: string): { all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown; run(...p: unknown[]): unknown } } };
  const db = new DatabaseSync(':memory:');
  for (const f of ['0001_init.sql', '0002_limits_library.sql']) db.exec(readFileSync(path.resolve(__dirname, '../../migrations', f), 'utf-8'));
  return {
    raw: db,
    prepare(q: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...v: unknown[]) { params = v; return stmt; },
        async first<T>() { return ((db.prepare(q).get(...params) as T | undefined) ?? null); },
        async all<T>() { return { results: db.prepare(q).all(...params) as T[] }; },
        async run() { db.prepare(q).run(...params); return {}; }
      };
      return stmt;
    }
  };
}

export function makeKV(): KVNamespaceLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(k) { return store.get(k) ?? null; },
    async put(k, v) { store.set(k, v); }
  };
}

export const SECRET = 'test-secret-'.padEnd(48, 'x');

export function baseEnv(over: Partial<Env> = {}): Env {
  return { ...over } as Env;
}

export function authEnv(over: Partial<Env> = {}): Env & { DB: ReturnType<typeof makeD1> } {
  const DB = makeD1();
  return { DB, GOOGLE_CLIENT_ID: 'test-client', SESSION_SECRET: SECRET, ...over } as Env & { DB: ReturnType<typeof makeD1> };
}

export const ORIGIN = 'https://baheth.test';
export const req = (path: string, init: RequestInit & { cookie?: string } = {}): Request => {
  const { cookie, headers, ...rest } = init;
  const h = new Headers(headers);
  if (cookie) h.set('Cookie', cookie);
  if (rest.method && rest.method !== 'GET' && !h.has('Origin')) h.set('Origin', ORIGIN);
  return new Request(`${ORIGIN}${path}`, { ...rest, headers: h });
};
