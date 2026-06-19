import {
  childrenOf,
  getRoot,
  type Element,
  type Model,
} from "@sygil/model";

const INDENT = "    ";

function ind(depth: number): string {
  return INDENT.repeat(depth);
}

function mult(m: string | undefined): string {
  return m ? `[${m}]` : "";
}

function serializeElement(model: Model, el: Element, depth: number): string {
  const pad = ind(depth);
  switch (el.kind) {
    case "partDef": {
      const spec = el.specializations.length
        ? ` :> ${el.specializations.join(", ")}`
        : "";
      const header = `part def ${el.name}${spec}`;
      const members = childrenOf(model, el.id);
      if (members.length === 0) return `${pad}${header};`;
      const body = members
        .map((m) => serializeElement(model, m, depth + 1))
        .join("\n");
      return `${pad}${header} {\n${body}\n${pad}}`;
    }
    case "attributeUsage":
      return `${pad}attribute ${el.name} : ${el.dataType}${mult(el.multiplicity)};`;
    case "partUsage": {
      const kw = el.isReference ? "ref part" : "part";
      const type = el.typeName ? ` : ${el.typeName}` : "";
      return `${pad}${kw} ${el.name}${type}${mult(el.multiplicity)};`;
    }
    case "raw":
      return el.text
        .split("\n")
        .map((line) => (line.length ? pad + line : line))
        .join("\n");
    case "package":
      // Nested packages are not part of the MVP subset; treat defensively.
      return `${pad}package ${el.name};`;
  }
}

/**
 * Deterministic serialization of a model to SysML v2 textual notation.
 * Tool-owned formatting: 4-space indent, definitions in `order`, trailing
 * semicolons. Stable output is what makes Git diffs meaningful.
 */
export function serialize(model: Model): string {
  const root = getRoot(model);
  const members = childrenOf(model, root.id);
  const body = members
    .map((m) => serializeElement(model, m, 1))
    .join("\n");
  return `package ${root.name} {\n${body ? body + "\n" : ""}}\n`;
}
