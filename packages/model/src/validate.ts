import { childrenOf, partDefs } from "./model.js";
import { SCALAR_VALUES } from "./standardLibrary.js";
import { type Model } from "./types.js";

export type Severity = "error" | "warning";

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  elementId: string;
}

/**
 * Build the set of names that a type reference can resolve against:
 * all PartDef simple names + ScalarValues primitives (DATA_TYPES).
 */
function resolvableNames(model: Model): Set<string> {
  const names = new Set<string>(SCALAR_VALUES);
  for (const pd of partDefs(model)) {
    names.add(pd.name);
  }
  return names;
}

function checkUnresolvedTypes(model: Model, names: Set<string>): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const el of Object.values(model.elements)) {
    if (el.kind === "partUsage" && el.typeName && !names.has(el.typeName)) {
      out.push({
        severity: "error",
        code: "unresolved-type",
        message: `Type '${el.typeName}' does not resolve to any definition in scope`,
        elementId: el.id,
      });
    }
  }
  return out;
}

function checkUnresolvedSpecializations(
  model: Model,
  names: Set<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const pd of partDefs(model)) {
    for (const spec of pd.specializations) {
      if (!names.has(spec)) {
        out.push({
          severity: "error",
          code: "unresolved-specialization",
          message: `Specialization target '${spec}' does not resolve to any definition in scope`,
          elementId: pd.id,
        });
      }
    }
  }
  return out;
}

function checkDuplicateNames(model: Model): Diagnostic[] {
  const out: Diagnostic[] = [];
  const owners = new Set<string>();
  for (const el of Object.values(model.elements)) {
    if (el.ownerId) owners.add(el.ownerId);
  }
  for (const ownerId of owners) {
    const kids = childrenOf(model, ownerId);
    const seen = new Map<string, string>();
    for (const kid of kids) {
      const prev = seen.get(kid.name);
      if (prev !== undefined) {
        // TODO: KerML allows redefinition to reuse an inherited feature's name.
        // Sygil doesn't model redefinition yet, so all sibling duplicates are errors.
        out.push({
          severity: "error",
          code: "name-not-distinguishable",
          message: `Name '${kid.name}' is not distinguishable from a sibling member with the same name`,
          elementId: kid.id,
        });
      } else {
        seen.set(kid.name, kid.id);
      }
    }
  }
  return out;
}

function checkSpecializationCycles(model: Model): Diagnostic[] {
  const out: Diagnostic[] = [];
  const defs = partDefs(model);
  const byName = new Map<string, string[]>();
  for (const pd of defs) {
    byName.set(pd.name, pd.specializations);
  }

  for (const pd of defs) {
    const visited = new Set<string>();
    let cur = pd.specializations;
    let cyclic = false;
    const queue = [...cur];
    while (queue.length > 0) {
      const name = queue.pop()!;
      if (name === pd.name) {
        cyclic = true;
        break;
      }
      if (visited.has(name)) continue;
      visited.add(name);
      const parents = byName.get(name);
      if (parents) queue.push(...parents);
    }
    if (cyclic) {
      out.push({
        severity: "error",
        code: "specialization-cycle",
        message: `'${pd.name}' has a circular specialization chain`,
        elementId: pd.id,
      });
    }
  }
  return out;
}

const MULT_RE = /^(\d+)$|^(\d+)\.\.(\d+|\*)$|^\*$/;

function checkMalformedMultiplicity(model: Model): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const el of Object.values(model.elements)) {
    const mult =
      (el.kind === "partUsage" || el.kind === "attributeUsage") ? el.multiplicity : undefined;
    if (!mult) continue;
    const m = mult.match(MULT_RE);
    if (!m) {
      out.push({
        severity: "warning",
        code: "malformed-multiplicity",
        message: `Multiplicity '${mult}' is not a valid range`,
        elementId: el.id,
      });
      continue;
    }
    if (m[2] && m[3] && m[3] !== "*") {
      const lower = parseInt(m[2], 10);
      const upper = parseInt(m[3], 10);
      if (lower > upper) {
        out.push({
          severity: "warning",
          code: "malformed-multiplicity",
          message: `Multiplicity '${mult}' has lower bound greater than upper bound`,
          elementId: el.id,
        });
      }
    }
  }
  return out;
}

function checkUnresolvedAttributeTypes(
  model: Model,
  names: Set<string>,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const el of Object.values(model.elements)) {
    if (el.kind === "attributeUsage" && !names.has(el.dataType)) {
      out.push({
        severity: "error",
        code: "unresolved-attribute-type",
        message: `Attribute type '${el.dataType}' is not a known ScalarValues type or defined element`,
        elementId: el.id,
      });
    }
  }
  return out;
}

export function validate(model: Model): Diagnostic[] {
  const names = resolvableNames(model);
  return [
    ...checkUnresolvedTypes(model, names),
    ...checkUnresolvedSpecializations(model, names),
    ...checkDuplicateNames(model),
    ...checkSpecializationCycles(model),
    ...checkMalformedMultiplicity(model),
    ...checkUnresolvedAttributeTypes(model, names),
  ];
}
