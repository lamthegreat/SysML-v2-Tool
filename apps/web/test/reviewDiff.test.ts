import { describe, expect, it } from "vitest";
import { addAttribute, addPartDef, createModel, type Model } from "@sygil/model";
import {
  changeByQname,
  diagramSummaries,
  packageLabel,
  type Layout,
} from "@sygil/platform";
import type { DiagramMeta } from "../src/store/sygilStore.js";

function pos(): Layout[string] {
  return { x: 0, y: 0 };
}

/** base: Vehicle(mass), Engine.  head: Vehicle(mass,color), Transmission. */
function buildModels(): { base: Model; head: Model } {
  let base = createModel("Root");
  const bv = addPartDef(base, "Vehicle");
  base = bv.model;
  base = addAttribute(base, bv.id, "mass", "Real").model;
  base = addPartDef(base, "Engine").model;

  let head = createModel("Root");
  const hv = addPartDef(head, "Vehicle");
  head = hv.model;
  head = addAttribute(head, hv.id, "mass", "Real").model;
  head = addAttribute(head, hv.id, "color", "String").model;
  head = addPartDef(head, "Transmission").model;

  return { base, head };
}

describe("changeByQname", () => {
  it("classifies each block by qualified name", () => {
    const { base, head } = buildModels();
    const map = changeByQname(base, head);
    expect(map.get("Root::Vehicle")).toBe("modified");
    expect(map.get("Root::Engine")).toBe("removed");
    expect(map.get("Root::Transmission")).toBe("added");
  });
});

describe("packageLabel", () => {
  it("derives the parent namespace from a placed block qname", () => {
    expect(packageLabel({ "Root::Vehicle": pos() })).toBe("Root");
    expect(packageLabel({ "Root::Powertrain::Gearbox": pos() })).toBe("Root::Powertrain");
    expect(packageLabel({})).toBe("(empty)");
  });
});

describe("diagramSummaries", () => {
  it("counts placed-block changes and flags added/removed diagrams", () => {
    const { base, head } = buildModels();
    const baseDiagrams: DiagramMeta[] = [
      {
        id: "d1",
        kind: "bdd",
        name: "Main",
        packageId: base.rootId,
        layout: { "Root::Vehicle": pos(), "Root::Engine": pos() },
      },
    ];
    const headDiagrams: DiagramMeta[] = [
      {
        id: "d1",
        kind: "bdd",
        name: "Main",
        packageId: head.rootId,
        layout: { "Root::Vehicle": pos(), "Root::Transmission": pos() },
      },
      {
        id: "d2",
        kind: "bdd",
        name: "Powertrain",
        packageId: head.rootId,
        layout: {},
      },
    ];

    const summaries = diagramSummaries(base, baseDiagrams, head, headDiagrams);
    const byId = Object.fromEntries(summaries.map((s) => [s.id, s]));

    expect(byId.d1.status).toBe("present");
    expect(byId.d1.added).toBe(1); // Transmission
    expect(byId.d1.removed).toBe(1); // Engine
    expect(byId.d1.modified).toBe(1); // Vehicle
    expect(byId.d1.hasChanges).toBe(true);

    expect(byId.d2.status).toBe("added");
    expect(byId.d2.hasChanges).toBe(true);
  });
});
