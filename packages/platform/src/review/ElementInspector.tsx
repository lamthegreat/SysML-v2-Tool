import type { BlockDiff, PartDefSnapshot } from "../repo/modelDiff.js";

type MemberStatus = "added" | "removed" | "changed" | "unchanged";

const ROW: Record<MemberStatus, string> = {
  added: "bg-emerald-50 text-emerald-800",
  removed: "bg-red-50 text-red-700 line-through",
  changed: "bg-amber-50 text-amber-800",
  unchanged: "text-slate-600",
};

function attrLine(a: { name: string; dataType: string; multiplicity?: string }) {
  return `${a.name} : ${a.dataType}${a.multiplicity ? `[${a.multiplicity}]` : ""}`;
}
function partLine(p: {
  name: string;
  typeName?: string;
  isReference: boolean;
  multiplicity?: string;
}) {
  const kw = p.isReference ? "ref part" : "part";
  const t = p.typeName ? ` : ${p.typeName}` : "";
  return `${kw} ${p.name}${t}${p.multiplicity ? `[${p.multiplicity}]` : ""}`;
}

interface MemberRow {
  key: string;
  status: MemberStatus;
  text: string;
}

/** Diff two named-member lists, keyed by member name. */
function diffMembers<T extends { name: string }>(
  base: T[],
  head: T[],
  render: (m: T) => string,
): MemberRow[] {
  const baseByName = new Map(base.map((m) => [m.name, m]));
  const headByName = new Map(head.map((m) => [m.name, m]));
  const names = [...new Set([...baseByName.keys(), ...headByName.keys()])];
  return names.map((name) => {
    const b = baseByName.get(name);
    const h = headByName.get(name);
    if (b && !h) return { key: name, status: "removed", text: render(b) };
    if (h && !b) return { key: name, status: "added", text: render(h) };
    const bt = render(b!);
    const ht = render(h!);
    if (bt !== ht)
      return { key: name, status: "changed", text: `${bt}  →  ${ht}` };
    return { key: name, status: "unchanged", text: ht };
  });
}

function Section({ title, rows }: { title: string; rows: MemberRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {title}
      </div>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.key} className={`rounded px-1.5 py-0.5 text-xs ${ROW[r.status]}`}>
            {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY: PartDefSnapshot = {
  name: "",
  specializations: [],
  attributes: [],
  parts: [],
};

interface Props {
  diff: BlockDiff | null;
  baseBranch: string;
  headBranch: string;
}

export function ElementInspector({ diff, baseBranch, headBranch }: Props) {
  if (!diff) {
    return (
      <p className="p-3 text-xs italic text-slate-400">
        Select a block to inspect its changes.
      </p>
    );
  }

  const base = diff.base ?? EMPTY;
  const head = diff.head ?? EMPTY;

  const specRows = diffMembers(
    base.specializations.map((s) => ({ name: s })),
    head.specializations.map((s) => ({ name: s })),
    (m) => `:> ${m.name}`,
  );
  const attrRows = diffMembers(base.attributes, head.attributes, attrLine);
  const partRows = diffMembers(base.parts, head.parts, partLine);

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold text-slate-800">{diff.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
            diff.kind === "added"
              ? "bg-emerald-100 text-emerald-800"
              : diff.kind === "removed"
                ? "bg-red-100 text-red-700"
                : diff.kind === "modified"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-500"
          }`}
        >
          {diff.kind}
        </span>
      </div>
      <div className="mb-3 text-[11px] text-slate-400">
        {baseBranch} → {headBranch}
      </div>

      <Section title="Specializations" rows={specRows} />
      <Section title="Attributes" rows={attrRows} />
      <Section title="Parts" rows={partRows} />

      {specRows.length === 0 && attrRows.length === 0 && partRows.length === 0 && (
        <p className="text-xs italic text-slate-400">No members.</p>
      )}
    </div>
  );
}
