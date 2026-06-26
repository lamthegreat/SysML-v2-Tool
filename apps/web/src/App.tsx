import { lazy, Suspense, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useSygil, isDirty } from "./store/sygilStore.js";
import { BddCanvas } from "./canvas/BddCanvas.js";
import { TextEditor } from "./panels/TextEditor.js";
import { ContainmentTree } from "./panels/ContainmentTree.js";
import { RepoBar } from "./panels/RepoBar.js";
import { ExportMenu } from "./panels/ExportMenu.js";
import { PLATFORM } from "./features.js";

const LazyPlatformRepoBar = PLATFORM
  ? lazy(() =>
      import("@sygil/platform").then((m) => ({ default: m.PlatformRepoBar })),
    )
  : null;

export function App() {
  const addBlock = useSygil((s) => s.addBlock);
  const errors = useSygil((s) => s.errors);
  const activeDiagram = useSygil((s) =>
    s.diagrams.find((d) => d.id === s.activeDiagramId),
  );
  const model = useSygil((s) => s.model);
  const diagrams = useSygil((s) => s.diagrams);
  const text = useSygil((s) => s.text);
  const dirty = useSygil((s) => isDirty(s));
  const loadModel = useSygil((s) => s.loadModel);
  const markSaved = useSygil((s) => s.markSaved);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-800">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-3 py-2">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <path d="M1 3h14v1.5H1zM1 7.25h14v1.5H1zM1 11.5h14V13H1z" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Sygil
          </span>
          <span className="text-xs text-slate-400">
            SysML v2 · {activeDiagram?.name ?? "BDD"}
          </span>
        </div>
        <button
          onClick={addBlock}
          className="rounded bg-sky-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Block
        </button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <ExportMenu />
        <div className="mx-1 h-5 w-px bg-slate-200" />
        {PLATFORM && LazyPlatformRepoBar ? (
          <Suspense fallback={<span className="text-xs text-slate-400">Loading…</span>}>
            <LazyPlatformRepoBar
              model={model}
              diagrams={diagrams}
              text={text}
              dirty={dirty}
              loadModel={loadModel}
              markSaved={markSaved}
            />
          </Suspense>
        ) : (
          <RepoBar />
        )}
      </header>

      <main className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-300 bg-white py-1">
            <ContainmentTree />
          </aside>
        )}

        <section className="relative min-w-0 flex-1 border-r border-slate-300">
          <ReactFlowProvider>
            <BddCanvas />
          </ReactFlowProvider>
        </section>

        <section className="flex w-2/5 min-w-[320px] flex-col bg-white">
          <div className="border-b border-slate-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            SysML v2 textual notation · editable
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TextEditor />
          </div>
          <div
            className={`border-t px-3 py-1 text-xs ${
              errors.length
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {errors.length
              ? `${errors.length} parse issue${errors.length > 1 ? "s" : ""}: ${errors[0].message}`
              : "Parsed OK — diagram in sync"}
          </div>
        </section>
      </main>
    </div>
  );
}
