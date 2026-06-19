import type { CommitResult, GitProvider, RepoFile } from "./types.js";

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  /** Personal Access Token (MVP auth — zero backend on the critical path). */
  token: string;
}

const API = "https://api.github.com";

/**
 * GitHub-backed provider. Reads via the Contents API; writes via the Git Data
 * API (blobs → tree → commit → update-ref) so one Save = one atomic commit
 * spanning every file.
 */
export class GitHubProvider implements GitProvider {
  readonly id = "github";
  constructor(private cfg: GitHubConfig) {}

  private async gh<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub ${res.status} ${path}: ${body}`);
    }
    return (await res.json()) as T;
  }

  private repoPath(): string {
    return `/repos/${this.cfg.owner}/${this.cfg.repo}`;
  }

  async listFiles(dir: string): Promise<string[]> {
    try {
      const items = await this.gh<Array<{ path: string; type: string }>>(
        `${this.repoPath()}/contents/${encodeURIComponent(dir)}?ref=${this.cfg.branch}`,
      );
      return items.filter((i) => i.type === "file").map((i) => i.path);
    } catch {
      return []; // directory may not exist yet
    }
  }

  async readFile(path: string): Promise<string> {
    const file = await this.gh<{ content: string; encoding: string }>(
      `${this.repoPath()}/contents/${path}?ref=${this.cfg.branch}`,
    );
    return file.encoding === "base64"
      ? decodeBase64(file.content)
      : file.content;
  }

  async writeFiles(files: RepoFile[], message: string): Promise<CommitResult> {
    const ref = await this.gh<{ object: { sha: string } }>(
      `${this.repoPath()}/git/ref/heads/${this.cfg.branch}`,
    );
    const baseCommitSha = ref.object.sha;
    const baseCommit = await this.gh<{ tree: { sha: string } }>(
      `${this.repoPath()}/git/commits/${baseCommitSha}`,
    );

    const tree = await Promise.all(
      files.map(async (f) => {
        const blob = await this.gh<{ sha: string }>(
          `${this.repoPath()}/git/blobs`,
          { method: "POST", body: JSON.stringify({ content: f.content, encoding: "utf-8" }) },
        );
        return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
      }),
    );

    const newTree = await this.gh<{ sha: string }>(
      `${this.repoPath()}/git/trees`,
      { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) },
    );

    const commit = await this.gh<{ sha: string }>(
      `${this.repoPath()}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
      },
    );

    await this.gh(`${this.repoPath()}/git/refs/heads/${this.cfg.branch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });

    return { commitSha: commit.sha };
  }
}

function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
