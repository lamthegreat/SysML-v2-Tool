import { MarkerType, type Edge, type Node } from "@xyflow/react";
import {
  byQualifiedName,
  childrenOf,
  getElement,
  type AttributeUsage,
  type Model,
  type PartDef,
  type PartUsage,
} from "@sygil/model";
import type { Layout } from "../store/sygilStore.js";

export interface BddGraphAttr {
  id: string;
  name: string;
  dataType: string;
  multiplicity?: string;
}
export interface BddGraphPart {
  id: string;
  name: string;
  typeName?: string;
  isReference: boolean;
  multiplicity?: string;
}
export interface BddGraphNodeData {
  partId: string;
  name: string;
  specializations: string[];
  attributes: BddGraphAttr[];
  parts: BddGraphPart[];
  [key: string]: unknown;
}

/**
 * Derive the React Flow nodes/edges for a diagram from its layout. A diagram is
 * a view: it shows exactly the elements placed in `layout`, keyed by qualified
 * name. Identity is by qualified name (not element id) so this works across two
 * independently-parsed models (base vs head), whose ids differ.
 *
 * Edges (specialization + composition) are resolved only among the placed
 * partDefs.
 */
export function deriveBddGraph(
  model: Model,
  layout: Layout,
): { nodes: Node[]; edges: Edge[] } {
  const index = byQualifiedName(model);

  const placedDefs: PartDef[] = [];
  const nodes: Node[] = [];
  for (const qn of Object.keys(layout)) {
    const id = index[qn];
    if (!id) continue;
    const el = getElement(model, id);
    if (!el) continue;
    const position = layout[qn];
    if (el.kind === "partDef") {
      placedDefs.push(el);
      const kids = childrenOf(model, el.id);
      const data: BddGraphNodeData = {
        partId: el.id,
        name: el.name,
        specializations: el.specializations,
        attributes: kids
          .filter((c): c is AttributeUsage => c.kind === "attributeUsage")
          .map((a) => ({
            id: a.id,
            name: a.name,
            dataType: a.dataType,
            multiplicity: a.multiplicity,
          })),
        parts: kids
          .filter((c): c is PartUsage => c.kind === "partUsage")
          .map((p) => ({
            id: p.id,
            name: p.name,
            typeName: p.typeName,
            isReference: p.isReference,
            multiplicity: p.multiplicity,
          })),
      };
      nodes.push({ id: el.id, type: "bdd", position, data });
    } else if (el.kind === "raw") {
      nodes.push({ id: el.id, type: "raw", position, data: { text: el.text } });
    }
  }

  const byName = new Map(placedDefs.map((d) => [d.name, d.id]));
  const edges: Edge[] = [];
  for (const pd of placedDefs) {
    for (const g of pd.specializations) {
      const target = byName.get(g);
      if (!target) continue;
      edges.push({
        id: `${pd.id}:>${g}`,
        source: pd.id,
        target,
        label: "«specializes»",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: { stroke: "#475569" },
      });
    }
    for (const c of childrenOf(model, pd.id)) {
      if (c.kind !== "partUsage" || !c.typeName) continue;
      const target = byName.get(c.typeName);
      if (!target) continue;
      edges.push({
        id: `${pd.id}.${c.id}`,
        source: pd.id,
        target,
        label: c.name,
        style: { stroke: "#059669", strokeDasharray: "4 2" },
        markerEnd: { type: MarkerType.Arrow, color: "#059669" },
      });
    }
  }

  return { nodes, edges };
}
