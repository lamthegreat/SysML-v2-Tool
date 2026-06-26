/**
 * Minimal unified-diff parsing for rendering host `compareBranches` patches.
 * The patch text comes straight from the Git host (e.g. GitHub's compare API),
 * already in unified-diff format; we only classify each line so the UI can color
 * additions/deletions/hunks. No third-party diff dependency.
 */

export type DiffLineType = "hunk" | "add" | "del" | "context" | "meta";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/** Classify each line of a unified-diff hunk string. */
export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  return patch.split("\n").map((text) => ({ type: classify(text), text }));
}

function classify(line: string): DiffLineType {
  if (line.startsWith("@@")) return "hunk";
  // "\ No newline at end of file" markers and the like.
  if (line.startsWith("\\")) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "context";
}
