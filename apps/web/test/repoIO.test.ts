import { describe, expect, it } from "vitest";
import { LocalProvider } from "@sygil/git";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
  qualifiedName,
  type Model,
} from "@sygil/model";
import { serialize } from "@sygil/sysml-notation";
import { saveToRepo, loadFromRepo } from "../src/repo/repoIO.js";

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

function build(): { model: Model; layout: Record<string, { x: number; y: number }> } {
  let m = createModel("VehicleModel");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  m = addPartDef(m, "Engine").model;
  const layout = {
    [qualifiedName(m, v.id)]: { x: 120, y: 80 },
  };
  return { model: m, layout };
}

describe("repo round-trip (verification steps 6–7)", () => {
  it("saves model + view as two files and restores an identical model and layout", async () => {
    const provider = new LocalProvider("test:repo", memStorage());
    const { model, layout } = build();

    const commit = await saveToRepo(provider, model, layout);
    expect(commit.commitSha).toMatch(/^local-/);

    expect(await provider.listFiles("model")).toContain("model/VehicleModel.sysml");
    expect(await provider.listFiles("views")).toContain("views/VehicleModel.view.json");

    const { model: restored, layout: restoredLayout } = await loadFromRepo(
      provider,
      "VehicleModel",
    );

    // Model semantics round-trip exactly through the .sysml file.
    expect(serialize(restored)).toBe(serialize(model));
    // Geometry round-trips through the .view.json file, keyed by qualified name.
    expect(restoredLayout["VehicleModel::Vehicle"]).toEqual({ x: 120, y: 80 });
  });
});
