import { useCallback, useEffect, useMemo, useState } from "react";
import type { GitProvider } from "@sygil/git";
import type { Model } from "@sygil/model";
import { diffModels, type BlockDiff } from "../repo/modelDiff.js";
import { loadFromRepo } from "../repo/repoIO.js";
import type { DiagramMeta } from "../store/sygilStore.js";
import { changeByQname, diagramSummaries } from "./reviewDiff.js";
import { ReviewTree } from "./ReviewTree.js";
import { ReviewCanvas } from "./ReviewCanvas.js";
import { ElementInspector } from "./ElementInspector.js";

interface RepoState {
  model: Model;
  diagrams: DiagramMeta[];
}

interface Props {
  providerForBranch: (branch: string) => GitProvider;
  branches: string[];
  defaultBase: string;
  currentBranch: string;
  modelName: string;
  onClose: () => void;
}

export function ReviewOverlay({
  providerForBranch,
  branches,
  defaultBase,
  currentBranch,
  modelName,
  onClose,
}: Props) {
  const [base, setBase] = useState(defaultBase);
  const [head, setHead] = useState(currentBranch);
  const [baseState, setBaseState] = useState<RepoState | null>(null);
  const [headState, setHeadState] = useState<RepoState | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(null);
  const [selectedQname, setSelectedQname] = useState<string | null>(null);
  const [focusQname, setFocusQname] = useState<string | null>(null);
  const [changesOnly, setChangesOnly] = useState(true);

  const branchOptions = branches.length ? branches : [currentBranch, defaultBase];

  const load = useCallback(async () => {
    setBusy(true);
    setStatus("Loading both branches…");
    setBaseState(null);
    setHeadState(null);
    try {
      const [b, h] = await Promise.all([
        loadFromRepo(providerForBranch(base), modelName),
        loadFromRepo(providerForBranch(head), modelName),
      ]);
      setBaseState(b);
      setHeadState(h);
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [base, head, modelName, providerForBranch]);

  // Load on first open.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const derived = useMemo(() => {
    if (!baseState || !headState) return null;
    const changes = changeByQname(baseState.model, headState.model);
    const summaries = diagramSummaries(
      baseState.model,
      baseState.diagrams,
      headState.model,
      headState.diagrams,
    );
    const diffByQname = new Map<string, BlockDiff>();
    for (const d of diffModels(baseState.model, headState.model)) {
      diffByQname.set(d.qname, d);
    }
    return { changes, summaries, diffByQname };
  }, [baseState, headState]);

  // Default-select the first changed diagram once data loads.
  useEffect(() => {
    if (!derived) return;
    const firstChanged =
      derived.summaries.find((s) => s.hasChanges) ?? derived.summaries[0];
    setSelectedDiagramId(firstChanged?.id ?? null);
    setSelectedQname(null);
  }, [derived]);

  const baseLayout =
    baseState?.diagrams.find((d) => d.id === selectedDiagramId)?.layout ?? {};
  const headLayout =
    headState?.diagrams.find((d) => d.id === selectedDiagramId)?.layout ?? {};

  // Changed elements placed on the selected diagram, for prev/next navigation.
  const changedQnames = useMemo(() => {
    if (!derived) return [];
    const placed = new Set<string>([
      ...Object.keys(baseLayout),
      ...Object.keys(headLayout),
    ]);
    return [...placed].filter((qn) => {
      const k = derived.changes.get(qn);
      return k === "added" || k === "removed" || k === "modified";
    });
  }, [derived, baseLayout, headLayout]);

  const jump = (dir: 1 | -1) => {
    if (changedQnames.length === 0) return;
    const cur = selectedQname ? changedQnames.indexOf(selectedQname) : -1;
    const next =
      (cur + dir + changedQnames.length) % changedQnames.length;
    const qn = changedQnames[next];
    setSelectedQname(qn);
    setFocusQname(qn);
  };

  const selectedDiff = selectedQname
    ? derived?.diffByQname.get(selectedQname) ?? null
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2 text-sm">
        <span className="font-semibold text-slate-800">Review changes</span>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          base
          <select
            value={base}
            onChange={(e) => setBase(e.target.value)}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            {[...new Set(branchOptions)].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <span className="text-slate-400">←</span>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          compare
          <select
            value={head}
            onChange={(e) => setHead(e.target.value)}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            {[...new Set(branchOptions)].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <button
          onClick={load}
          disabled={busy}
          className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          Compare
        </button>

        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={changesOnly}
            onChange={(e) => setChangesOnly(e.target.checked)}
          />
          Changes only
        </label>
        <div className="flex items-center gap-1">
          <button
            onClick={() => jump(-1)}
            disabled={changedQnames.length === 0}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40"
            title="Previous change"
          >
            ↑
          </button>
          <button
            onClick={() => jump(1)}
            disabled={changedQnames.length === 0}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-40"
            title="Next change"
          >
            ↓
          </button>
          <span className="text-[11px] text-slate-400">
            {changedQnames.length} changed
          </span>
        </div>

        {status && <span className="text-xs text-slate-500">{status}</span>}
        <button
          onClick={onClose}
          className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"
          title="Close"
        >
          ✕
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-200">
          {derived ? (
            <ReviewTree
              summaries={derived.summaries}
              selectedId={selectedDiagramId}
              onSelect={(id) => {
                setSelectedDiagramId(id);
                setSelectedQname(null);
              }}
              changedOnly={changesOnly}
            />
          ) : (
            <p className="p-3 text-xs text-slate-400">{status || "Loading…"}</p>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="grid flex-1 grid-cols-2 divide-x divide-slate-200">
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                base · {base}
              </div>
              <div className="min-h-0 flex-1">
                {baseState && derived && (
                  <ReviewCanvas
                    model={baseState.model}
                    layout={baseLayout}
                    changes={derived.changes}
                    changesOnly={changesOnly}
                    selectedQname={selectedQname}
                    focusQname={focusQname}
                    onSelect={setSelectedQname}
                  />
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                head · {head}
              </div>
              <div className="min-h-0 flex-1">
                {headState && derived && (
                  <ReviewCanvas
                    model={headState.model}
                    layout={headLayout}
                    changes={derived.changes}
                    changesOnly={changesOnly}
                    selectedQname={selectedQname}
                    focusQname={focusQname}
                    onSelect={setSelectedQname}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200">
          <ElementInspector diff={selectedDiff} baseBranch={base} headBranch={head} />
        </aside>
      </div>
    </div>
  );
}
