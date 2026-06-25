import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { qualifiedName, type Model } from "@sygil/model";
import type { ChangeKind } from "../repo/modelDiff.js";
import type { Layout } from "../store/sygilStore.js";
import { deriveBddGraph } from "./bddGraph.js";
import { ReviewNode, ReviewRawNode } from "./ReviewNode.js";

const nodeTypes = { bdd: ReviewNode, raw: ReviewRawNode };

interface Props {
  model: Model;
  layout: Layout;
  changes: Map<string, ChangeKind>;
  changesOnly: boolean;
  selectedQname: string | null;
  focusQname: string | null;
  onSelect: (qname: string | null) => void;
}

function CanvasInner({
  model,
  layout,
  changes,
  changesOnly,
  selectedQname,
  focusQname,
  onSelect,
}: Props) {
  const { setCenter } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const graph = deriveBddGraph(model, layout);
    const annotated: Node[] = graph.nodes.map((n) => {
      const qn = qualifiedName(model, n.id);
      const change = changes.get(qn) ?? "unchanged";
      return {
        ...n,
        draggable: false,
        connectable: false,
        data: { ...n.data, change, selected: qn === selectedQname },
      };
    });

    const visible = changesOnly
      ? annotated.filter((n) => (n.data as { change: ChangeKind }).change !== "unchanged")
      : annotated;
    const visibleIds = new Set(visible.map((n) => n.id));
    const visibleEdges: Edge[] = edgesFor(graph.edges, visibleIds);
    return { nodes: visible, edges: visibleEdges };
  }, [model, layout, changes, changesOnly, selectedQname]);

  // Pan to the focused element when navigation changes it.
  useEffect(() => {
    if (!focusQname) return;
    const pos = layout[focusQname];
    if (pos) setCenter(pos.x + 100, pos.y + 70, { zoom: 1, duration: 400 });
  }, [focusQname, layout, setCenter]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelect(qualifiedName(model, n.id))}
      onPaneClick={() => onSelect(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function edgesFor(edges: Edge[], visibleIds: Set<string>): Edge[] {
  return edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
}

export function ReviewCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
