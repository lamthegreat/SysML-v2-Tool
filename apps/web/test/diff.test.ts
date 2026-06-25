import { describe, expect, it } from "vitest";
import { parsePatch } from "../src/repo/diff.js";

describe("parsePatch", () => {
  it("classifies hunk, add, del, context, and meta lines", () => {
    const patch = [
      "@@ -1,3 +1,3 @@",
      " context line",
      "-removed line",
      "+added line",
      "\\ No newline at end of file",
    ].join("\n");

    expect(parsePatch(patch)).toEqual([
      { type: "hunk", text: "@@ -1,3 +1,3 @@" },
      { type: "context", text: " context line" },
      { type: "del", text: "-removed line" },
      { type: "add", text: "+added line" },
      { type: "meta", text: "\\ No newline at end of file" },
    ]);
  });

  it("returns an empty array for an empty patch", () => {
    expect(parsePatch("")).toEqual([]);
  });
});
