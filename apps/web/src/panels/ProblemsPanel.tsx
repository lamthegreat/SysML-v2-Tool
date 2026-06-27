import { useMemo } from "react";
import { getElement, type Diagnostic } from "@sygil/model";
import { useSygil } from "../store/sygilStore.js";

function SeverityIcon({ severity }: { severity: Diagnostic["severity"] }) {
  if (severity === "error") {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-red-500" fill="currentColor">
        <circle cx="8" cy="8" r="7" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="white" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-amber-500" fill="currentColor">
      <path d="M8 1l7 13H1L8 1z" />
      <path d="M7.25 6h1.5v3.5h-1.5zM7.25 10.5h1.5V12h-1.5z" fill="white" />
    </svg>
  );
}

export function ProblemsPanel() {
  const diagnostics = useSygil((s) => s.diagnostics);
  const model = useSygil((s) => s.model);
  const setSelected = useSygil((s) => s.setSelected);

  const { errors, warnings } = useMemo(() => {
    const errors: Diagnostic[] = [];
    const warnings: Diagnostic[] = [];
    for (const d of diagnostics) {
      if (d.severity === "error") errors.push(d);
      else warnings.push(d);
    }
    return { errors, warnings };
  }, [diagnostics]);

  if (diagnostics.length === 0) {
    return (
      <div className="px-3 py-2 text-[11px] text-slate-400 dark:text-slate-500">
        No problems detected.
      </div>
    );
  }

  function renderRow(d: Diagnostic) {
    const el = getElement(model, d.elementId);
    return (
      <button
        key={`${d.code}-${d.elementId}`}
        className="flex w-full items-center gap-1.5 rounded-sm px-2 py-0.5 text-left text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
        onClick={() => setSelected(d.elementId)}
      >
        <SeverityIcon severity={d.severity} />
        <span className="truncate text-slate-700 dark:text-slate-300">{d.message}</span>
        {el && (
          <span className="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
            {el.name}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="select-none text-slate-700 dark:text-slate-300">
      {errors.length > 0 && (
        <div>
          <div className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
            Errors ({errors.length})
          </div>
          {errors.map(renderRow)}
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <div className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Warnings ({warnings.length})
          </div>
          {warnings.map(renderRow)}
        </div>
      )}
    </div>
  );
}
