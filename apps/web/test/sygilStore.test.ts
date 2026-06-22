import { beforeEach, describe, expect, it } from "vitest";
import {
  addPartDef,
  childrenOf,
  createModel,
  qualifiedName,
  type Element,
} from "@sygil/model";
import { serialize, parse } from "@sygil/sysml-notation";
import {
  useSygil,
  activePackageIdOf,
  getActiveLayout,
  type SygilState,
} from "../src/store/sygilStore.js";

/** Reset the singleton store to a known single-package model + root diagram. */
function reset(): void {
  let m = createModel("Root");
  m = addPartDef(m, "RootBlock").model;
  useSygil.getState().loadModel(m, []);
}

/** Mirror the canvas's node-selection rule: package-scoped + placed in layout. */
function visibleNodeIds(state: SygilState): string[] {
  const pkgId = activePackageIdOf(state);
  const layout = getActiveLayout(state);
  return childrenOf(state.model, pkgId)
    .filter(
      (el: Element) =>
        (el.kind === "partDef" || el.kind === "raw") &&
        qualifiedName(state.model, el.id) in layout,
    )
    .map((el) => el.id);
}

function nestedPackageId(): string {
  const { model } = useSygil.getState();
  const pkg = childrenOf(model, model.rootId).find((c) => c.kind === "package");
  if (!pkg) throw new Error("expected a nested package");
  return pkg.id;
}

describe("diagram package scoping", () => {
  beforeEach(reset);

  it("addBlock creates a partDef under the active diagram's package and places it only there", () => {
    const rootId = useSygil.getState().model.rootId;
    const rootDiagramId = useSygil.getState().activeDiagramId;

    // Nested package + a diagram scoped to it (addDiagram makes it active).
    useSygil.getState().addPackageUnder(rootId);
    const pkgId = nestedPackageId();
    useSygil.getState().addDiagram(undefined, pkgId);
    const nestedDiagramId = useSygil.getState().activeDiagramId;
    expect(nestedDiagramId).not.toBe(rootDiagramId);

    useSygil.getState().addBlock();

    const { model, diagrams } = useSygil.getState();
    const newBlock = childrenOf(model, pkgId).find((c) => c.kind === "partDef");
    expect(newBlock).toBeDefined();
    expect(newBlock!.ownerId).toBe(pkgId);

    const qn = qualifiedName(model, newBlock!.id);
    const nested = diagrams.find((d) => d.id === nestedDiagramId)!;
    const rootDiagram = diagrams.find((d) => d.id === rootDiagramId)!;
    expect(qn in nested.layout).toBe(true);
    expect(qn in rootDiagram.layout).toBe(false);
  });

  it("switching the active diagram yields a package-scoped node set", () => {
    const rootId = useSygil.getState().model.rootId;
    const rootDiagramId = useSygil.getState().activeDiagramId;

    useSygil.getState().addPackageUnder(rootId);
    const pkgId = nestedPackageId();
    useSygil.getState().addDiagram(undefined, pkgId);
    const nestedDiagramId = useSygil.getState().activeDiagramId;
    useSygil.getState().addBlock(); // lands in the nested package

    const model = useSygil.getState().model;
    const rootBlock = childrenOf(model, rootId).find(
      (c) => c.kind === "partDef" && c.name === "RootBlock",
    )!;
    const nestedBlock = childrenOf(model, pkgId).find((c) => c.kind === "partDef")!;

    // Active = nested diagram: only the nested block is visible.
    let visible = visibleNodeIds(useSygil.getState());
    expect(visible).toContain(nestedBlock.id);
    expect(visible).not.toContain(rootBlock.id);

    // Active = root diagram: only the root block is visible.
    useSygil.getState().setActiveDiagram(rootDiagramId);
    visible = visibleNodeIds(useSygil.getState());
    expect(visible).toContain(rootBlock.id);
    expect(visible).not.toContain(nestedBlock.id);

    expect(nestedDiagramId).not.toBe(rootDiagramId);
  });

  it("nested additions still serialize and round-trip cleanly", () => {
    const rootId = useSygil.getState().model.rootId;
    useSygil.getState().addPackageUnder(rootId);
    const pkgId = nestedPackageId();
    useSygil.getState().addDiagram(undefined, pkgId);
    useSygil.getState().addBlock();

    const text = serialize(useSygil.getState().model);
    const { model: reparsed, errors } = parse(text);
    expect(errors).toEqual([]);
    expect(reparsed).not.toBeNull();
    expect(serialize(reparsed!)).toBe(text);
  });
});
