import { describe, expect, it } from "vitest";

import worker, { assetPath } from "../src/worker.ts";

describe("production Worker paths", () => {
  it("maps only the playable route and its built assets", () => {
    expect(assetPath("/play/")).toBe("/index.html");
    expect(assetPath("/play/assets/index-abc.js")).toBe("/assets/index-abc.js");
    expect(assetPath("/play/fighters/runner.json")).toBe("/fighters/runner.json");
    expect(assetPath("/version.json")).toBe("/version.json");
    for (const path of ["/", "/play/other", "/play/fighters/barst.json", "/play/assets/../version.json", "/admin"]) {
      expect(assetPath(path), path).toBeNull();
    }
  });

  it("redirects the bare route, preserves the query and gives unknown paths real 404s", async () => {
    const requests: string[] = [];
    const env = { ASSETS: { fetch: async (request: Request) => {
      requests.push(new URL(request.url).pathname);
      return new Response("asset");
    } } };
    const redirect = await worker.fetch(new Request("https://fightlab.wizardgang.ai/play?seed=7"), env);
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("location")).toBe("https://fightlab.wizardgang.ai/play/?seed=7");
    const play = await worker.fetch(new Request("https://fightlab.wizardgang.ai/play/?seed=7"), env);
    expect(play.status).toBe(200);
    expect(requests).toEqual(["/index.html"]);
    const missing = await worker.fetch(new Request("https://fightlab.wizardgang.ai/other"), env);
    expect(missing.status).toBe(404);
    expect(requests).toEqual(["/index.html"]);
  });
});
