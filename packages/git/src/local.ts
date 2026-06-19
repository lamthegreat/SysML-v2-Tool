import type { CommitResult, GitProvider, RepoFile } from "./types.js";

/**
 * Backend-free provider backed by `localStorage`. Lets the full load/save loop
 * (and the round-trip verification) run with zero credentials or network — used
 * as the default in dev and in tests with an injected storage shim.
 */
export class LocalProvider implements GitProvider {
  readonly id = "local";
  private key: string;

  constructor(
    namespace = "sygil:repo",
    private storage: Pick<Storage, "getItem" | "setItem"> = globalThis.localStorage,
  ) {
    this.key = namespace;
  }

  private read(): Record<string, string> {
    const raw = this.storage.getItem(this.key);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  }
  private write(files: Record<string, string>): void {
    this.storage.setItem(this.key, JSON.stringify(files));
  }

  async listFiles(dir: string): Promise<string[]> {
    const prefix = dir.endsWith("/") ? dir : `${dir}/`;
    return Object.keys(this.read()).filter((p) => p.startsWith(prefix));
  }

  async readFile(path: string): Promise<string> {
    const files = this.read();
    if (!(path in files)) throw new Error(`No such file: ${path}`);
    return files[path];
  }

  async writeFiles(files: RepoFile[], _message: string): Promise<CommitResult> {
    const all = this.read();
    for (const f of files) all[f.path] = f.content;
    this.write(all);
    return { commitSha: `local-${Date.now().toString(36)}` };
  }
}
