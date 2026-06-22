import { create } from "zustand";
import {
  addAttribute,
  addPackage,
  addPartDef,
  addPartUsage,
  byQualifiedName,
  childrenOf,
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
  packageId: string;
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
  addPackageUnder: (ownerId: string) => void;
  addPartDefUnder: (ownerId: string) => void;
  renameElement: (id: string, name: string) => void;
  retypeAttribute: (id: string, dataType: string) => void;
  addAttributeTo: (partId: string) => void;
  addPartTo: (partId: string) => void;
  addSpecialization: (specificId: string, generalId: string) => void;
  removeElement: (id: string) => void;

  addDiagram: (name?: string, packageId?: string) => void;
  renameDiagram: (id: string, name: string) => void;
  deleteDiagram: (id: string) => void;
  moveDiagram: (id: string, targetPackageId: string) => void;
  setActiveDiagram: (id: string) => void;
}

/** A name unique among the children of `ownerId` (e.g. "NewBlock", "NewBlock1"). */
function uniqueChildName(model: Model, ownerId: string, base: string): string {
  const existing = new Set(childrenOf(model, ownerId).map((c) => c.name));
  if (!existing.has(base)) return base;
  let i = 1;
  while (existing.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

function autoPos(index: number): NodePos {
  return { x: 60 + (index % 4) * 280, y: 60 + Math.floor(index / 4) * 240 };
}

/** Build a set of all valid qualified names for PartDefs in the model. */
function validQNames(model: Model): Set<string> {
  return new Set(partDefs(model).map((pd) => qualifiedName(model, pd.id)));
}

/**
 * Prune stale entries from a layout — remove keys for elements that no longer
 * exist in the model. Does NOT add new elements (diagrams are views that show
 * only explicitly placed elements).
 */
function pruneLayout(model: Model, layout: Layout): Layout {
  const valid = validQNames(model);
  const next: Layout = {};
  for (const [qn, pos] of Object.entries(layout)) {
    if (valid.has(qn)) next[qn] = pos;
  }
  return next;
}

function pruneAllDiagrams(model: Model, diagrams: DiagramMeta[]): DiagramMeta[] {
  return diagrams.map((d) => ({ ...d, layout: pruneLayout(model, d.layout) }));
}

/**
 * Place all PartDefs from the model into a layout. Used only for the initial
 * seed diagram (which should show everything) and for `loadModel` fallback.
 */
function fullLayout(model: Model): Layout {
  const layout: Layout = {};
  partDefs(model).forEach((pd, i) => {
    layout[qualifiedName(model, pd.id)] = autoPos(i);
  });
  return layout;
}

/**
 * Detect PartDefs present in `after` but not in `before`, and add them to the
 * active diagram's layout with auto-placed positions.
 */
function addNewElementsToActiveDiagram(
  before: Model,
  after: Model,
  diagrams: DiagramMeta[],
  activeDiagramId: string,
): DiagramMeta[] {
  const oldQNames = validQNames(before);
  const newParts = partDefs(after).filter(
    (pd) => !oldQNames.has(qualifiedName(after, pd.id)),
  );
  if (newParts.length === 0) return diagrams;

  return diagrams.map((d) => {
    if (d.id !== activeDiagramId) return d;
    const layout = { ...d.layout };
    const startIndex = Object.keys(layout).length;
    newParts.forEach((pd, i) => {
      layout[qualifiedName(after, pd.id)] = autoPos(startIndex + i);
    });
    return { ...d, layout };
  });
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
  /**
   * Apply a model mutation originating from the diagram surface. New PartDefs
   * are placed on the active diagram only; deleted elements are pruned from all.
   */
  const applyFromDiagram = (model: Model) =>
    set((s) => {
      const pruned = pruneAllDiagrams(model, s.diagrams);
      const withNew = addNewElementsToActiveDiagram(
        s.model,
        model,
        pruned,
        s.activeDiagramId,
      );
      return {
        model,
        text: serialize(model),
        errors: [],
        diagrams: withNew,
      };
    });

  const initial = seedModel();
  const initialDiagramId = shortId();
  const initialDiagrams: DiagramMeta[] = [
    {
      id: initialDiagramId,
      kind: "bdd",
      name: "Main BDD",
      packageId: initial.rootId,
      layout: fullLayout(initial),
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
          ? pruneAllDiagrams(model, diagrams)
          : [{ id: active, kind: "bdd" as const, name: "Main BDD", packageId: model.rootId, layout: fullLayout(model) }];
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
      set((s) => {
        if (!model) return { text, errors };
        const pruned = pruneAllDiagrams(model, s.diagrams);
        const withNew = addNewElementsToActiveDiagram(
          s.model,
          model,
          pruned,
          s.activeDiagramId,
        );
        return { text, errors, model, diagrams: withNew };
      });
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
      const model = get().model;
      const name = uniqueChildName(model, model.rootId, "NewBlock");
      applyFromDiagram(addPartDef(model, name, [], model.rootId).model);
    },

    addPartDefUnder: (ownerId) => {
      const model = get().model;
      const owner = getElement(model, ownerId);
      if (!owner || owner.kind !== "package") return;
      const name = uniqueChildName(model, ownerId, "NewBlock");
      applyFromDiagram(addPartDef(model, name, [], ownerId).model);
    },

    addPackageUnder: (ownerId) => {
      const model = get().model;
      const owner = getElement(model, ownerId);
      if (!owner || owner.kind !== "package") return;
      const name = uniqueChildName(model, ownerId, "NewPackage");
      // Packages aren't diagram nodes, so a plain model update is enough.
      const next = addPackage(model, name, ownerId).model;
      set((s) => ({
        model: next,
        text: serialize(next),
        errors: [],
        diagrams: pruneAllDiagrams(next, s.diagrams),
      }));
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

    addDiagram: (name, packageId) => {
      const id = shortId();
      const diagName = name ?? `BDD ${get().diagrams.length + 1}`;
      const pkgId = packageId ?? get().model.rootId;
      set((s) => ({
        diagrams: [
          ...s.diagrams,
          { id, kind: "bdd", name: diagName, packageId: pkgId, layout: {} },
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

    moveDiagram: (id, targetPackageId) => {
      const model = get().model;
      const target = getElement(model, targetPackageId);
      if (!target || target.kind !== "package") return;
      set((s) => ({
        diagrams: s.diagrams.map((d) =>
          d.id === id ? { ...d, packageId: targetPackageId } : d,
        ),
      }));
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

