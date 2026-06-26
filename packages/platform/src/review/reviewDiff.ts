import type { Model } from "@sygil/model";
import { diffModels, type ChangeKind } from "../repo/modelDiff.js";
import type { DiagramMeta, Layout } from "../types.js";

export type { ChangeKind };

/** Map every PartDef qualified name to its change kind between base and head. */
export function changeByQname(
  base: Model,
  head: Model,
): Map<string, ChangeKind> {
  const map = new Map<string, ChangeKind>();
  for (const d of diffModels(base, head)) map.set(d.qname, d.kind);
  return map;
}

/**
 * Derive a diagram's owning package label from its placed elements' qualified
 * names (robust to element-id instability across independent parses). The
 * package is the parent namespace of any placed block, e.g. a block
 * "Root::Powertrain::Gearbox" yields "Root::Powertrain".
 */
export function packageLabel(layout: Layout): string {
  const qn = Object.keys(layout)[0];
  if (!qn) return "(empty)";
  const parts = qn.split("::");
  return parts.length > 1 ? parts.slice(0, -1).join("::") : qn;
}

export type DiagramStatus = "added" | "removed" | "present";

export interface DiagramSummary {
  id: string;
  name: string;
  /** Owning package, derived from placed element qnames (for tree grouping). */
  packageLabel: string;
  status: DiagramStatus;
  added: number;
  removed: number;
  modified: number;
  /** Whether this diagram is worth surfacing as changed in the nav tree. */
  hasChanges: boolean;
}

/**
 * Summarize, per diagram, how many placed blocks changed between branches.
 * Diagrams are matched across branches by their stable id; a diagram present on
 * only one side is flagged added/removed.
 */
export function diagramSummaries(
  base: Model,
  baseDiagrams: DiagramMeta[],
  head: Model,
  headDiagrams: DiagramMeta[],
): DiagramSummary[] {
  const changes = changeByQname(base, head);
  const baseById = new Map(baseDiagrams.map((d) => [d.id, d]));
  const headById = new Map(headDiagrams.map((d) => [d.id, d]));
  const ids = new Set([...baseById.keys(), ...headById.keys()]);

  const summaries: DiagramSummary[] = [];
  for (const id of ids) {
    const baseDiag = baseById.get(id);
    const headDiag = headById.get(id);
    const ref = headDiag ?? baseDiag!;
    const status: DiagramStatus = !baseDiag
      ? "added"
      : !headDiag
        ? "removed"
        : "present";

    const placed = new Set<string>([
      ...Object.keys(baseDiag?.layout ?? {}),
      ...Object.keys(headDiag?.layout ?? {}),
    ]);
    const label = packageLabel(ref.layout);
    let added = 0;
    let removed = 0;
    let modified = 0;
    for (const qn of placed) {
      switch (changes.get(qn)) {
        case "added":
          added++;
          break;
        case "removed":
          removed++;
          break;
        case "modified":
          modified++;
          break;
      }
    }

    summaries.push({
      id,
      name: ref.name,
      packageLabel: label,
      status,
      added,
      removed,
      modified,
      hasChanges: status !== "present" || added + removed + modified > 0,
    });
  }

  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}
