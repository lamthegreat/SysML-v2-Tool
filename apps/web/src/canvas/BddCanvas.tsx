import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import {
  childrenOf,
  getElement,
  qualifiedName,
  type AttributeUsage,
  type PartDef,
  type PartUsage,
} from "@sygil/model";
import { useSygil, getActiveLayout, activePackageIdOf } from "../store/sygilStore.js";
import { BddNode, RawNode, type BddNodeData } from "./BddNode.js";

const nodeTypes = { bdd: BddNode, raw: RawNode };

export function BddCanvas() {
  const model = useSygil((s) => s.model);
  const activeDiagramId = useSygil((s) => s.activeDiagramId);
  const activePackageId = useSygil((s) => activePackageIdOf(s));
  const layout = useSygil((s) => getActiveLayout(s));
  const setNodePosition = useSygil((s) => s.setNodePosition);
  const addSpecialization = useSygil((s) => s.addSpecialization);
  const removeElement = useSygil((s) => s.removeElement);
  const setSelected = useSygil((s) => s.setSelected);

  // A BDD is drawn in the context of its owning package: only that package's
  // direct members are eligible to appear (and only those explicitly placed in
  // the layout — diagrams are views, not auto-mirrors of the model).
  const nodes = useMemo<Node[]>(() => {
    const members = childrenOf(model, activePackageId);
    const result: Node[] = [];
    members.forEach((el) => {
      const qn = qualifiedName(model, el.id);
      // Only render elements explicitly placed on this diagram.
      if (!(qn in layout)) return;
      const position = layout[qn];
      if (el.kind === "partDef") {
        const kids = childrenOf(model, el.id);
        const data: BddNodeData = {
          partId: el.id,
          name: el.name,
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
        result.push({ id: el.id, type: "bdd", position, data });
      } else if (el.kind === "raw") {
        result.push({
          id: el.id,
          type: "raw",
          position,
          data: { text: el.text },
          draggable: true,
        });
      }
    });
    return result;
  }, [model, layout, activePackageId]);

  const edges = useMemo<Edge[]>(() => {
    // Resolve relationships only among the partDefs rendered on THIS diagram:
    // scoped to the diagram's package and explicitly placed in the layout. This
    // keeps edges on-diagram and sidesteps cross-package name collisions.
    // (Cross-package edges are an accepted MVP limitation.)
    const defs = childrenOf(model, activePackageId).filter(
      (el): el is PartDef =>
        el.kind === "partDef" && qualifiedName(model, el.id) in layout,
    );
    const byName = new Map(defs.map((d) => [d.name, d.id]));
    const out: Edge[] = [];
    for (const pd of defs) {
      // generalization (specialization) edges
      for (const g of pd.specializations) {
        const target = byName.get(g);
        if (!target) continue;
        out.push({
          id: `${pd.id}:>${g}`,
          source: pd.id,
          target,
          label: "«specializes»",
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
          style: { stroke: "#475569" },
        });
      }
      // part-usage (composition) edges
      for (const c of childrenOf(model, pd.id)) {
        if (c.kind !== "partUsage" || !c.typeName) continue;
        const target = byName.get(c.typeName);
        if (!target) continue;
        out.push({
          id: `${pd.id}.${c.id}`,
          source: pd.id,
          target,
          label: c.name,
          style: { stroke: "#059669", strokeDasharray: "4 2" },
          markerEnd: { type: MarkerType.Arrow, color: "#059669" },
        });
      }
    }
    return out;
  }, [model, layout, activePackageId]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          const el = getElement(model, c.id);
          if (el) setNodePosition(qualifiedName(model, c.id), c.position);
        }
      }
    },
    [model, setNodePosition],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (conn.source && conn.target) addSpecialization(conn.source, conn.target);
    },
    [addSpecialization],
  );

  return (
    <ReactFlow
      key={activeDiagramId}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      onNodesDelete={(deleted) => deleted.forEach((n) => removeElement(n.id))}
      onNodeClick={(_, n) => setSelected(n.id)}
      onPaneClick={() => setSelected(null)}
      deleteKeyCode={["Backspace", "Delete"]}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}
