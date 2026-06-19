import { create } from "zustand";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  byQualifiedName,
  createModel,
  getElement,
  partDefs,
  qualifiedName,
  remove,
  rename,
  setSpecializations,
  type Model,
} from "@sygil/model";
import { parse, serialize, type ParseError } from "@sygil/sysml-notation";

export interface NodePos {
  x: number;
  y: number;
}

export type Layout = Record<string, NodePos>;

interface SygilState {
  model: Model;
  /** Editor buffer — may be mid-edit / not yet normalized. */
  text: string;
  errors: ParseError[];
  /** Node positions, keyed by qualified name (the rename-stable identity key). */
  layout: Layout;
  selectedId: string | null;

  /** Replace the whole model + layout (e.g. after loading from a repo). */
  loadModel: (model: Model, layout: Layout) => void;

  /** Text surface → model (debounced parse handled by the editor component). */
  setTextFromEditor: (text: string) => void;
  setSelected: (id: string | null) => void;
  setNodePosition: (qname: string, pos: NodePos) => void;

  // Diagram surface → model
  addBlock: () => void;
  renameElement: (id: string, name: string) => void;
  retypeAttribute: (id: string, dataType: string) => void;
  addAttributeTo: (partId: string) => void;
  addPartTo: (partId: string) => void;
  addSpecialization: (specificId: string, generalId: string) => void;
  removeElement: (id: string) => void;
}

/** Auto-place a node that has no saved position (simple 4-column cascade). */
function autoPos(index: number): NodePos {
  return { x: 60 + (index % 4) * 280, y: 60 + Math.floor(index / 4) * 240 };
}

/**
 * Reconcile node positions against the current model, keyed by qualified name.
 * Surviving elements keep their position; new ones get auto-placed; stale keys
 * drop out. This is what preserves diagram layout across both text and diagram
 * edits (and across renames, since the store migrates the key on rename).
 */
function reconcileLayout(model: Model, prev: Layout): Layout {
  const next: Layout = {};
  let placed = Object.keys(prev).length;
  partDefs(model).forEach((pd) => {
    const qn = qualifiedName(model, pd.id);
    next[qn] = prev[qn] ?? autoPos(placed++);
  });
  return next;
}

function seedModel(): Model {
  let m = createModel("VehicleModel");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  const sc = addPartDef(m, "SportsCar", ["Vehicle"]);
  m = sc.model;
  m = addAttribute(m, sc.id, "topSpeed", "Real").model;
  m = addPartDef(m, "Engine").model;
  return m;
}

export const useSygil = create<SygilState>((set, get) => {
  /** Diagram edit committed: model is truth → reserialize text (tool owns formatting). */
  const applyFromDiagram = (model: Model) =>
    set((s) => ({
      model,
      text: serialize(model),
      errors: [],
      layout: reconcileLayout(model, s.layout),
    }));

  const initial = seedModel();

  return {
    model: initial,
    text: serialize(initial),
    errors: [],
    layout: reconcileLayout(initial, {}),
    selectedId: null,

    loadModel: (model, layout) =>
      set({
        model,
        text: serialize(model),
        errors: [],
        layout: reconcileLayout(model, layout),
        selectedId: null,
      }),

    setTextFromEditor: (text) => {
      const { model, errors } = parse(text);
      set((s) => ({
        text, // keep the user's buffer; do not reformat mid-edit
        errors,
        // Diagram tracks the last successfully parsed model; hold steady on fatal errors.
        model: model ?? s.model,
        layout: model ? reconcileLayout(model, s.layout) : s.layout,
      }));
    },

    setSelected: (id) => set({ selectedId: id }),

    setNodePosition: (qname, pos) =>
      set((s) => ({ layout: { ...s.layout, [qname]: pos } })),

    addBlock: () => {
      const existing = new Set(partDefs(get().model).map((p) => p.name));
      let i = 1;
      let name = "NewBlock";
      while (existing.has(name)) name = `NewBlock${i++}`;
      applyFromDiagram(addPartDef(get().model, name).model);
    },

    renameElement: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const model = get().model;
      const el = getElement(model, id);
      if (!el) return;
      // Migrate layout key so the node keeps its position across the rename.
      if (el.kind === "partDef") {
        const oldQn = qualifiedName(model, id);
        const newModel = rename(model, id, trimmed);
        const newQn = qualifiedName(newModel, id);
        set((s) => {
          const layout = { ...s.layout };
          if (layout[oldQn]) {
            layout[newQn] = layout[oldQn];
            delete layout[oldQn];
          }
          return { model: newModel, text: serialize(newModel), errors: [], layout };
        });
        return;
      }
      applyFromDiagram(rename(model, id, trimmed));
    },

    retypeAttribute: (id, dataType) => {
      const model = get().model;
      const el = getElement(model, id);
      if (!el || el.kind !== "attributeUsage") return;
      applyFromDiagram({
        ...model,
        elements: { ...model.elements, [id]: { ...el, dataType } },
      });
    },

    addAttributeTo: (partId) => {
      const part = getElement(get().model, partId);
      if (!part || part.kind !== "partDef") return;
      applyFromDiagram(addAttribute(get().model, partId, "newAttr", "Real").model);
    },

    addPartTo: (partId) => {
      const part = getElement(get().model, partId);
      if (!part || part.kind !== "partDef") return;
      applyFromDiagram(addPartUsage(get().model, partId, "newPart").model);
    },

    addSpecialization: (specificId, generalId) => {
      const model = get().model;
      const specific = getElement(model, specificId);
      const general = getElement(model, generalId);
      if (
        !specific ||
        specific.kind !== "partDef" ||
        !general ||
        general.kind !== "partDef" ||
        specificId === generalId
      )
        return;
      const specs = new Set(specific.specializations);
      specs.add(general.name);
      applyFromDiagram(setSpecializations(model, specificId, [...specs]));
    },

    removeElement: (id) => {
      applyFromDiagram(remove(get().model, id));
      if (get().selectedId === id) set({ selectedId: null });
    },
  };
});

/** Resolve a PartDef id from a qualified name (used by canvas connect handlers). */
export function partIdByQName(model: Model, qname: string): string | undefined {
  return byQualifiedName(model)[qname];
}
