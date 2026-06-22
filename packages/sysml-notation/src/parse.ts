import {
  shortId,
  type Element,
  type Model,
  type PartDef,
  type RawElement,
} from "@sygil/model";
import { tokenize, TokenizeError, type Token } from "./tokenizer.js";

export interface ParseError {
  message: string;
  start: number;
  end: number;
}

export interface ParseResult {
  /** Best-effort model. Present even when `errors` is non-empty. */
  model: Model | null;
  errors: ParseError[];
}

class ParseFail extends Error {
  constructor(
    message: string,
    public start: number,
    public end: number,
  ) {
    super(message);
  }
}

/**
 * Parse the MVP subset of SysML v2 textual notation into a canonical model.
 *
 * Resilient by design: unrecognized-but-well-formed statements are preserved as
 * `raw` elements (verbatim), and malformed members are reported as errors while
 * the parser recovers and keeps going — so the diagram can hold steady on the
 * last good members rather than collapsing on a single typo.
 */
export function parse(src: string): ParseResult {
  let tokens: Token[];
  try {
    tokens = tokenize(src);
  } catch (e) {
    if (e instanceof TokenizeError) {
      return { model: null, errors: [{ message: e.message, start: e.start, end: e.end }] };
    }
    throw e;
  }

  const errors: ParseError[] = [];
  const elements: Record<string, Element> = {};
  let pos = 0;

  const peek = (k = 0): Token => tokens[Math.min(pos + k, tokens.length - 1)];
  const atEof = (): boolean => peek().type === "eof";

  const expectName = (what: string): Token => {
    const t = peek();
    if (t.type !== "name") throw new ParseFail(`Expected ${what}`, t.start, t.end);
    pos++;
    return t;
  };
  const expectPunct = (value: string): Token => {
    const t = peek();
    if (t.type !== "punct" || t.value !== value)
      throw new ParseFail(`Expected '${value}'`, t.start, t.end);
    pos++;
    return t;
  };
  const isName = (v: string, k = 0): boolean =>
    peek(k).type === "name" && peek(k).value === v;
  const isPunct = (v: string, k = 0): boolean =>
    peek(k).type === "punct" && peek(k).value === v;

  const add = (el: Element): void => {
    elements[el.id] = el;
  };

  let orderCounter = new Map<string, number>();
  const nextOrder = (ownerId: string): number => {
    const c = orderCounter.get(ownerId) ?? 0;
    orderCounter.set(ownerId, c + 1);
    return c;
  };

  /** Capture an unrecognized statement verbatim as a `raw` element. */
  const captureRaw = (ownerId: string): void => {
    const start = peek().start;
    let depth = 0;
    while (!atEof()) {
      const t = peek();
      if (isPunct("{")) {
        depth++;
        pos++;
      } else if (isPunct("}")) {
        if (depth === 0) break; // belongs to the enclosing block
        depth--;
        pos++;
        if (depth === 0) {
          if (isPunct(";")) pos++;
          break;
        }
      } else if (isPunct(";") && depth === 0) {
        pos++;
        break;
      } else {
        pos++;
      }
      void t;
    }
    const end = tokens[Math.max(pos - 1, 0)].end;
    const raw: RawElement = {
      id: shortId(),
      kind: "raw",
      name: src.slice(start, end).trim().slice(0, 40),
      ownerId,
      order: nextOrder(ownerId),
      text: src.slice(start, end).trim(),
    };
    add(raw);
  };

  /** Skip to the next plausible statement boundary after an error. */
  const recover = (): void => {
    let depth = 0;
    while (!atEof()) {
      if (isPunct("{")) depth++;
      else if (isPunct("}")) {
        if (depth === 0) return;
        depth--;
      } else if (isPunct(";") && depth === 0) {
        pos++;
        return;
      }
      pos++;
    }
  };

  const parseSpecializations = (): string[] => {
    const specs: string[] = [];
    if (isPunct(":>") || isName("specializes")) {
      pos++;
      specs.push(expectName("supertype name").value);
      while (isPunct(",")) {
        pos++;
        specs.push(expectName("supertype name").value);
      }
    }
    return specs;
  };

  const parseAttribute = (ownerId: string): void => {
    pos++; // 'attribute'
    const name = expectName("attribute name").value;
    expectPunct(":");
    const dataType = expectName("attribute type").value;
    let multiplicity: string | undefined;
    if (peek().type === "mult") {
      multiplicity = peek().value;
      pos++;
    }
    expectPunct(";");
    add({
      id: shortId(),
      kind: "attributeUsage",
      name,
      ownerId,
      order: nextOrder(ownerId),
      dataType,
      multiplicity,
    });
  };

  const parsePartUsage = (ownerId: string, isReference: boolean): void => {
    if (isReference) pos++; // 'ref'
    pos++; // 'part'
    const name = expectName("part name").value;
    let typeName: string | undefined;
    if (isPunct(":")) {
      pos++;
      typeName = expectName("part type").value;
    }
    let multiplicity: string | undefined;
    if (peek().type === "mult") {
      multiplicity = peek().value;
      pos++;
    }
    expectPunct(";");
    add({
      id: shortId(),
      kind: "partUsage",
      name,
      ownerId,
      order: nextOrder(ownerId),
      typeName,
      isReference,
      multiplicity,
    });
  };

  const parsePartDef = (ownerId: string): void => {
    pos += 2; // 'part' 'def'
    const id = shortId();
    const name = expectName("part def name").value;
    const specializations = parseSpecializations();
    const def: PartDef = {
      id,
      kind: "partDef",
      name,
      ownerId,
      order: nextOrder(ownerId),
      specializations,
    };
    add(def);
    if (isPunct(";")) {
      pos++;
      return;
    }
    expectPunct("{");
    while (!isPunct("}") && !atEof()) {
      parseMember(id);
    }
    expectPunct("}");
  };

  const parsePackageBody = (ownerId: string): void => {
    expectPunct("{");
    while (!isPunct("}") && !atEof()) {
      parseMember(ownerId);
    }
    // The loop exits only on `}` or EOF; tolerate a missing close at EOF so the
    // diagram can update live while the user is mid-typing an unclosed brace.
    if (isPunct("}")) pos++;
  };

  const parseNestedPackage = (ownerId: string): void => {
    pos++; // 'package'
    const id = shortId();
    const name = expectName("package name").value;
    add({ id, kind: "package", name, ownerId, order: nextOrder(ownerId) });
    if (isPunct(";")) {
      pos++;
      return;
    }
    parsePackageBody(id);
  };

  function parseMember(ownerId: string): void {
    const startPos = pos;
    try {
      if (isName("package")) parseNestedPackage(ownerId);
      else if (isName("part") && isName("def", 1)) parsePartDef(ownerId);
      else if (isName("ref") && isName("part", 1)) parsePartUsage(ownerId, true);
      else if (isName("part")) parsePartUsage(ownerId, false);
      else if (isName("attribute")) parseAttribute(ownerId);
      else captureRaw(ownerId);
    } catch (e) {
      if (e instanceof ParseFail) {
        errors.push({ message: e.message, start: e.start, end: e.end });
        if (pos === startPos) pos++; // guarantee progress
        recover();
      } else {
        throw e;
      }
    }
  }

  // ---- top level: a single package ----
  try {
    if (!isName("package")) {
      const t = peek();
      throw new ParseFail("Expected 'package' declaration", t.start, t.end);
    }
    pos++; // 'package'
    const pkgName = expectName("package name").value;
    const rootId = shortId();
    add({ id: rootId, kind: "package", name: pkgName, ownerId: null, order: 0 });
    parsePackageBody(rootId);
    return { model: { rootId, elements }, errors };
  } catch (e) {
    if (e instanceof ParseFail) {
      errors.push({ message: e.message, start: e.start, end: e.end });
      return { model: null, errors };
    }
    throw e;
  }
}
