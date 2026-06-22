import {
  childrenOf,
  qualifiedName,
  type Model,
  type PartDef,
  type AttributeUsage,
  type PartUsage,
} from "@sygil/model";

export type ChangeKind = "added" | "removed" | "modified" | "unchanged";

export interface BlockDiff {
  kind: ChangeKind;
  qname: string;
  name: string;
  base?: PartDefSnapshot;
  head?: PartDefSnapshot;
}

export interface PartDefSnapshot {
  name: string;
  specializations: string[];
  attributes: Array<{ name: string; dataType: string; multiplicity?: string }>;
  parts: Array<{
    name: string;
    typeName?: string;
    isReference: boolean;
    multiplicity?: string;
  }>;
}

function snapshot(model: Model, pd: PartDef): PartDefSnapshot {
  const kids = childrenOf(model, pd.id);
  return {
    name: pd.name,
    specializations: [...pd.specializations],
    attributes: kids
      .filter((c): c is AttributeUsage => c.kind === "attributeUsage")
      .map((a) => ({
        name: a.name,
        dataType: a.dataType,
        multiplicity: a.multiplicity,
      })),
    parts: kids
      .filter((c): c is PartUsage => c.kind === "partUsage")
      .map((p) => ({
        name: p.name,
        typeName: p.typeName,
        isReference: p.isReference,
        multiplicity: p.multiplicity,
      })),
  };
}

function snapshotsEqual(a: PartDefSnapshot, b: PartDefSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Collect all PartDefs in a model, keyed by qualified name. */
function allPartDefs(
  model: Model,
): Map<string, { pd: PartDef; snap: PartDefSnapshot }> {
  const out = new Map<string, { pd: PartDef; snap: PartDefSnapshot }>();
  for (const el of Object.values(model.elements)) {
    if (el.kind === "partDef") {
      const qn = qualifiedName(model, el.id);
      out.set(qn, { pd: el, snap: snapshot(model, el) });
    }
  }
  return out;
}

/**
 * Diff two models at the PartDef level, matching by qualified name.
 * Returns a list of BlockDiffs sorted alphabetically by qname.
 */
export function diffModels(base: Model, head: Model): BlockDiff[] {
  const baseDefs = allPartDefs(base);
  const headDefs = allPartDefs(head);
  const allNames = new Set([...baseDefs.keys(), ...headDefs.keys()]);
  const diffs: BlockDiff[] = [];

  for (const qn of allNames) {
    const b = baseDefs.get(qn);
    const h = headDefs.get(qn);
    if (b && h) {
      diffs.push({
        kind: snapshotsEqual(b.snap, h.snap) ? "unchanged" : "modified",
        qname: qn,
        name: h.pd.name,
        base: b.snap,
        head: h.snap,
      });
    } else if (h) {
      diffs.push({ kind: "added", qname: qn, name: h.pd.name, head: h.snap });
    } else if (b) {
      diffs.push({
        kind: "removed",
        qname: qn,
        name: b.pd.name,
        base: b.snap,
      });
    }
  }

  return diffs.sort((a, b) => a.qname.localeCompare(b.qname));
}
