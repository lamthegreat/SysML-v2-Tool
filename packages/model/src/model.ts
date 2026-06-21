import { shortId } from "./ids.js";
import type {
  AttributeUsage,
  Element,
  Model,
  PackageEl,
  PartDef,
  PartUsage,
} from "./types.js";

/** Create an empty model containing a single root package. */
export function createModel(packageName: string): Model {
  const rootId = shortId();
  const root: PackageEl = {
    id: rootId,
    kind: "package",
    name: packageName,
    ownerId: null,
    order: 0,
  };
  return { rootId, elements: { [rootId]: root } };
}

export function getElement(model: Model, id: string): Element | undefined {
  return model.elements[id];
}

export function getRoot(model: Model): PackageEl {
  return model.elements[model.rootId] as PackageEl;
}

/** Direct children of an element, sorted by `order`. */
export function childrenOf(model: Model, ownerId: string): Element[] {
  return Object.values(model.elements)
    .filter((e) => e.ownerId === ownerId)
    .sort((a, b) => a.order - b.order);
}

/** All PartDefs in the model (MVP: BDD blocks live directly under the package). */
export function partDefs(model: Model): PartDef[] {
  return Object.values(model.elements).filter(
    (e): e is PartDef => e.kind === "partDef",
  );
}

/**
 * Qualified name, `::`-separated from the root package down to `id`.
 * This is the stable key used by view metadata and cross-surface reconciliation.
 */
export function qualifiedName(model: Model, id: string): string {
  const parts: string[] = [];
  let cur: Element | undefined = model.elements[id];
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.ownerId ? model.elements[cur.ownerId] : undefined;
  }
  return parts.join("::");
}

/** Index of qualified name → element id. */
export function byQualifiedName(model: Model): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of Object.keys(model.elements)) {
    out[qualifiedName(model, id)] = id;
  }
  return out;
}

function nextOrder(model: Model, ownerId: string): number {
  const kids = childrenOf(model, ownerId);
  return kids.length ? Math.max(...kids.map((k) => k.order)) + 1 : 0;
}

function put(model: Model, el: Element): Model {
  return { ...model, elements: { ...model.elements, [el.id]: el } };
}

// ---------------------------------------------------------------------------
// Mutations — pure, returning a new Model (Zustand-friendly).
// ---------------------------------------------------------------------------

export function addPartDef(
  model: Model,
  name: string,
  specializations: string[] = [],
  ownerId: string = model.rootId,
): { model: Model; id: string } {
  const id = shortId();
  const el: PartDef = {
    id,
    kind: "partDef",
    name,
    ownerId,
    order: nextOrder(model, ownerId),
    specializations,
  };
  return { model: put(model, el), id };
}

/** Add a nested package under `ownerId` (defaults to the root package). */
export function addPackage(
  model: Model,
  name: string,
  ownerId: string = model.rootId,
): { model: Model; id: string } {
  const id = shortId();
  const el: PackageEl = {
    id,
    kind: "package",
    name,
    ownerId,
    order: nextOrder(model, ownerId),
  };
  return { model: put(model, el), id };
}

export function addAttribute(
  model: Model,
  ownerPartId: string,
  name: string,
  dataType: string = "Real",
  multiplicity?: string,
): { model: Model; id: string } {
  const id = shortId();
  const el: AttributeUsage = {
    id,
    kind: "attributeUsage",
    name,
    ownerId: ownerPartId,
    order: nextOrder(model, ownerPartId),
    dataType,
    multiplicity,
  };
  return { model: put(model, el), id };
}

export function addPartUsage(
  model: Model,
  ownerPartId: string,
  name: string,
  typeName?: string,
  opts: { isReference?: boolean; multiplicity?: string } = {},
): { model: Model; id: string } {
  const id = shortId();
  const el: PartUsage = {
    id,
    kind: "partUsage",
    name,
    ownerId: ownerPartId,
    order: nextOrder(model, ownerPartId),
    typeName,
    isReference: opts.isReference ?? false,
    multiplicity: opts.multiplicity,
  };
  return { model: put(model, el), id };
}

export function rename(model: Model, id: string, name: string): Model {
  const el = model.elements[id];
  if (!el) return model;
  return put(model, { ...el, name });
}

export function setSpecializations(
  model: Model,
  partId: string,
  specializations: string[],
): Model {
  const el = model.elements[partId];
  if (!el || el.kind !== "partDef") return model;
  return put(model, { ...el, specializations });
}

/** Remove an element and all its descendants. */
export function remove(model: Model, id: string): Model {
  if (id === model.rootId) return model;
  const toDelete = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of Object.values(model.elements)) {
      if (e.ownerId && toDelete.has(e.ownerId) && !toDelete.has(e.id)) {
        toDelete.add(e.id);
        grew = true;
      }
    }
  }
  const elements: Record<string, Element> = {};
  for (const [eid, e] of Object.entries(model.elements)) {
    if (!toDelete.has(eid)) elements[eid] = e;
  }
  return { ...model, elements };
}
