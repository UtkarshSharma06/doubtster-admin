import "server-only";
import { promises as fs } from "fs";
import path from "path";
import type { Data } from "./types";
import { seed } from "./seed";

/*
  Storage layer.
  This dev store keeps everything in one JSON file (.data/admin.json) and runs
  every write through a queue, so two requests never write at the same time.

  For production, replace read() and write() with your real database (Postgres,
  Supabase, Mongo). Keep the same function names and nothing else has to change.
  A JSON file does NOT persist on serverless hosts like Vercel.
*/

const FILE = process.env.DATA_FILE || path.join(process.cwd(), ".data", "admin.json");

let cache: Data | null = null;
let cacheMtime = 0;
let loading: Promise<Data> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Loads the file once, even when many requests arrive at the same moment. */
async function load(): Promise<Data> {
  if (cache) {
    // Reload if another process or bundle wrote the file since we cached it.
    const m = await fs.stat(FILE).then((st) => st.mtimeMs).catch(() => 0);
    if (!m || m <= cacheMtime) return cache;
    cache = null;
  }
  if (!loading) loading = readFile().then((d) => (cache = d)).finally(() => { loading = null; });
  return loading;
}

async function readFile(): Promise<Data> {
  try {
    const st = await fs.stat(FILE);
    const raw = await fs.readFile(FILE, "utf8");
    cacheMtime = st.mtimeMs;
    const d = JSON.parse(raw) as Data;
    if (d && d.v === 2) {
      const fresh = seed() as unknown as Record<string, unknown>;
      const rec = d as unknown as Record<string, unknown>;
      for (const k of Object.keys(fresh)) if (!(k in rec)) rec[k] = fresh[k];
      d.flags = fill(fresh.flags as Record<string, unknown>, d.flags as unknown as Record<string, unknown>) as unknown as Data["flags"];
      return d;
    }
  } catch {
    /* first run */
  }
  const d = seed();
  await writeFile(d);
  return d;
}

async function writeFile(d: Data) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = FILE + "." + process.pid + "." + Math.random().toString(36).slice(2) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(d));
  await fs.rename(tmp, FILE);
  cacheMtime = (await fs.stat(FILE)).mtimeMs;
}

/** Read the current data. Treat the result as read-only. */
export async function read(): Promise<Data> {
  await queue;
  return load();
}

/**
 * Run a change as one transaction. The function gets a working copy.
 * If it throws, nothing is saved. Changes are applied one after another.
 */
export function tx<T>(fn: (d: Data) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const copy: Data = structuredClone(await load());
    const out = await fn(copy);
    await writeFile(copy);
    cache = copy;
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function replaceAll(d: Data) {
  return tx((cur) => {
    Object.assign(cur, d);
  });
}

/** Adds settings that are new since the file was saved, keeping every saved value. */
function fill(def: Record<string, unknown>, cur: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...def, ...cur };
  for (const k of Object.keys(def)) {
    const a = def[k], b = cur?.[k];
    if (a && typeof a === "object" && !Array.isArray(a) && b && typeof b === "object" && !Array.isArray(b)) out[k] = fill(a as Record<string, unknown>, b as Record<string, unknown>);
  }
  return out;
}
