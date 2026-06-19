/**
 * Canonical in-memory model for Sygil.
 *
 * This representation is decoupled from both the v1-style diagram surface and
 * the SysML v2 textual notation. The diagram and the text editor are two
 * editable projections of this single source of truth.
 *
 * `id` is a stable in-memory identifier (see ids.ts). It is NEVER written to
 * `.sysml` text — keeping the textual notation clean and diff-friendly. View
 * metadata and cross-surface reconciliation key on the qualified name instead.
 */

export type ElementKind =
  | "package"
  | "partDef"
  | "attributeUsage"
  | "partUsage"
  | "raw";

/** Primitive attribute data types supported in the MVP subset. */
export type DataType = "Real" | "Integer" | "Boolean" | "String";

export const DATA_TYPES: readonly DataType[] = [
  "Real",
  "Integer",
  "Boolean",
  "String",
];

interface BaseElement {
  /** Stable in-memory id. Not serialized to `.sysml`. */
  id: string;
  kind: ElementKind;
  name: string;
  /** Owning element id, or null for the root package. */
  ownerId: string | null;
  /** Sibling ordering — drives deterministic serialization & diff stability. */
  order: number;
}

/** A namespace. Maps 1:1 to a single `.sysml` file. */
export interface PackageEl extends BaseElement {
  kind: "package";
}

/** A "block" — the structural blueprint. Emits `part def`. */
export interface PartDef extends BaseElement {
  kind: "partDef";
  /** Names of general (super) PartDefs this one specializes (`:>`). */
  specializations: string[];
}

/** A value property. Emits `attribute name : Type[mult];`. */
export interface AttributeUsage extends BaseElement {
  kind: "attributeUsage";
  /**
   * Attribute type. {@link DATA_TYPES} are the palette suggestions, but any
   * type name (e.g. a unit or user-defined value type) is accepted so
   * hand-written text round-trips without loss.
   */
  dataType: string;
  /** e.g. "1", "0..*", "1..*". Undefined = no explicit multiplicity. */
  multiplicity?: string;
}

/** A composite/reference part property. Emits `part`/`ref part name : Type[mult];`. */
export interface PartUsage extends BaseElement {
  kind: "partUsage";
  /** Referenced PartDef name (by name; resolved lazily). */
  typeName?: string;
  multiplicity?: string;
  isReference: boolean;
}

/**
 * An opaque, unrecognized construct preserved verbatim so re-serialization is
 * lossless and hand-written v2 we don't yet model is never corrupted. Rendered
 * read-only on the canvas.
 */
export interface RawElement extends BaseElement {
  kind: "raw";
  /** Verbatim source text, including trailing `;` or `{ ... }` block. */
  text: string;
}

export type Element =
  | PackageEl
  | PartDef
  | AttributeUsage
  | PartUsage
  | RawElement;

/**
 * A single package's model = the contents of one `.sysml` file. `elements` is a
 * flat id→element map; tree structure is expressed via `ownerId`.
 */
export interface Model {
  /** Id of the root package element. */
  rootId: string;
  elements: Record<string, Element>;
}
