import { ReactFlowProvider } from "@xyflow/react";
import { useSygil } from "./store/sygilStore.js";
import { BddCanvas } from "./canvas/BddCanvas.js";
import { TextEditor } from "./panels/TextEditor.js";
import { RepoBar } from "./panels/RepoBar.js";
import { ExportMenu } from "./panels/ExportMenu.js";

export function App() {
  const addBlock = useSygil((s) => s.addBlock);
  const errors = useSygil((s) => s.errors);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-800">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Sygil
          </span>
          <span className="text-xs text-slate-400">SysML v2 · BDD</span>
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
        <RepoBar />
      </header>

      <main className="flex min-h-0 flex-1">
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
