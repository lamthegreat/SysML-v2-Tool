import { lazy, Suspense, useEffect, useState } from "react";
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

type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("sygil-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("sygil-theme", theme);
  }, [isDark, theme]);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
            <path d="M1 3h14v1.5H1zM1 7.25h14v1.5H1zM1 11.5h14V13H1z" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Sygil
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            SysML v2 · {activeDiagram?.name ?? "BDD"}
          </span>
        </div>
        <button
          onClick={addBlock}
          className="rounded bg-sky-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Block
        </button>
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((open) => !open)}
            className={`flex items-center gap-1 rounded border px-2 py-1 text-sm font-medium ${
              settingsOpen
                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
                : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            aria-expanded={settingsOpen}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
              <path d="M7.35 1.5h1.3l.28 1.43c.35.11.68.25.99.42l1.2-.82.92.92-.82 1.2c.17.31.31.64.42.99l1.43.28v1.3l-1.43.28c-.11.35-.25.68-.42.99l.82 1.2-.92.92-1.2-.82c-.31.17-.64.31-.99.42l-.28 1.43h-1.3l-.28-1.43a4.5 4.5 0 0 1-.99-.42l-1.2.82-.92-.92.82-1.2a4.5 4.5 0 0 1-.42-.99l-1.43-.28v-1.3l1.43-.28c.11-.35.25-.68.42-.99l-.82-1.2.92-.92 1.2.82c.31-.17.64-.31.99-.42L7.35 1.5zM8 5.05a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z" />
            </svg>
            Settings
          </button>
          {settingsOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-56 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Appearance
              </div>
              <div className="grid grid-cols-2 rounded border border-slate-300 p-0.5 dark:border-slate-700">
                {(["light", "dark"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setTheme(option)}
                    className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                      theme === option
                        ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                    aria-pressed={theme === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <ExportMenu />
        <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
        {PLATFORM && LazyPlatformRepoBar ? (
          <Suspense fallback={<span className="text-xs text-slate-400 dark:text-slate-500">Loading…</span>}>
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
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-300 bg-white py-1 dark:border-slate-800 dark:bg-slate-900">
            <ContainmentTree />
          </aside>
        )}

        <section className="relative min-w-0 flex-1 border-r border-slate-300 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
          <ReactFlowProvider>
            <BddCanvas theme={theme} />
          </ReactFlowProvider>
        </section>

        <section className="flex w-2/5 min-w-[320px] flex-col bg-white dark:bg-slate-900">
          <div className="border-b border-slate-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            SysML v2 textual notation · editable
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TextEditor theme={theme} />
          </div>
          <div
            className={`border-t px-3 py-1 text-xs ${
              errors.length
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300"
                : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500"
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
