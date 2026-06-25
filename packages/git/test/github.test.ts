import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubProvider } from "../src/github.js";

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/**
 * Stub global fetch with a router keyed by "METHOD path-substring". Records every
 * call so tests can assert endpoints/payloads without real network.
 */
function stubFetch(routes: Record<string, unknown>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body: init?.body ? JSON.parse(init.body as string) : undefined,
      });
      const key = Object.keys(routes).find((k) => {
        const [m, frag] = k.split(" ");
        return m === method && url.includes(frag);
      });
      const data = key ? routes[key] : {};
      return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
      } as Response;
    },
  );
  return calls;
}

const cfg = { owner: "acme", repo: "widgets", branch: "main", token: "t0ken" };

afterEach(() => vi.unstubAllGlobals());

describe("GitHubProvider collaboration methods", () => {
  it("listBranches maps branch names", async () => {
    stubFetch({
      "GET /branches": [{ name: "main" }, { name: "feature/x" }],
    });
    const branches = await new GitHubProvider(cfg).listBranches();
    expect(branches).toEqual(["main", "feature/x"]);
  });

  it("createBranch reads the base ref sha then POSTs a new ref", async () => {
    const calls = stubFetch({
      "GET /git/ref/heads/main": { object: { sha: "abc123" } },
      "POST /git/refs": {},
    });
    await new GitHubProvider(cfg).createBranch("feature/y", "main");

    const post = calls.find((c) => c.method === "POST" && c.url.includes("/git/refs"));
    expect(post).toBeDefined();
    expect(post!.body).toEqual({ ref: "refs/heads/feature/y", sha: "abc123" });
  });

  it("createPullRequest posts to /pulls and returns url + number", async () => {
    const calls = stubFetch({
      "POST /pulls": { html_url: "https://github.com/acme/widgets/pull/42", number: 42 },
    });
    const pr = await new GitHubProvider(cfg).createPullRequest({
      title: "My PR",
      head: "feature/y",
      base: "main",
      body: "desc",
    });
    expect(pr).toEqual({ url: "https://github.com/acme/widgets/pull/42", number: 42 });

    const post = calls.find((c) => c.url.includes("/pulls"));
    expect(post!.body).toEqual({
      title: "My PR",
      head: "feature/y",
      base: "main",
      body: "desc",
    });
  });

  it("compareBranches hits the compare endpoint and maps files", async () => {
    const calls = stubFetch({
      "GET /compare/main...feature/y": {
        files: [
          { filename: "model/V.sysml", status: "modified", patch: "@@ -1 +1 @@" },
          { filename: "views/V.view.json", status: "added" },
        ],
      },
    });
    const diff = await new GitHubProvider(cfg).compareBranches("main", "feature/y");
    expect(calls[0].url).toContain("/compare/main...feature/y");
    expect(diff).toEqual([
      { path: "model/V.sysml", status: "modified", patch: "@@ -1 +1 @@" },
      { path: "views/V.view.json", status: "added", patch: "" },
    ]);
  });
});
