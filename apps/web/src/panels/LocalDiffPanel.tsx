import { useMemo } from "react";
import type { Model } from "@sygil/model";
import { parse } from "@sygil/sysml-notation";
import { VisualDiff } from "./VisualDiff.js";

interface Props {
  savedText: string;
  currentModel: Model;
  onClose: () => void;
}

export function LocalDiffPanel({ savedText, currentModel, onClose }: Props) {
  const savedModel = useMemo<Model | null>(() => {
    const { model } = parse(savedText);
    return model;
  }, [savedText]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center border-b border-slate-200 px-4 py-2">
          <span className="text-sm font-medium text-sky-700">
            Visual diff — unsaved changes
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100"
            title="Close"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {savedModel ? (
            <VisualDiff
              baseModel={savedModel}
              headModel={currentModel}
              baseBranch="Last saved"
              headBranch="Current"
            />
          ) : (
            <p className="text-xs text-slate-400">
              Could not parse the saved model state.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
