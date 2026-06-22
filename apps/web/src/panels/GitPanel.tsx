import { useState } from "react";
import type { FileDiff, GitProvider, PullRequest } from "@sygil/git";
import type { Model } from "@sygil/model";
import { parse } from "@sygil/sysml-notation";
import { parsePatch, type DiffLineType } from "../repo/diff.js";
import { VisualDiff } from "./VisualDiff.js";

export type GitPanelTab = "diff" | "visual" | "pr";

interface Props {
  provider: GitProvider;
  /** Factory to create a provider pointed at a specific branch. */
  providerForBranch: (branch: string) => GitProvider;
  branches: string[];
  /** The branch currently loaded in the app (default PR/diff head). */
  currentBranch: string;
  /** Suggested base branch (e.g. the repo default). */
  defaultBase: string;
  /** Model/package name — seeds the PR title and file-path lookups. */
  modelName: string;
  /** The current in-memory model (head side of the visual diff). */
  headModel: Model;
  initialTab: GitPanelTab;
  onClose: () => void;
}

const LINE_CLASS: Record<DiffLineType, string> = {
  add: "bg-emerald-50 text-emerald-800",
  del: "bg-red-50 text-red-700",
  hunk: "bg-slate-100 text-slate-500",
  meta: "text-slate-400",
  context: "text-slate-700",
};

function DiffView({ file }: { file: FileDiff }) {
  const lines = parsePatch(file.patch);
  return (
    <div className="overflow-hidden rounded border border-slate-200">
      <div className="flex items-center justify-between bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
        <span className="truncate">{file.path}</span>
        <span className="ml-2 shrink-0 rounded bg-slate-200 px-1.5 text-[10px] uppercase text-slate-500">
          {file.status}
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="px-2 py-1 text-xs italic text-slate-400">
          No textual diff (binary or too large).
        </div>
      ) : (
        <pre className="overflow-x-auto text-xs leading-5">
          {lines.map((l, i) => (
            <div key={i} className={`px-2 ${LINE_CLASS[l.type]}`}>
              {l.text || " "}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

export function GitPanel({
  provider,
  providerForBranch,
  branches,
  currentBranch,
  defaultBase,
  modelName,
  headModel,
  initialTab,
  onClose,
}: Props) {
  const [tab, setTab] = useState<GitPanelTab>(initialTab);
  const [base, setBase] = useState(defaultBase);
  const [head, setHead] = useState(currentBranch);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // text diff state
  const [files, setFiles] = useState<FileDiff[] | null>(null);
  // visual diff state
  const [baseModel, setBaseModel] = useState<Model | null>(null);
  // pr state
  const [title, setTitle] = useState(`Update ${modelName}`);
  const [body, setBody] = useState("");
  const [created, setCreated] = useState<PullRequest | null>(null);

  const branchOptions = branches.length ? branches : [currentBranch, defaultBase];

  const onCompare = async () => {
    setBusy(true);
    setStatus("Comparing…");
    setFiles(null);
    try {
      const result = await provider.compareBranches(base, head);
      setFiles(result);
      setStatus(result.length ? "" : "No changes between these branches.");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onVisualCompare = async () => {
    setBusy(true);
    setStatus("Fetching base model…");
    setBaseModel(null);
    try {
      const baseProvider = providerForBranch(base);
      const text = await baseProvider.readFile(`model/${modelName}.sysml`);
      const { model, errors } = parse(text);
      if (!model) {
        setStatus(`Parse error on base: ${errors[0]?.message ?? "unknown"}`);
        return;
      }
      setBaseModel(model);
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const onCreatePR = async () => {
    if (!title.trim()) {
      setStatus("A title is required.");
      return;
    }
    if (base === head) {
      setStatus("Base and head must differ.");
      return;
    }
    setBusy(true);
    setStatus("Opening pull request…");
    try {
      const pr = await provider.createPullRequest({ title, head, base, body });
      setCreated(pr);
      setStatus("");
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const BranchSelect = ({
    value,
    onChange,
    label,
  }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
  }) => (
    <label className="flex items-center gap-1 text-xs text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 px-1 py-0.5"
      >
        {[...new Set(branchOptions)].map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[80vh] w-full flex-col rounded-lg bg-white shadow-xl ${
          tab === "visual" ? "max-w-4xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
          <div className="flex gap-1">
            {(["diff", "visual", "pr"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded px-2 py-1 text-sm font-medium ${
                  tab === t ? "bg-sky-100 text-sky-700" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t === "diff" ? "Text diff" : t === "visual" ? "Visual diff" : "Open PR"}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Close"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
          <BranchSelect value={base} onChange={setBase} label="base" />
          <span className="text-slate-400">←</span>
          <BranchSelect value={head} onChange={setHead} label="compare" />
          {(tab === "diff" || tab === "visual") && (
            <button
              onClick={tab === "visual" ? onVisualCompare : onCompare}
              disabled={busy}
              className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Compare
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {tab === "diff" ? (
            <div className="space-y-3">
              {files?.map((f) => <DiffView key={f.path} file={f} />)}
              {!files && !status && (
                <p className="text-xs text-slate-400">
                  Choose branches and Compare to see the diff.
                </p>
              )}
            </div>
          ) : tab === "visual" ? (
            baseModel ? (
              <VisualDiff
                baseModel={baseModel}
                headModel={headModel}
                baseBranch={base}
                headBranch={head}
              />
            ) : (
              !status && (
                <p className="text-xs text-slate-400">
                  Choose branches and Compare to see the visual model diff.
                </p>
              )
            )
          ) : created ? (
            <div className="text-sm">
              <p className="mb-2 text-emerald-700">
                Pull request #{created.number} opened.
              </p>
              <a
                href={created.url}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 underline"
              >
                {created.url}
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Pull request title"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Description (optional)"
                rows={4}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={onCreatePR}
                disabled={busy}
                className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                Create pull request
              </button>
            </div>
          )}
        </div>

        {status && (
          <footer className="border-t border-slate-200 px-4 py-1.5 text-xs text-slate-500">
            {status}
          </footer>
        )}
      </div>
    </div>
  );
}
