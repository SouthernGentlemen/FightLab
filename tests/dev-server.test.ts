import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { holdersOf, isOurs, teardown } from "../pipelines/dev.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LSOF = holdersOf(1) !== null;

/** A free port, found by letting the system pick one and giving it back. */
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as { port: number };
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}

const children: ChildProcess[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill("SIGKILL");
});

/** A process listening on `port`, started from `cwd`, resolved once it listens. */
async function listener(port: number, cwd: string): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["-e", `require("node:net").createServer().listen(${port}, "127.0.0.1", () => console.log("up"))`], { cwd, stdio: ["ignore", "pipe", "ignore"] });
  children.push(child);
  await new Promise<void>((done) => child.stdout!.once("data", () => done()));
  return child;
}

describe("the dev server's teardown", () => {
  it("counts a process as FightLab's only when it runs from this checkout or runs its code", () => {
    expect(isOurs({ pid: 1, command: "node x", cwd: ROOT }, ROOT)).toBe(true);
    expect(isOurs({ pid: 1, command: "node x", cwd: `${ROOT}/pipelines` }, ROOT)).toBe(true);
    expect(isOurs({ pid: 1, command: `node ${ROOT}/node_modules/.bin/vite`, cwd: "/" }, ROOT)).toBe(true);
    expect(isOurs({ pid: 1, command: "node other.js", cwd: `${ROOT}-copy` }, ROOT)).toBe(false);
    expect(isOurs({ pid: 1, command: "python -m http.server", cwd: "/tmp" }, ROOT)).toBe(false);
  });

  it.skipIf(!LSOF)("stops a FightLab server already on the port and waits until the port is free", async () => {
    const port = await freePort();
    const running = await listener(port, ROOT);
    expect(holdersOf(port)!.map((holder) => holder.pid)).toEqual([running.pid]);
    const stopped = await teardown(port, ROOT);
    expect(stopped.map((holder) => holder.pid)).toEqual([running.pid]);
    expect(holdersOf(port)).toEqual([]);
  }, 15_000);

  it.skipIf(!LSOF)("never touches a process that is not FightLab's, and says what holds the port", async () => {
    const port = await freePort();
    const stranger = await listener(port, tmpdir());
    await expect(teardown(port, ROOT)).rejects.toThrow(/not a FightLab server/);
    expect(holdersOf(port)!.map((holder) => holder.pid)).toEqual([stranger.pid]);
  }, 15_000);

  it("does nothing when the port is already free", async () => {
    expect(await teardown(await freePort(), ROOT)).toEqual([]);
  });
});
