import { useState } from "react";
import { getRoot } from "@sygil/model";
import { GitHubProvider, LocalProvider, type GitProvider } from "@sygil/git";
import { useSygil } from "../store/sygilStore.js";
import { loadFromRepo, saveToRepo } from "../repo/repoIO.js";

type Mode = "local" | "github";

export function RepoBar() {
  const model = useSygil((s) => s.model);
  const diagrams = useSygil((s) => s.diagrams);
  const loadModel = useSygil((s) => s.loadModel);
  const [mode, setMode] = useState<Mode>("local");
  const [cfg, setCfg] = useState({ owner: "", repo: "", branch: "main", token: "" });
  const [status, setStatus] = useState("");
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
      return `Saved ${name} (${r.commitSha.slice(0, 7)})`;
    });

  const onLoad = () =>
    run("Loading", async () => {
      const { model: m, diagrams: d } = await loadFromRepo(provider(), name);
      loadModel(m, d);
      return `Loaded ${name} from repo`;
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
          {(["owner", "repo", "branch"] as const).map((k) => (
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
        </>
      )}

      <button
        onClick={onSave}
        className="rounded bg-slate-800 px-2 py-0.5 font-medium text-white hover:bg-slate-700"
      >
        Save
      </button>
      <button
        onClick={onLoad}
        className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100"
      >
        Load
      </button>
      {status && <span className="text-slate-500">{status}</span>}
    </div>
  );
}
