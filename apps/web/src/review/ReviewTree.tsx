import type { DiagramSummary } from "./reviewDiff.js";

interface Props {
  summaries: DiagramSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Show every diagram, or only the ones with changes. */
  changedOnly: boolean;
}

function CountBadges({ s }: { s: DiagramSummary }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px]">
      {s.added > 0 && (
        <span className="rounded bg-emerald-100 px-1 text-emerald-700">+{s.added}</span>
      )}
      {s.removed > 0 && (
        <span className="rounded bg-red-100 px-1 text-red-700">-{s.removed}</span>
      )}
      {s.modified > 0 && (
        <span className="rounded bg-amber-100 px-1 text-amber-800">~{s.modified}</span>
      )}
      {s.status === "added" && (
        <span className="rounded bg-emerald-100 px-1 text-emerald-700">new</span>
      )}
      {s.status === "removed" && (
        <span className="rounded bg-red-100 px-1 text-red-700">del</span>
      )}
    </span>
  );
}

export function ReviewTree({ summaries, selectedId, onSelect, changedOnly }: Props) {
  const shown = changedOnly ? summaries.filter((s) => s.hasChanges) : summaries;

  // Group by derived package label.
  const groups = new Map<string, DiagramSummary[]>();
  for (const s of shown) {
    const g = groups.get(s.packageLabel) ?? [];
    g.push(s);
    groups.set(s.packageLabel, g);
  }
  const packages = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  if (shown.length === 0) {
    return (
      <div className="p-3 text-xs italic text-slate-400">
        No diagrams with changes.
      </div>
    );
  }

  return (
    <div className="select-none py-1 text-slate-700">
      {packages.map((pkg) => (
        <div key={pkg}>
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {pkg}
          </div>
          {groups.get(pkg)!.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex w-full items-center gap-1 px-3 py-1 text-left text-xs ${
                  active ? "bg-sky-50 font-medium text-sky-700" : "hover:bg-slate-100"
                }`}
              >
                <span className="truncate">{s.name}</span>
                <CountBadges s={s} />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
