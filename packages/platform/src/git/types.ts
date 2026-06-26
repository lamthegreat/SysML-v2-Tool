export interface RepoFile {
  /** Repo-relative path, e.g. "model/VehicleModel.sysml". */
  path: string;
  content: string;
}

export interface CommitResult {
  commitSha: string;
}

/** A pull/merge request created on the host. */
export interface PullRequest {
  /** Web URL to view the PR. */
  url: string;
  number: number;
}

/** One file's change between two refs, as returned by a host's compare API. */
export interface FileDiff {
  /** Repo-relative path, e.g. "model/VehicleModel.sysml". */
  path: string;
  /** Host status, e.g. "added" | "modified" | "removed" | "renamed". */
  status: string;
  /** Unified-diff hunk text. May be empty for binary/too-large files. */
  patch: string;
}

/**
 * Abstraction over a Git host. GitHub is the MVP implementation; GitLab and
 * others slot in behind this same interface (locked decision: provider-agnostic).
 * `writeFiles` is expected to be a SINGLE atomic commit bundling all files
 * (model `.sysml` + sibling `.view.json`).
 *
 * The branch/PR/compare methods power async collaboration. Providers without a
 * branch concept (e.g. the local one) may throw "not supported".
 */
export interface GitProvider {
  id: string;
  listFiles(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFiles(files: RepoFile[], message: string): Promise<CommitResult>;

  /** Names of all branches on the host. */
  listBranches(): Promise<string[]>;
  /** Create branch `name` pointing at the head of `from`. */
  createBranch(name: string, from: string): Promise<void>;
  /** Open a pull request from `head` into `base`. */
  createPullRequest(opts: {
    title: string;
    head: string;
    base: string;
    body?: string;
  }): Promise<PullRequest>;
  /** Files changed between `base` and `head` (i.e. `base...head`). */
  compareBranches(base: string, head: string): Promise<FileDiff[]>;
}
