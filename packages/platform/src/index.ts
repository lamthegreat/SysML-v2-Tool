// Git providers
export type {
  RepoFile,
  CommitResult,
  GitProvider,
  PullRequest,
  FileDiff,
} from "./git/index.js";
export { GitHubProvider, type GitHubConfig } from "./git/index.js";
export { LocalProvider } from "./git/index.js";

// Shared types
export type { NodePos, Layout, DiagramMeta } from "./types.js";

// Repo I/O
export { saveToRepo, loadFromRepo } from "./repo/repoIO.js";
export { parsePatch, type DiffLine, type DiffLineType } from "./repo/diff.js";
export {
  diffModels,
  type BlockDiff,
  type ChangeKind,
  type PartDefSnapshot,
} from "./repo/modelDiff.js";

// Review UI
export { ReviewOverlay } from "./review/ReviewOverlay.js";
export { ReviewCanvas } from "./review/ReviewCanvas.js";
export { ReviewTree } from "./review/ReviewTree.js";
export { ReviewNode, ReviewRawNode } from "./review/ReviewNode.js";
export { ElementInspector } from "./review/ElementInspector.js";
export { deriveBddGraph, type BddGraphNodeData, type BddGraphAttr, type BddGraphPart } from "./review/bddGraph.js";
export {
  changeByQname,
  packageLabel,
  diagramSummaries,
  type DiagramSummary,
  type DiagramStatus,
} from "./review/reviewDiff.js";

// Panels
export { GitPanel, type GitPanelTab } from "./panels/GitPanel.js";
export { PlatformRepoBar } from "./panels/PlatformRepoBar.js";
