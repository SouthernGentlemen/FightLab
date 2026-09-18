#!/usr/bin/env node
/**
 * `npm run dev` and `npm run preview`: teardown, then serve.
 *
 * A FightLab server left running — another terminal, an editor's preview pane, a session that ended
 * without stopping it — keeps its port, and Vite's strict port then refuses to start. So before it
 * serves, this stops every FightLab server already listening on the port, politely and then firmly,
 * and waits until the port is free. A process that is not FightLab's is never touched: it is named,
 * and the command fails.
 */

import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEV_PORT = 5190;
export const PREVIEW_PORT = 5191;
/** How long a server gets to stop on SIGTERM before it is killed, and how long before giving up. */
const GRACE_MS = 3000;
const GIVE_UP_MS = 6000;

export interface Holder {
  readonly pid: number;
  readonly command: string;
  readonly cwd: string;
}

/** Output of a command, or "" when it exits non-zero (lsof does when nothing matches). */
function output(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw error;
    return "";
  }
}

/** Every process listening on `port`, with its command line and working directory; null without lsof. */
export function holdersOf(port: number): Holder[] | null {
  let listing: string;
  try {
    listing = output("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  } catch {
    return null;
  }
  const pids = [...new Set(listing.split(/\s+/).filter(Boolean).map(Number))].filter((pid) => pid !== process.pid);
  return pids.map((pid) => ({
    pid,
    command: output("ps", ["-o", "command=", "-p", String(pid)]).trim(),
    cwd: output("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]).split("\n").find((line) => line.startsWith("n"))?.slice(1) ?? "",
  }));
}

/** A FightLab server: started from this checkout, or running this checkout's code. */
export function isOurs(holder: Holder, root: string = ROOT): boolean {
  return holder.cwd === root || holder.cwd.startsWith(`${root}/`) || holder.command.includes(`${root}/`);
}

function signal(pid: number, name: NodeJS.Signals): void {
  try {
    process.kill(pid, name);
  } catch {
    // Already gone.
  }
}

/**
 * Stops every FightLab server on `port` and resolves once the port is free, with what it stopped.
 * Rejects, touching nothing, when anything else holds the port. Without lsof there is nothing to
 * find, and Vite reports a busy port itself.
 */
export async function teardown(port: number, root: string = ROOT): Promise<Holder[]> {
  const holders = holdersOf(port);
  if (holders === null || holders.length === 0) return [];
  const strangers = holders.filter((holder) => !isOurs(holder, root));
  if (strangers.length > 0) {
    const named = strangers.map((holder) => `${holder.command || "an unknown process"} (pid ${holder.pid})`).join(", ");
    throw new Error(`port ${port} is held by ${named}, which is not a FightLab server. Stop it, or serve on another port with --port.`);
  }
  for (const holder of holders) signal(holder.pid, "SIGTERM");
  for (let waited = 0; ; waited += 100) {
    const left = holdersOf(port) ?? [];
    if (left.length === 0) return holders;
    if (waited >= GIVE_UP_MS) throw new Error(`port ${port} is still held by pid ${left.map((holder) => holder.pid).join(", ")}`);
    if (waited >= GRACE_MS) for (const holder of left) if (isOurs(holder, root)) signal(holder.pid, "SIGKILL");
    await sleep(100);
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const preview = argv.includes("preview");
  const flag = argv.indexOf("--port");
  const port = Number(flag >= 0 ? argv[flag + 1] : process.env.FIGHTLAB_PORT ?? (preview ? PREVIEW_PORT : DEV_PORT));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`dev: '${flag >= 0 ? argv[flag + 1] : process.env.FIGHTLAB_PORT}' is not a port`);
    process.exit(1);
  }
  try {
    for (const holder of await teardown(port)) console.log(`teardown: stopped the FightLab server already on port ${port} (pid ${holder.pid})`);
  } catch (error) {
    console.error(`teardown: ${(error as Error).message}`);
    process.exit(1);
  }
  const vite = resolve(ROOT, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [vite, ...(preview ? ["preview"] : []), "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, FIGHTLAB_PORT: String(port) },
  });
  for (const name of ["SIGINT", "SIGTERM"] as const) process.on(name, () => child.kill(name));
  child.on("exit", (code, killed) => process.exit(code ?? (killed ? 1 : 0)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
