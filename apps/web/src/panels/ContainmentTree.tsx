import { useCallback, useMemo, useState } from "react";
import {
  allPackages,
  childrenOf,
  getRoot,
  qualifiedName,
  type Element,
  type Model,
} from "@sygil/model";
import { useSygil } from "../store/sygilStore.js";
import { EditableText } from "../components/EditableText.js";
import { ContextMenu, type MenuItem } from "../components/ContextMenu.js";

// ── Icons (tiny inline SVG to avoid a dependency) ───────────────────────────

function PkgIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-amber-600" fill="currentColor">
      <path d="M1 3.5l7-2.5 7 2.5v9l-7 2.5-7-2.5v-9zm1 .87v7.26l6 2.14V6.51L2 4.37zm7 9.4l6-2.14V4.37L9 6.51v7.26zM8 2.14L2.7 4 8 5.86 13.3 4 8 2.14z" />
    </svg>
  );
}

function BlockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-sky-600" fill="currentColor">
      <path d="M2 2h12v12H2V2zm1 1v10h10V3H3z" />
      <path d="M4 5h8v1H4zM4 7h6v1H4z" />
    </svg>
  );
}

function AttrIcon() {
  return <span className="h-3.5 w-3.5 shrink-0 text-center text-[10px] leading-[14px] text-slate-400">a</span>;
}

function PartIcon() {
  return <span className="h-3.5 w-3.5 shrink-0 text-center text-[10px] leading-[14px] text-emerald-500">p</span>;
}

function RawIcon() {
  return <span className="h-3.5 w-3.5 shrink-0 text-center text-[10px] leading-[14px] text-amber-500">?</span>;
}

function DiagramIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 ${active ? "text-sky-500" : "text-slate-400"}`} fill="currentColor">
      <path d="M1 1h5v5H1V1zm2 2v1h1V3H3zM9 1h5v5H9V1zm2 2v1h1V3h-1zM1 10h5v5H1v-5zm2 2v1h1v-1H3zM6 3.5h3v1H6zM3.5 6v4h1V6zM11.5 6v4h1V6z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="currentColor">
      <path d="M1 3h5l2 2h7v9H1V3zm1 1v9h12V6H7.5l-2-2H2z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="currentColor"
    >
      <path d="M6 4l4 4-4 4V4z" />
    </svg>
  );
}

// ── Context menu state ──────────────────────────────────────────────────────

interface CtxState {
  x: number;
  y: number;
  items: MenuItem[];
}

// ── Tree node ───────────────────────────────────────────────────────────────

function elementIcon(kind: Element["kind"]) {
  switch (kind) {
    case "package": return <PkgIcon />;
    case "partDef": return <BlockIcon />;
    case "attributeUsage": return <AttrIcon />;
    case "partUsage": return <PartIcon />;
    case "raw": return <RawIcon />;
  }
}

function elementLabel(el: Element): string {
  switch (el.kind) {
    case "package": return el.name;
    case "partDef":
      return el.specializations.length
        ? `${el.name} :> ${el.specializations.join(", ")}`
        : el.name;
    case "attributeUsage":
      return `${el.name} : ${el.dataType}${el.multiplicity ? `[${el.multiplicity}]` : ""}`;
    case "partUsage": {
      const kw = el.isReference ? "ref " : "";
      const type = el.typeName ? ` : ${el.typeName}` : "";
      const mult = el.multiplicity ? `[${el.multiplicity}]` : "";
      return `${kw}${el.name}${type}${mult}`;
    }
    case "raw":
      return el.text.slice(0, 30);
  }
}

// ── Diagrams inline under a package ────────────────────────────────────────

function DiagramsInline({
  packageId,
  depth,
  onCtx,
}: {
  packageId: string;
  depth: number;
  onCtx: (e: React.MouseEvent, items: MenuItem[]) => void;
}) {
  const allDiagrams = useSygil((s) => s.diagrams);
  const diagrams = useMemo(
    () => allDiagrams.filter((d) => d.packageId === packageId),
    [allDiagrams, packageId],
  );
  const activeDiagramId = useSygil((s) => s.activeDiagramId);
  const model = useSygil((s) => s.model);
  const setActive = useSygil((s) => s.setActiveDiagram);
  const addDiagram = useSygil((s) => s.addDiagram);
  const renameDiagram = useSygil((s) => s.renameDiagram);
  const deleteDiagram = useSygil((s) => s.deleteDiagram);
  const moveDiagram = useSygil((s) => s.moveDiagram);
  const [open, setOpen] = useState(true);

  const hasDiagrams = diagrams.length > 0;

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-slate-100"
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => setOpen((o) => !o)}
      >
        {hasDiagrams ? <ChevronIcon open={open} /> : <span className="w-3" />}
        <FolderIcon />
        <span className="text-[11px] font-medium text-slate-500">Diagrams</span>
      </div>
      {open && (
        <>
          {diagrams.map((d) => {
            const isActive = d.id === activeDiagramId;
            const pkgs = allPackages(model);
            const moveTargets = pkgs.filter((p) => p.id !== packageId);
            return (
              <div
                key={d.id}
                className={`flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 ${
                  isActive ? "bg-sky-50 font-semibold text-sky-700" : "hover:bg-slate-100"
                }`}
                style={{ paddingLeft: (depth + 1) * 16 + 4 }}
                onClick={() => setActive(d.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const items: MenuItem[] = [];
                  if (moveTargets.length > 0) {
                    items.push({
                      label: "Move to",
                      children: moveTargets.map((p) => ({
                        label: qualifiedName(model, p.id),
                        action: () => moveDiagram(d.id, p.id),
                      })),
                    });
                  }
                  if (allDiagrams.length > 1) {
                    items.push({ label: "Delete", action: () => deleteDiagram(d.id), danger: true });
                  }
                  if (items.length) onCtx(e, items);
                }}
              >
                <DiagramIcon active={isActive} />
                <EditableText
                  value={d.name}
                  onCommit={(n) => renameDiagram(d.id, n)}
                  className="truncate text-[11px]"
                />
                {isActive && (
                  <span className="ml-auto text-[9px] text-sky-400">active</span>
                )}
              </div>
            );
          })}
          <button
            className="text-[11px] text-sky-600 hover:underline"
            style={{ marginLeft: (depth + 1) * 16 + 4 }}
            onClick={() => addDiagram(undefined, packageId)}
          >
            + New diagram
          </button>
        </>
      )}
    </div>
  );
}

// ── Tree node ───────────────────────────────────────────────────────────────

function TreeNode({
  el,
  model,
  depth,
  onCtx,
}: {
  el: Element;
  model: Model;
  depth: number;
  onCtx: (e: React.MouseEvent, items: MenuItem[]) => void;
}) {
  const selectedId = useSygil((s) => s.selectedId);
  const setSelected = useSygil((s) => s.setSelected);
  const renameElement = useSygil((s) => s.renameElement);
  const addPackageUnder = useSygil((s) => s.addPackageUnder);
  const addPartDefUnder = useSygil((s) => s.addPartDefUnder);
  const addAttr = useSygil((s) => s.addAttributeTo);
  const addPart = useSygil((s) => s.addPartTo);
  const removeEl = useSygil((s) => s.removeElement);
  const addDiagram = useSygil((s) => s.addDiagram);

  const kids = childrenOf(model, el.id);
  const isPackage = el.kind === "package";
  const hasChildren = kids.length > 0 || isPackage;
  const [open, setOpen] = useState(true);
  const isSelected = selectedId === el.id;
  const isRaw = el.kind === "raw";

  const contextItems = useCallback((): MenuItem[] => {
    switch (el.kind) {
      case "package":
        return [
          { label: "Add Package", action: () => addPackageUnder(el.id) },
          { label: "Add Part Def", action: () => addPartDefUnder(el.id) },
          { label: "Add Diagram", action: () => addDiagram(undefined, el.id) },
          ...(el.ownerId
            ? [{ label: "Delete", action: () => removeEl(el.id), danger: true }]
            : []),
        ];
      case "partDef":
        return [
          { label: "Add Attribute", action: () => addAttr(el.id) },
          { label: "Add Part Usage", action: () => addPart(el.id) },
          { label: "Delete", action: () => removeEl(el.id), danger: true },
        ];
      case "attributeUsage":
      case "partUsage":
        return [{ label: "Delete", action: () => removeEl(el.id), danger: true }];
      default:
        return [];
    }
  }, [el, addPackageUnder, addPartDefUnder, addAttr, addPart, removeEl, addDiagram]);

  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded-sm px-1 py-0.5 ${
          isSelected ? "bg-sky-100 text-sky-800" : "hover:bg-slate-100"
        } ${isRaw ? "italic text-amber-700 opacity-70" : ""}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => {
          setSelected(el.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const items = contextItems();
          if (items.length) onCtx(e, items);
        }}
      >
        {hasChildren ? <ChevronIcon open={open} /> : <span className="w-3" />}
        {elementIcon(el.kind)}
        {el.kind === "raw" ? (
          <span className="truncate text-[11px]">{elementLabel(el)}</span>
        ) : (
          <EditableText
            value={el.name}
            onCommit={(n) => renameElement(el.id, n)}
            className="truncate text-[11px]"
            title={elementLabel(el)}
          />
        )}
        {el.kind !== "package" && el.kind !== "raw" && el.kind !== "partDef" && (
          <span className="ml-auto truncate text-[10px] text-slate-400">
            {el.kind === "attributeUsage" ? el.dataType : el.kind === "partUsage" ? el.typeName ?? "" : ""}
          </span>
        )}
      </div>
      {open && (
        <>
          {kids.map((child) => (
            <TreeNode key={child.id} el={child} model={model} depth={depth + 1} onCtx={onCtx} />
          ))}
          {isPackage && (
            <DiagramsInline packageId={el.id} depth={depth + 1} onCtx={onCtx} />
          )}
        </>
      )}
    </div>
  );
}

// ── Main tree component ─────────────────────────────────────────────────────

export function ContainmentTree() {
  const model = useSygil((s) => s.model);
  const root = getRoot(model);
  const [ctx, setCtx] = useState<CtxState | null>(null);

  const onCtx = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    setCtx({ x: e.clientX, y: e.clientY, items });
  }, []);

  return (
    <div className="relative h-full select-none text-slate-700">
      <TreeNode el={root} model={model} depth={0} onCtx={onCtx} />
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
    </div>
  );
}
