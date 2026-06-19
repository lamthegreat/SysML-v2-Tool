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
  shortId,
  type Model,
} from "@sygil/model";
import { parse, serialize, type ParseError } from "@sygil/sysml-notation";

export interface NodePos {
  x: number;
  y: number;
}

export type Layout = Record<string, NodePos>;

export interface DiagramMeta {
  id: string;
  kind: "bdd";
  name: string;
  layout: Layout;
}

interface SygilState {
  model: Model;
  text: string;
  errors: ParseError[];
  diagrams: DiagramMeta[];
  activeDiagramId: string;
  selectedId: string | null;

  loadModel: (model: Model, diagrams: DiagramMeta[]) => void;
  setTextFromEditor: (text: string) => void;
  setSelected: (id: string | null) => void;
  setNodePosition: (qname: string, pos: NodePos) => void;

  addBlock: () => void;
  renameElement: (id: string, name: string) => void;
  retypeAttribute: (id: string, dataType: string) => void;
  addAttributeTo: (partId: string) => void;
  addPartTo: (partId: string) => void;
  addSpecialization: (specificId: string, generalId: string) => void;
  removeElement: (id: string) => void;

  addDiagram: (name?: string) => void;
  renameDiagram: (id: string, name: string) => void;
  deleteDiagram: (id: string) => void;
  setActiveDiagram: (id: string) => void;
}

function autoPos(index: number): NodePos {
  return { x: 60 + (index % 4) * 280, y: 60 + Math.floor(index / 4) * 240 };
}

function reconcileLayout(model: Model, prev: Layout): Layout {
  const next: Layout = {};
  let placed = Object.keys(prev).length;
  partDefs(model).forEach((pd) => {
    const qn = qualifiedName(model, pd.id);
    next[qn] = prev[qn] ?? autoPos(placed++);
  });
  return next;
}

function reconcileAllDiagrams(model: Model, diagrams: DiagramMeta[]): DiagramMeta[] {
  return diagrams.map((d) => ({ ...d, layout: reconcileLayout(model, d.layout) }));
}

function updateActiveDiagramLayout(
  diagrams: DiagramMeta[],
  activeDiagramId: string,
  updater: (prev: Layout) => Layout,
): DiagramMeta[] {
  return diagrams.map((d) =>
    d.id === activeDiagramId ? { ...d, layout: updater(d.layout) } : d,
  );
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
  const applyFromDiagram = (model: Model) =>
    set((s) => ({
      model,
      text: serialize(model),
      errors: [],
      diagrams: reconcileAllDiagrams(model, s.diagrams),
    }));

  const initial = seedModel();
  const initialDiagramId = shortId();
  const initialDiagrams: DiagramMeta[] = [
    {
      id: initialDiagramId,
      kind: "bdd",
      name: "Main BDD",
      layout: reconcileLayout(initial, {}),
    },
  ];

  return {
    model: initial,
    text: serialize(initial),
    errors: [],
    diagrams: initialDiagrams,
    activeDiagramId: initialDiagramId,
    selectedId: null,

    loadModel: (model, diagrams) => {
      const active = diagrams[0]?.id ?? shortId();
      const resolved =
        diagrams.length > 0
          ? reconcileAllDiagrams(model, diagrams)
          : [{ id: active, kind: "bdd" as const, name: "Main BDD", layout: reconcileLayout(model, {}) }];
      set({
        model,
        text: serialize(model),
        errors: [],
        diagrams: resolved,
        activeDiagramId: active,
        selectedId: null,
      });
    },

    setTextFromEditor: (text) => {
      const { model, errors } = parse(text);
      set((s) => ({
        text,
        errors,
        model: model ?? s.model,
        diagrams: model ? reconcileAllDiagrams(model, s.diagrams) : s.diagrams,
      }));
    },

    setSelected: (id) => set({ selectedId: id }),

    setNodePosition: (qname, pos) =>
      set((s) => ({
        diagrams: updateActiveDiagramLayout(s.diagrams, s.activeDiagramId, (prev) => ({
          ...prev,
          [qname]: pos,
        })),
      })),

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
      if (el.kind === "partDef") {
        const oldQn = qualifiedName(model, id);
        const newModel = rename(model, id, trimmed);
        const newQn = qualifiedName(newModel, id);
        set((s) => ({
          model: newModel,
          text: serialize(newModel),
          errors: [],
          diagrams: s.diagrams.map((d) => {
            const layout = { ...d.layout };
            if (layout[oldQn]) {
              layout[newQn] = layout[oldQn];
              delete layout[oldQn];
            }
            return { ...d, layout };
          }),
        }));
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

    addDiagram: (name) => {
      const id = shortId();
      const diagName = name ?? `BDD ${get().diagrams.length + 1}`;
      set((s) => ({
        diagrams: [
          ...s.diagrams,
          {
            id,
            kind: "bdd",
            name: diagName,
            layout: reconcileLayout(s.model, {}),
          },
        ],
        activeDiagramId: id,
      }));
    },

    renameDiagram: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set((s) => ({
        diagrams: s.diagrams.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
      }));
    },

    deleteDiagram: (id) => {
      const s = get();
      if (s.diagrams.length <= 1) return;
      const remaining = s.diagrams.filter((d) => d.id !== id);
      set({
        diagrams: remaining,
        activeDiagramId:
          s.activeDiagramId === id ? remaining[0].id : s.activeDiagramId,
      });
    },

    setActiveDiagram: (id) => set({ activeDiagramId: id }),
  };
});

export function getActiveLayout(state: Pick<SygilState, "diagrams" | "activeDiagramId">): Layout {
  return state.diagrams.find((d) => d.id === state.activeDiagramId)?.layout ?? {};
}

export function partIdByQName(model: Model, qname: string): string | undefined {
  return byQualifiedName(model)[qname];
}
