import { describe, expect, it } from "vitest";
import { LocalProvider } from "../src/local.js";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe("LocalProvider collaboration stubs", () => {
  const p = () => new LocalProvider("sygil:test", memStorage());

  it("reports a single implicit branch", async () => {
    expect(await p().listBranches()).toEqual(["main"]);
  });

  it("throws for branch/PR/compare operations", async () => {
    await expect(p().createBranch("x", "main")).rejects.toThrow(/not supported/);
    await expect(
      p().createPullRequest({ title: "t", head: "x", base: "main" }),
    ).rejects.toThrow(/not supported/);
    await expect(p().compareBranches("main", "x")).rejects.toThrow(/not supported/);
  });
});
