export interface RepoFile {
  /** Repo-relative path, e.g. "model/VehicleModel.sysml". */
  path: string;
  content: string;
}

export interface CommitResult {
  commitSha: string;
}

/**
 * Abstraction over a Git host. GitHub is the MVP implementation; GitLab and
 * others slot in behind this same interface (locked decision: provider-agnostic).
 * `writeFiles` is expected to be a SINGLE atomic commit bundling all files
 * (model `.sysml` + sibling `.view.json`).
 */
export interface GitProvider {
  id: string;
  listFiles(dir: string): Promise<string[]>;
  readFile(path: string): Promise<string>;
  writeFiles(files: RepoFile[], message: string): Promise<CommitResult>;
}
