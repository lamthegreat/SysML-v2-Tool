/**
 * SysML v2 ScalarValues standard library types.
 *
 * In SysML v2, primitives are library elements — not keywords. This module
 * defines the canonical set so the validation engine can resolve attribute
 * types against them.
 */

export const SCALAR_VALUES: ReadonlySet<string> = new Set([
  "Boolean",
  "String",
  "Integer",
  "Natural",
  "Real",
  "Complex",
  "NumericalValue",
]);
