import { describe, expect, it } from "vitest";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
  qualifiedName,
  type Model,
} from "@sygil/model";
import { deriveBddGraph, type BddGraphNodeData } from "../src/review/bddGraph.js";
import type { Layout } from "../src/store/sygilStore.js";

function build(): { model: Model; ids: Record<string, string> } {
  let m = createModel("Root");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  const e = addPartDef(m, "Engine");
  m = e.model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  const sc = addPartDef(m, "SportsCar", ["Vehicle"]);
  m = sc.model;
  return { model: m, ids: { v: v.id, e: e.id, sc: sc.id } };
}

function layoutFor(model: Model, names: string[]): Layout {
  const layout: Layout = {};
  for (const n of names) layout[`Root::${n}`] = { x: 0, y: 0 };
  return layout;
}

describe("deriveBddGraph", () => {
  it("renders only placed elements and resolves edges among them", () => {
    const { model } = build();
    const layout = layoutFor(model, ["Vehicle", "Engine", "SportsCar"]);
    const { nodes, edges } = deriveBddGraph(model, layout);

    expect(nodes.map((n) => (n.data as BddGraphNodeData).name).sort()).toEqual([
      "Engine",
      "SportsCar",
      "Vehicle",
    ]);

    const vehicle = nodes.find((n) => (n.data as BddGraphNodeData).name === "Vehicle")!;
    const vd = vehicle.data as BddGraphNodeData;
    expect(vd.attributes.map((a) => a.name)).toEqual(["mass"]);
    expect(vd.parts.map((p) => p.name)).toEqual(["engine"]);

    // SportsCar :> Vehicle (specialization) + Vehicle.engine -> Engine (composition)
    expect(edges).toHaveLength(2);
    const labels = edges.map((e) => e.label);
    expect(labels).toContain("«specializes»");
    expect(labels).toContain("engine");
  });

  it("excludes unplaced elements and their edges", () => {
    const { model } = build();
    const layout = layoutFor(model, ["Vehicle", "Engine"]); // SportsCar not placed
    const { nodes, edges } = deriveBddGraph(model, layout);

    expect(nodes).toHaveLength(2);
    // Only the composition edge survives; specialization needs SportsCar placed.
    expect(edges).toHaveLength(1);
    expect(edges[0].label).toBe("engine");
  });

  it("ignores layout keys that don't resolve in the model", () => {
    const { model } = build();
    const layout: Layout = {
      ...layoutFor(model, ["Vehicle"]),
      "Root::Ghost": { x: 0, y: 0 },
    };
    const { nodes } = deriveBddGraph(model, layout);
    expect(nodes.map((n) => (n.data as BddGraphNodeData).name)).toEqual(["Vehicle"]);
    void qualifiedName;
  });
});
