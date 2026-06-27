import { describe, expect, it } from "vitest";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
  validate,
  type Diagnostic,
} from "../src/index.js";

function codes(ds: Diagnostic[]): string[] {
  return ds.map((d) => d.code).sort();
}

function vehicleModel() {
  let m = createModel("VehicleModel");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  m = addPartDef(m, "Engine").model;
  return m;
}

describe("validate", () => {
  it("returns no diagnostics for a clean model", () => {
    expect(validate(vehicleModel())).toEqual([]);
  });

  // --- unresolved-type ---

  it("flags unresolved part usage type", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addPartUsage(m, a.id, "thing", "Ghost").model;
    const ds = validate(m);
    expect(codes(ds)).toEqual(["unresolved-type"]);
    expect(ds[0].elementId).not.toBe(a.id);
    expect(ds[0].message).toContain("Ghost");
  });

  it("does not flag a part usage with no type", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addPartUsage(m, a.id, "thing").model;
    expect(validate(m)).toEqual([]);
  });

  // --- unresolved-specialization ---

  it("flags unresolved specialization target", () => {
    let m = createModel("P");
    m = addPartDef(m, "A", ["NonExistent"]).model;
    const ds = validate(m);
    expect(codes(ds)).toEqual(["unresolved-specialization"]);
    expect(ds[0].message).toContain("NonExistent");
  });

  it("does not flag a valid specialization", () => {
    let m = createModel("P");
    m = addPartDef(m, "Base").model;
    m = addPartDef(m, "Child", ["Base"]).model;
    expect(validate(m)).toEqual([]);
  });

  // --- name-not-distinguishable ---

  it("flags duplicate sibling names", () => {
    let m = createModel("P");
    m = addPartDef(m, "Dup").model;
    m = addPartDef(m, "Dup").model;
    const ds = validate(m).filter((d) => d.code === "name-not-distinguishable");
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe("error");
  });

  it("does not flag same name under different owners", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addAttribute(m, a.id, "x", "Real").model;
    const b = addPartDef(m, "B");
    m = b.model;
    m = addAttribute(m, b.id, "x", "Real").model;
    const ds = validate(m).filter((d) => d.code === "name-not-distinguishable");
    expect(ds).toEqual([]);
  });

  // --- specialization-cycle ---

  it("flags direct self-specialization", () => {
    let m = createModel("P");
    m = addPartDef(m, "Loop", ["Loop"]).model;
    const ds = validate(m).filter((d) => d.code === "specialization-cycle");
    expect(ds).toHaveLength(1);
  });

  it("flags transitive specialization cycle", () => {
    let m = createModel("P");
    m = addPartDef(m, "A", ["B"]).model;
    m = addPartDef(m, "B", ["C"]).model;
    m = addPartDef(m, "C", ["A"]).model;
    const ds = validate(m).filter((d) => d.code === "specialization-cycle");
    expect(ds).toHaveLength(3);
  });

  it("does not flag an acyclic hierarchy", () => {
    let m = createModel("P");
    m = addPartDef(m, "Base").model;
    m = addPartDef(m, "Mid", ["Base"]).model;
    m = addPartDef(m, "Leaf", ["Mid"]).model;
    const ds = validate(m).filter((d) => d.code === "specialization-cycle");
    expect(ds).toEqual([]);
  });

  // --- malformed-multiplicity ---

  it("warns on invalid multiplicity syntax", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addPartUsage(m, a.id, "x", "A", { multiplicity: "abc" }).model;
    const ds = validate(m).filter((d) => d.code === "malformed-multiplicity");
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe("warning");
  });

  it("warns when lower > upper", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addAttribute(m, a.id, "x", "Real", "5..2").model;
    const ds = validate(m).filter((d) => d.code === "malformed-multiplicity");
    expect(ds).toHaveLength(1);
    expect(ds[0].message).toContain("lower bound");
  });

  it("accepts valid multiplicity forms", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addPartUsage(m, a.id, "a", "A", { multiplicity: "1" }).model;
    m = addPartUsage(m, a.id, "b", "A", { multiplicity: "0..*" }).model;
    m = addPartUsage(m, a.id, "c", "A", { multiplicity: "1..5" }).model;
    m = addPartUsage(m, a.id, "d", "A", { multiplicity: "*" }).model;
    const ds = validate(m).filter((d) => d.code === "malformed-multiplicity");
    expect(ds).toEqual([]);
  });

  // --- unresolved-attribute-type ---

  it("errors on unknown attribute type", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addAttribute(m, a.id, "x", "Fubar").model;
    const ds = validate(m).filter((d) => d.code === "unresolved-attribute-type");
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe("error");
  });

  it("does not flag ScalarValues primitive types", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addAttribute(m, a.id, "a", "Real").model;
    m = addAttribute(m, a.id, "b", "Integer").model;
    m = addAttribute(m, a.id, "c", "Boolean").model;
    m = addAttribute(m, a.id, "d", "String").model;
    const ds = validate(m).filter((d) => d.code === "unresolved-attribute-type");
    expect(ds).toEqual([]);
  });

  it("does not flag extended ScalarValues types (Natural, Complex, NumericalValue)", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addAttribute(m, a.id, "a", "Natural").model;
    m = addAttribute(m, a.id, "b", "Complex").model;
    m = addAttribute(m, a.id, "c", "NumericalValue").model;
    const ds = validate(m).filter((d) => d.code === "unresolved-attribute-type");
    expect(ds).toEqual([]);
  });

  it("does not warn if attribute type matches a PartDef name", () => {
    let m = createModel("P");
    const a = addPartDef(m, "A");
    m = a.model;
    m = addPartDef(m, "MyType").model;
    m = addAttribute(m, a.id, "x", "MyType").model;
    const ds = validate(m).filter((d) => d.code === "unresolved-attribute-type");
    expect(ds).toEqual([]);
  });
});
