import { useMemo } from "react";
import type { Model } from "@sygil/model";
import {
  diffModels,
  type BlockDiff,
  type ChangeKind,
  type PartDefSnapshot,
} from "../repo/modelDiff.js";

const BORDER: Record<ChangeKind, string> = {
  added: "border-emerald-400",
  removed: "border-red-400",
  modified: "border-amber-400",
  unchanged: "border-slate-200",
};

const BG: Record<ChangeKind, string> = {
  added: "bg-emerald-50",
  removed: "bg-red-50",
  modified: "bg-amber-50",
  unchanged: "bg-white",
};

const BADGE_BG: Record<ChangeKind, string> = {
  added: "bg-emerald-100 text-emerald-800",
  removed: "bg-red-100 text-red-700",
  modified: "bg-amber-100 text-amber-800",
  unchanged: "bg-slate-100 text-slate-500",
};

function Badge({ kind }: { kind: ChangeKind }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${BADGE_BG[kind]}`}
    >
      {kind}
    </span>
  );
}

function BlockCard({
  snap,
  kind,
  side,
}: {
  snap: PartDefSnapshot | undefined;
  kind: ChangeKind;
  side: "base" | "head";
}) {
  if (!snap) {
    const empty =
      side === "base" ? "Not present on base" : "Not present on head";
    return (
      <div className="flex min-h-[60px] items-center justify-center rounded-md border border-dashed border-slate-200 px-2 py-3 text-xs italic text-slate-400">
        {empty}
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 rounded-md border ${BORDER[kind]} ${BG[kind]} shadow-sm`}
    >
      <div
        className={`rounded-t-md border-b px-2 py-1.5 text-center ${
          kind === "unchanged"
            ? "border-slate-100 bg-slate-50"
            : `border-inherit ${BG[kind]}`
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide text-slate-400">
          «part def»
        </div>
        <div className="font-semibold text-slate-800">{snap.name}</div>
        {snap.specializations.length > 0 && (
          <div className="text-[11px] text-slate-500">
            :&gt; {snap.specializations.join(", ")}
          </div>
        )}
      </div>

      {snap.attributes.length > 0 && (
        <div className="border-b border-inherit px-2 py-1 text-xs text-slate-700">
          {snap.attributes.map((a, i) => (
            <div key={i}>
              {a.name} : <span className="text-sky-700">{a.dataType}</span>
              {a.multiplicity && (
                <span className="text-slate-500">[{a.multiplicity}]</span>
              )}
            </div>
          ))}
        </div>
      )}

      {snap.parts.length > 0 && (
        <div className="px-2 py-1 text-xs text-slate-700">
          {snap.parts.map((p, i) => (
            <div key={i}>
              <span className="text-slate-400">
                {p.isReference ? "ref part" : "part"}
              </span>{" "}
              {p.name}
              {p.typeName && (
                <>
                  {" "}
                  : <span className="text-emerald-700">{p.typeName}</span>
                </>
              )}
              {p.multiplicity && (
                <span className="text-slate-500">[{p.multiplicity}]</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffRow({ diff }: { diff: BlockDiff }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
      <BlockCard snap={diff.base} kind={diff.kind} side="base" />
      <div className="flex flex-col items-center gap-1 pt-3">
        <Badge kind={diff.kind} />
      </div>
      <BlockCard snap={diff.head} kind={diff.kind} side="head" />
    </div>
  );
}

function Legend() {
  const items: Array<{ kind: ChangeKind; label: string }> = [
    { kind: "added", label: "Added" },
    { kind: "removed", label: "Removed" },
    { kind: "modified", label: "Modified" },
    { kind: "unchanged", label: "Unchanged" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-[11px]">
      {items.map(({ kind, label }) => (
        <span key={kind} className="flex items-center gap-1">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-sm border ${BORDER[kind]} ${BG[kind]}`}
          />
          <span className="text-slate-500">{label}</span>
        </span>
      ))}
    </div>
  );
}

interface Props {
  baseModel: Model;
  headModel: Model;
  baseBranch: string;
  headBranch: string;
}

export function VisualDiff({
  baseModel,
  headModel,
  baseBranch,
  headBranch,
}: Props) {
  const diffs = useMemo(
    () => diffModels(baseModel, headModel),
    [baseModel, headModel],
  );

  const hasChanges = diffs.some((d) => d.kind !== "unchanged");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] gap-3 text-xs font-medium text-slate-500">
          <div className="text-center">
            base: <span className="text-slate-700">{baseBranch}</span>
          </div>
          <div />
          <div className="text-center">
            head: <span className="text-slate-700">{headBranch}</span>
          </div>
        </div>
      </div>

      <Legend />

      {!hasChanges && (
        <p className="py-4 text-center text-xs text-slate-400">
          No model differences between these branches.
        </p>
      )}

      {diffs.map((d) => (
        <DiffRow key={d.qname} diff={d} />
      ))}
    </div>
  );
}
