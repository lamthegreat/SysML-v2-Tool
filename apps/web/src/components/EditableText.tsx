import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  title?: string;
}

/** Double-click to edit; Enter/blur commits, Escape cancels. */
export function EditableText({ value, onCommit, className, title }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (draft !== value) onCommit(draft);
    };
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
          e.stopPropagation();
        }}
        className="nodrag rounded border border-sky-400 bg-white px-1 text-inherit outline-none dark:bg-slate-950"
        size={Math.max(draft.length, 4)}
      />
    );
  }

  return (
    <span
      title={title ?? "Double-click to rename"}
      className={`cursor-text ${className ?? ""}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}
