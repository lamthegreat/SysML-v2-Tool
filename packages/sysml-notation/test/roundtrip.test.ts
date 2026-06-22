import { describe, expect, it } from "vitest";
import {
  addAttribute,
  addPartDef,
  addPartUsage,
  createModel,
  setSpecializations,
  type Model,
} from "@sygil/model";
import { parse, serialize } from "../src/index.js";

function vehicleModel(): Model {
  let m = createModel("VehicleModel");
  const v = addPartDef(m, "Vehicle");
  m = v.model;
  m = addAttribute(m, v.id, "mass", "Real").model;
  m = addPartUsage(m, v.id, "engine", "Engine", { multiplicity: "1" }).model;
  const sc = addPartDef(m, "SportsCar", ["Vehicle"]);
  m = sc.model;
  m = addAttribute(m, sc.id, "topSpeed", "Real").model;
  m = addPartDef(m, "Engine").model;
  return m;
}

const EXPECTED = `package VehicleModel {
    part def Vehicle {
        attribute mass : Real;
        part engine : Engine[1];
    }
    part def SportsCar :> Vehicle {
        attribute topSpeed : Real;
    }
    part def Engine;
}
`;

describe("serialize", () => {
  it("produces the canonical v2 textual notation", () => {
    expect(serialize(vehicleModel())).toBe(EXPECTED);
  });
});

describe("parse", () => {
  it("round-trips the canonical example (text -> model -> text)", () => {
    const { model, errors } = parse(EXPECTED);
    expect(errors).toEqual([]);
    expect(model).not.toBeNull();
    expect(serialize(model!)).toBe(EXPECTED);
  });

  it("satisfies serialize(parse(serialize(m))) === serialize(m)", () => {
    const text = serialize(vehicleModel());
    const { model } = parse(text);
    expect(serialize(model!)).toBe(text);
  });

  it("handles specialization via `specializes` keyword", () => {
    const { model, errors } = parse(
      "package P { part def A; part def B specializes A; }",
    );
    expect(errors).toEqual([]);
    expect(serialize(model!)).toContain("part def B :> A;");
  });

  it("parses ref part and multiplicity", () => {
    const { model, errors } = parse(
      "package P { part def A { ref part other : B[0..*]; } part def B; }",
    );
    expect(errors).toEqual([]);
    expect(serialize(model!)).toContain("ref part other : B[0..*];");
  });

  it("preserves unrecognized constructs as raw (round-trip safe)", () => {
    const text =
      "package P {\n    part def A;\n    import Foo::*;\n    port def Q { in x; }\n}\n";
    const { model, errors } = parse(text);
    expect(errors).toEqual([]);
    const out = serialize(model!);
    expect(out).toContain("import Foo::*;");
    expect(out).toContain("port def Q { in x; }");
    expect(out).toContain("part def A;");
  });

  it("reports an error on a malformed member but keeps the good ones", () => {
    const { model, errors } = parse(
      "package P { part def A; attribute : Real; part def B; }",
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(model).not.toBeNull();
    const out = serialize(model!);
    expect(out).toContain("part def A;");
    expect(out).toContain("part def B;");
  });

  it("round-trips nested packages", () => {
    const text = `package P {
    package Sub {
        part def A;
    }
    part def B :> Sub::A;
}
`;
    const { model, errors } = parse(text);
    expect(errors).toEqual([]);
    expect(model).not.toBeNull();
    // serialize(parse(text)) reproduces the canonical text exactly
    expect(serialize(model!)).toBe(text);
    // and the identity holds through another round-trip
    expect(serialize(parse(serialize(model!)).model!)).toBe(serialize(model!));
  });

  it("handles empty and deeply nested packages", () => {
    const { model, errors } = parse(
      "package P { package Empty; package A { package B { part def C; } } }",
    );
    expect(errors).toEqual([]);
    const out = serialize(model!);
    expect(out).toContain("package Empty;");
    expect(out).toContain("package B {");
    expect(out).toContain("part def C;");
  });
});
