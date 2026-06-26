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
