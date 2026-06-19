# Sygil

> Open-source, browser-based, Git-native **SysML v2** modeling tool.

Engineers author familiar SysML **v1-style diagrams** (starting with BDD) on a
modern canvas; the canonical artifact on disk is **SysML v2 textual notation** —
diffable, PR-reviewable, one file per package. The diagram and a live text
editor are **co-equal, editable surfaces** over one in-memory canonical model.

## Status — MVP vertical slice

- ✅ Canonical model + deterministic v2 serializer + resilient subset parser
- ✅ Round-trip guarantee `serialize(parse(serialize(m))) === serialize(m)`
- ✅ BDD canvas (React Flow): blocks, attributes, parts, `:>` specialization
- ✅ Dual-surface sync: diagram ⇄ canonical model ⇄ text editor (CodeMirror)
- ✅ Inline parse diagnostics; unrecognized constructs preserved as read-only `raw`
- ✅ Git layer: GitHub (PAT, atomic multi-file commit) + LocalProvider; view
  metadata committed beside the model, keyed by qualified name
- ✅ Export plugin layer: JSON + `.sysml`, with a Modelica stub

## Architecture

| Layer | Package | Notes |
|-------|---------|-------|
| Canonical model | `@sygil/model` | Framework-agnostic; stable in-memory ids never hit `.sysml` |
| Notation | `@sygil/sysml-notation` | Serializer + always-on subset parser (swappable) |
| Repository | `@sygil/git` | `GitProvider` interface; GitHub + local providers |
| Export | `@sygil/export` | `ExportAdapter` plugin contract |
| UI | `apps/web` | Vite + React + React Flow + Tailwind + Zustand |

Key decisions: serialize-first (no Java engine, no model server); static SPA +
direct Git-host API; qualified-name identity for view metadata and cross-surface
reconciliation (no ids in text → clean diffs); async Git collaboration.

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # round-trip + repo unit tests
pnpm typecheck
pnpm build
```

## License

MIT
