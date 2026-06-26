import { describe, expect, it } from "vitest";
import { LocalProvider, saveToRepo, loadFromRepo } from "@sygil/platform";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
  qualifiedName,
  type Model,
} from "@sygil/model";
import { serialize } from "@sygil/sysml-notation";
import type { DiagramMeta } from "../src/store/sygilStore.js";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

function build(): { model: Model; diagrams: DiagramMeta[] } {
  let m = createModel("VehicleModel");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  m = addPartDef(m, "Engine").model;
  const diagrams: DiagramMeta[] = [
    {
      id: "diag-1",
      kind: "bdd",
      name: "Main BDD",
      layout: { [qualifiedName(m, v.id)]: { x: 120, y: 80 } },
    },
    {
      id: "diag-2",
      kind: "bdd",
      name: "Alt BDD",
      layout: { [qualifiedName(m, v.id)]: { x: 300, y: 200 } },
    },
  ];
  return { model: m, diagrams };
}

describe("repo round-trip", () => {
  it("saves model + multi-diagram view and restores them identically", async () => {
    const provider = new LocalProvider("test:repo", memStorage());
    const { model, diagrams } = build();

    const commit = await saveToRepo(provider, model, diagrams);
    expect(commit.commitSha).toMatch(/^local-/);

    expect(await provider.listFiles("model")).toContain("model/VehicleModel.sysml");
    expect(await provider.listFiles("views")).toContain("views/VehicleModel.view.json");

    const { model: restored, diagrams: restoredDiagrams } = await loadFromRepo(
      provider,
      "VehicleModel",
    );

    expect(serialize(restored)).toBe(serialize(model));
    expect(restoredDiagrams).toHaveLength(2);
    expect(restoredDiagrams[0].name).toBe("Main BDD");
    expect(restoredDiagrams[0].layout["VehicleModel::Vehicle"]).toEqual({ x: 120, y: 80 });
    expect(restoredDiagrams[1].name).toBe("Alt BDD");
    expect(restoredDiagrams[1].layout["VehicleModel::Vehicle"]).toEqual({ x: 300, y: 200 });
  });
});
