import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  action?: () => void;
  danger?: boolean;
  children?: MenuItem[];
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

function SubMenu({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  if (!item.children?.length) return null;

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="flex w-full items-center justify-between px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        {item.label}
        <span className="ml-2 text-[9px] text-slate-400 dark:text-slate-500">&#9656;</span>
      </button>
      {open && (
        <div className="absolute left-full top-0 z-50 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {item.children.map((child) => (
            <button
              key={child.label}
              className={`block w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
                child.danger ? "text-red-600 dark:text-red-300" : "text-slate-700 dark:text-slate-200"
              }`}
              onClick={() => {
                child.action?.();
                onClose();
              }}
            >
              {child.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900"
      style={{ left: x, top: y }}
    >
      {items.map((item) =>
        item.children ? (
          <SubMenu key={item.label} item={item} onClose={onClose} />
        ) : (
          <button
            key={item.label}
            className={`block w-full px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800 ${
              item.danger ? "text-red-600 dark:text-red-300" : "text-slate-700 dark:text-slate-200"
            }`}
            onClick={() => {
              item.action?.();
              onClose();
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
