import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ChangeKind } from "../repo/modelDiff.js";
import type { BddGraphNodeData } from "./bddGraph.js";

export interface ReviewNodeData extends BddGraphNodeData {
  change: ChangeKind;
  selected?: boolean;
}

const HEADER: Record<ChangeKind, string> = {
  added: "border-emerald-300 bg-emerald-50",
  removed: "border-red-300 bg-red-50",
  modified: "border-amber-300 bg-amber-50",
  unchanged: "border-slate-200 bg-slate-50",
};

const FRAME: Record<ChangeKind, string> = {
  added: "border-emerald-400",
  removed: "border-red-400",
  modified: "border-amber-400",
  unchanged: "border-slate-300",
};

function mult(m?: string) {
  return m ? `[${m}]` : "";
}

export function ReviewNode({ data }: NodeProps) {
  const d = data as ReviewNodeData;
  return (
    <div
      className={`min-w-[180px] rounded-md border bg-white shadow-sm ${
        FRAME[d.change]
      } ${d.selected ? "ring-2 ring-sky-300" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className={`rounded-t-md border-b px-2 py-1 text-center ${HEADER[d.change]}`}>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">
          «part def»
        </div>
        <div className="font-semibold text-slate-800">{d.name}</div>
        {d.specializations.length > 0 && (
          <div className="text-[11px] text-slate-500">
            :&gt; {d.specializations.join(", ")}
          </div>
        )}
      </div>

      {d.attributes.length > 0 && (
        <div className="border-b border-slate-100 px-2 py-1 text-xs text-slate-700">
          {d.attributes.map((a) => (
            <div key={a.id}>
              {a.name} <span className="text-slate-400">:</span>{" "}
              <span className="text-sky-700">{a.dataType}</span>
              <span className="text-slate-500">{mult(a.multiplicity)}</span>
            </div>
          ))}
        </div>
      )}

      {d.parts.length > 0 && (
        <div className="px-2 py-1 text-xs text-slate-700">
          {d.parts.map((p) => (
            <div key={p.id}>
              <span className="text-[10px] text-slate-400">
                {p.isReference ? "ref part" : "part"}
              </span>{" "}
              {p.name}
              {p.typeName && (
                <>
                  {" "}
                  <span className="text-slate-400">:</span>{" "}
                  <span className="text-emerald-700">{p.typeName}</span>
                </>
              )}
              <span className="text-slate-500">{mult(p.multiplicity)}</span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

export function ReviewRawNode({ data }: NodeProps) {
  const text = (data as { text: string }).text;
  return (
    <div className="max-w-[260px] rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-amber-600">
        unparsed · read-only
      </div>
      <pre className="whitespace-pre-wrap text-[11px] text-amber-900">{text}</pre>
    </div>
  );
}
