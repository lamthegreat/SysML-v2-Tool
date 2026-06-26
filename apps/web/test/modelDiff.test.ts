import { describe, expect, it } from "vitest";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
} from "@sygil/model";
import { diffModels } from "@sygil/platform";

describe("diffModels", () => {
  it("detects added, removed, modified, and unchanged blocks", () => {
    let base = createModel("Root");
    base = addPartDef(base, "Vehicle").model;
    base = addPartDef(base, "Engine").model;
    const oldVehicle = Object.values(base.elements).find(
      (e) => e.kind === "partDef" && e.name === "Vehicle",
    )!;
    base = addAttribute(base, oldVehicle.id, "mass", "Real").model;

    let head = createModel("Root");
    head = addPartDef(head, "Vehicle").model;
    head = addPartDef(head, "Transmission").model;
    const newVehicle = Object.values(head.elements).find(
      (e) => e.kind === "partDef" && e.name === "Vehicle",
    )!;
    head = addAttribute(head, newVehicle.id, "mass", "Real").model;
    head = addAttribute(head, newVehicle.id, "color", "String").model;

    const diffs = diffModels(base, head);
    const byName = Object.fromEntries(diffs.map((d) => [d.name, d.kind]));

    expect(byName.Engine).toBe("removed");
    expect(byName.Transmission).toBe("added");
    expect(byName.Vehicle).toBe("modified");
  });

  it("reports unchanged when models are identical", () => {
    let m = createModel("Root");
    m = addPartDef(m, "Block").model;
    const diffs = diffModels(m, m);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].kind).toBe("unchanged");
  });

  it("includes attribute and part details in snapshots", () => {
    let m = createModel("Root");
    const v = addPartDef(m, "Vehicle");
    m = v.model;
    m = addAttribute(m, v.id, "mass", "Real").model;
    m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;

    const diffs = diffModels(createModel("Root"), m);
    const added = diffs.find((d) => d.name === "Vehicle");
    expect(added).toBeDefined();
    expect(added!.kind).toBe("added");
    expect(added!.head!.attributes).toEqual([
      { name: "mass", dataType: "Real", multiplicity: undefined },
    ]);
    expect(added!.head!.parts).toEqual([
      {
        name: "engine",
        typeName: "Engine",
        isReference: false,
        multiplicity: "1",
      },
    ]);
  });
});
