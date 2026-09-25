export interface WorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const NOT_FOUND = () => new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

/** The public origin owns only /play/ and a release identity document. */
export function assetPath(path: string): string | null {
  if (path === "/version.json") return path;
  if (path === "/play/") return "/index.html";
  if (/^\/play\/(?:assets\/[a-zA-Z0-9._-]+|fighters\/runner\.json)$/.test(path)) return path.slice("/play".length);
  return null;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return NOT_FOUND();
    const url = new URL(request.url);
    if (url.pathname === "/play") {
      url.pathname = "/play/";
      return Response.redirect(url.toString(), 308);
    }
    const path = assetPath(url.pathname);
    if (!path) return NOT_FOUND();
    url.pathname = path;
    return env.ASSETS.fetch(new Request(url, request));
  },
};
