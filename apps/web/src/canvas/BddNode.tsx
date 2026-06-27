import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { childrenOf, DATA_TYPES } from "@sygil/model";
import { useSygil } from "../store/sygilStore.js";
import { EditableText } from "../components/EditableText.js";

export interface AttrRow {
  id: string;
  name: string;
  dataType: string;
  multiplicity?: string;
}
export interface PartRow {
  id: string;
  name: string;
  typeName?: string;
  isReference: boolean;
  multiplicity?: string;
}
export interface BddNodeData {
  partId: string;
  name: string;
  attributes: AttrRow[];
  parts: PartRow[];
  [key: string]: unknown;
}

function mult(m?: string) {
  return m ? `[${m}]` : "";
}

function DiagnosticBadge({ partId }: { partId: string }) {
  const diagnostics = useSygil((s) => s.diagnostics);
  const model = useSygil((s) => s.model);

  const counts = useMemo(() => {
    const childIds = new Set(childrenOf(model, partId).map((c) => c.id));
    childIds.add(partId);
    let errors = 0;
    let warnings = 0;
    for (const d of diagnostics) {
      if (!childIds.has(d.elementId)) continue;
      if (d.severity === "error") errors++;
      else warnings++;
    }
    return { errors, warnings };
  }, [diagnostics, model, partId]);

  if (counts.errors === 0 && counts.warnings === 0) return null;

  return (
    <div className="absolute -right-1.5 -top-1.5 flex items-center gap-0.5">
      {counts.errors > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {counts.errors}
        </span>
      )}
      {counts.warnings > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
          {counts.warnings}
        </span>
      )}
    </div>
  );
}

export function BddNode({ data, selected }: NodeProps) {
  const d = data as BddNodeData;
  const rename = useSygil((s) => s.renameElement);
  const retype = useSygil((s) => s.retypeAttribute);
  const addAttr = useSygil((s) => s.addAttributeTo);
  const addPart = useSygil((s) => s.addPartTo);

  return (
    <div
      className={`relative min-w-[180px] rounded-md border bg-white shadow-sm dark:bg-slate-900 ${
        selected
          ? "border-sky-500 ring-2 ring-sky-200 dark:ring-sky-900"
          : "border-slate-300 dark:border-slate-700"
      }`}
    >
      <DiagnosticBadge partId={d.partId} />
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="rounded-t-md border-b border-slate-200 bg-slate-50 px-2 py-1 text-center dark:border-slate-800 dark:bg-slate-800">
        <div className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          «part def»
        </div>
        <EditableText
          value={d.name}
          onCommit={(n) => rename(d.partId, n)}
          className="font-semibold text-slate-800 dark:text-slate-100"
        />
      </div>

      <div className="border-b border-slate-100 px-2 py-1 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
        {d.attributes.map((a) => (
          <div key={a.id} className="flex items-center gap-1">
            <EditableText value={a.name} onCommit={(n) => rename(a.id, n)} />
            <span className="text-slate-400 dark:text-slate-500">:</span>
            <select
              className="nodrag rounded border border-transparent bg-transparent text-sky-700 hover:border-slate-300 dark:text-sky-300 dark:hover:border-slate-600"
              value={d.attributes.find((x) => x.id === a.id)?.dataType}
              onChange={(e) => retype(a.id, e.target.value)}
            >
              {[...new Set([a.dataType, ...DATA_TYPES])].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-slate-500 dark:text-slate-400">{mult(a.multiplicity)}</span>
          </div>
        ))}
        <button
          className="nodrag mt-0.5 text-[11px] text-sky-600 hover:underline dark:text-sky-300"
          onClick={() => addAttr(d.partId)}
        >
          + attribute
        </button>
      </div>

      <div className="px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
        {d.parts.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {p.isReference ? "ref part" : "part"}
            </span>
            <EditableText value={p.name} onCommit={(n) => rename(p.id, n)} />
            {p.typeName && (
              <>
                <span className="text-slate-400 dark:text-slate-500">:</span>
                <span className="text-emerald-700 dark:text-emerald-300">{p.typeName}</span>
              </>
            )}
            <span className="text-slate-500 dark:text-slate-400">{mult(p.multiplicity)}</span>
          </div>
        ))}
        <button
          className="nodrag mt-0.5 text-[11px] text-sky-600 hover:underline dark:text-sky-300"
          onClick={() => addPart(d.partId)}
        >
          + part
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

export function RawNode({ data }: NodeProps) {
  const text = (data as { text: string }).text;
  return (
    <div className="max-w-[260px] rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1 dark:border-amber-500 dark:bg-amber-950/40">
      <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-300">
        unparsed · read-only
      </div>
      <pre className="whitespace-pre-wrap text-[11px] text-amber-900 dark:text-amber-100">{text}</pre>
    </div>
  );
}
