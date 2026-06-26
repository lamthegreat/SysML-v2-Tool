import type { Model } from "@sygil/model";
import { serialize, parse } from "@sygil/sysml-notation";
import type { DiagramMeta } from "../store/sygilStore.js";

const STORAGE_KEY = "sygil_autosave";

interface LocalSnapshot {
  text: string;
  diagrams: DiagramMeta[];
}

export function saveLocal(model: Model, diagrams: DiagramMeta[]): void {
  const snapshot: LocalSnapshot = {
    text: serialize(model),
    diagrams,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

export function loadLocal(): { model: Model; diagrams: DiagramMeta[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as LocalSnapshot;
    const { model, errors } = parse(snapshot.text);
    if (!model) return null;
    if (errors.length > 0) return null;
    return { model, diagrams: snapshot.diagrams };
  } catch {
    return null;
  }
}
