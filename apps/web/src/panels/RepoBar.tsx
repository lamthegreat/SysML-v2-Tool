import { useState } from "react";
import { getRoot } from "@sygil/model";
import { useSygil, isDirty } from "../store/sygilStore.js";
import { saveLocal } from "../repo/localIO.js";

export function RepoBar() {
  const model = useSygil((s) => s.model);
  const diagrams = useSygil((s) => s.diagrams);
  const dirty = useSygil((s) => isDirty(s));
  const markSaved = useSygil((s) => s.markSaved);
  const text = useSygil((s) => s.text);
  const [status, setStatus] = useState("");
  const name = getRoot(model).name;

  const onSave = () => {
    saveLocal(model, diagrams);
    markSaved(text);
    setStatus(`Saved ${name}`);
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span className="font-medium text-slate-700">{name}</span>
      <button
        onClick={onSave}
        className="rounded bg-slate-800 px-2 py-0.5 font-medium text-white hover:bg-slate-700"
      >
        Save{dirty ? " *" : ""}
      </button>
      {status && <span className="text-slate-500">{status}</span>}
    </div>
  );
}
