import { builtinAdapters } from "@sygil/export";
import { useSygil } from "../store/sygilStore.js";
import { downloadArtifact } from "../repo/download.js";

export function ExportMenu() {
  const model = useSygil((s) => s.model);
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-slate-400">Export:</span>
      {builtinAdapters.map((a) => (
        <button
          key={a.id}
          title={a.label}
          onClick={() => a.export(model).forEach(downloadArtifact)}
          className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
        >
          {a.label.split(" ")[0]}
        </button>
      ))}
    </div>
  );
}
