import { useState } from "react";
import { getRoot } from "@sygil/model";
import { GitHubProvider, LocalProvider, type GitProvider } from "../git/index.js";
import { loadFromRepo, saveToRepo } from "../repo/repoIO.js";
import { GitPanel, type GitPanelTab } from "./GitPanel.js";
import { ReviewOverlay } from "../review/ReviewOverlay.js";
import type { DiagramMeta } from "../types.js";
import type { Model } from "@sygil/model";

type Mode = "local" | "github";

function pickDefaultBase(branches: string[], fallback: string): string {
  if (branches.includes("main")) return "main";
  if (branches.includes("master")) return "master";
  return branches[0] ?? fallback;
}

interface Props {
  model: Model;
  diagrams: DiagramMeta[];
  text: string;
  dirty: boolean;
  loadModel: (model: Model, diagrams: DiagramMeta[]) => void;
  markSaved: (text: string) => void;
}

export function PlatformRepoBar({ model, diagrams, text, dirty, loadModel, markSaved }: Props) {
  const [mode, setMode] = useState<Mode>("local");
  const [cfg, setCfg] = useState({ owner: "", repo: "", branch: "main", token: "" });
  const [branches, setBranches] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [panel, setPanel] = useState<GitPanelTab | null>(null);
  const [review, setReview] = useState(false);
  const name = getRoot(model).name;

  const provider = (): GitProvider =>
    mode === "local" ? new LocalProvider() : new GitHubProvider(cfg);

  const run = async (label: string, fn: () => Promise<string>) => {
    try {
      setStatus(`${label}…`);
      setStatus(await fn());
    } catch (e) {
      setStatus(`Error: ${(e as Error).message}`);
    }
  };

  const onSave = () =>
    run("Saving", async () => {
      const r = await saveToRepo(provider(), model, diagrams);
      markSaved(text);
      return `Saved ${name} (${r.commitSha.slice(0, 7)})`;
    });

  const loadBranch = (branch: string) =>
    run("Loading", async () => {
      const p = mode === "local" ? new LocalProvider() : new GitHubProvider({ ...cfg, branch });
      const { model: m, diagrams: d } = await loadFromRepo(p, name);
      loadModel(m, d);
      return `Loaded ${name} from ${branch}`;
    });

  const onLoad = () => loadBranch(cfg.branch);

  const refreshBranches = () =>
    run("Fetching branches", async () => {
      const list = await provider().listBranches();
      setBranches(list);
      return `${list.length} branch${list.length === 1 ? "" : "es"}`;
    });

  const onSwitchBranch = (branch: string) => {
    if (branch === cfg.branch) return;
    if (dirty && !window.confirm("Discard unsaved changes and switch branches?"))
      return;
    setCfg((c) => ({ ...c, branch }));
    loadBranch(branch);
  };

  const onCreateBranch = () =>
    run("Creating branch", async () => {
      const branchName = window.prompt("New branch name (from " + cfg.branch + "):");
      if (!branchName) return "";
      await provider().createBranch(branchName, cfg.branch);
      setBranches((b) => [...new Set([...b, branchName])]);
      setCfg((c) => ({ ...c, branch: branchName }));
      return `Created and switched to ${branchName}`;
    });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as Mode)}
        className="rounded border border-slate-300 px-1 py-0.5"
      >
        <option value="local">Local (browser)</option>
        <option value="github">GitHub</option>
      </select>

      {mode === "github" && (
        <>
          {(["owner", "repo"] as const).map((k) => (
            <input
              key={k}
              placeholder={k}
              value={cfg[k]}
              onChange={(e) => setCfg({ ...cfg, [k]: e.target.value })}
              className="w-20 rounded border border-slate-300 px-1 py-0.5"
            />
          ))}
          <input
            placeholder="token"
            type="password"
            value={cfg.token}
            onChange={(e) => setCfg({ ...cfg, token: e.target.value })}
            className="w-24 rounded border border-slate-300 px-1 py-0.5"
          />
          <div className="flex items-center gap-1">
            <select
              value={cfg.branch}
              onChange={(e) => onSwitchBranch(e.target.value)}
              className="max-w-[140px] rounded border border-slate-300 px-1 py-0.5"
              title="Branch"
            >
              {[...new Set([cfg.branch, ...branches])].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button
              onClick={refreshBranches}
              className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100"
              title="Refresh branches"
            >
              ⟳
            </button>
            <button
              onClick={onCreateBranch}
              className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100"
              title="Create branch"
            >
              ＋
            </button>
          </div>
        </>
      )}

      <button
        onClick={onSave}
        className="rounded bg-slate-800 px-2 py-0.5 font-medium text-white hover:bg-slate-700"
      >
        Save{dirty ? " *" : ""}
      </button>
      <button
        onClick={onLoad}
        className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
      >
        Load
      </button>

      {mode === "github" && (
        <>
          <button
            onClick={() => setReview(true)}
            className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
          >
            Review changes
          </button>
          <button
            onClick={() => setPanel("diff")}
            className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
          >
            Text diff
          </button>
          <button
            onClick={() => setPanel("pr")}
            className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
          >
            Open PR
          </button>
        </>
      )}

      {status && <span className="text-slate-500">{status}</span>}

      {panel && mode === "github" && (
        <GitPanel
          provider={provider()}
          branches={branches}
          currentBranch={cfg.branch}
          defaultBase={pickDefaultBase(branches, cfg.branch)}
          modelName={name}
          initialTab={panel}
          onClose={() => setPanel(null)}
        />
      )}

      {review && mode === "github" && (
        <ReviewOverlay
          providerForBranch={(branch) => new GitHubProvider({ ...cfg, branch })}
          branches={branches}
          defaultBase={pickDefaultBase(branches, cfg.branch)}
          currentBranch={cfg.branch}
          modelName={name}
          onClose={() => setReview(false)}
        />
      )}
    </div>
  );
}
