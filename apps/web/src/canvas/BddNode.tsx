import { Handle, Position, type NodeProps } from "@xyflow/react";
import { DATA_TYPES } from "@sygil/model";
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

export function BddNode({ data, selected }: NodeProps) {
  const d = data as BddNodeData;
  const rename = useSygil((s) => s.renameElement);
  const retype = useSygil((s) => s.retypeAttribute);
  const addAttr = useSygil((s) => s.addAttributeTo);
  const addPart = useSygil((s) => s.addPartTo);

  return (
    <div
      className={`min-w-[180px] rounded-md border bg-white shadow-sm ${
        selected ? "border-sky-500 ring-2 ring-sky-200" : "border-slate-300"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="rounded-t-md border-b border-slate-200 bg-slate-50 px-2 py-1 text-center">
        <div className="text-[10px] uppercase tracking-wide text-slate-400">
          «part def»
        </div>
        <EditableText
          value={d.name}
          onCommit={(n) => rename(d.partId, n)}
          className="font-semibold text-slate-800"
        />
      </div>

      <div className="border-b border-slate-100 px-2 py-1 text-xs text-slate-700">
        {d.attributes.map((a) => (
          <div key={a.id} className="flex items-center gap-1">
            <EditableText value={a.name} onCommit={(n) => rename(a.id, n)} />
            <span className="text-slate-400">:</span>
            <select
              className="nodrag rounded border border-transparent bg-transparent text-sky-700 hover:border-slate-300"
              value={d.attributes.find((x) => x.id === a.id)?.dataType}
              onChange={(e) => retype(a.id, e.target.value)}
            >
              {[...new Set([a.dataType, ...DATA_TYPES])].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-slate-500">{mult(a.multiplicity)}</span>
          </div>
        ))}
        <button
          className="nodrag mt-0.5 text-[11px] text-sky-600 hover:underline"
          onClick={() => addAttr(d.partId)}
        >
          + attribute
        </button>
      </div>

      <div className="px-2 py-1 text-xs text-slate-700">
        {d.parts.map((p) => (
          <div key={p.id} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400">
              {p.isReference ? "ref part" : "part"}
            </span>
            <EditableText value={p.name} onCommit={(n) => rename(p.id, n)} />
            {p.typeName && (
              <>
                <span className="text-slate-400">:</span>
                <span className="text-emerald-700">{p.typeName}</span>
              </>
            )}
            <span className="text-slate-500">{mult(p.multiplicity)}</span>
          </div>
        ))}
        <button
          className="nodrag mt-0.5 text-[11px] text-sky-600 hover:underline"
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
    <div className="max-w-[260px] rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-amber-600">
        unparsed · read-only
      </div>
      <pre className="whitespace-pre-wrap text-[11px] text-amber-900">{text}</pre>
    </div>
  );
}
