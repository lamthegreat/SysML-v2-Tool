import { getRoot, partDefs, qualifiedName, type Model } from "@sygil/model";
import { parse, serialize } from "@sygil/sysml-notation";
import type { CommitResult, GitProvider } from "@sygil/git";
import type { Layout, NodePos } from "../store/sygilStore.js";

interface ViewFile {
  schema: number;
  package: string;
  diagrams: Array<{
    id: string;
    kind: string;
    name: string;
    nodes: Record<string, NodePos>;
    edges: Record<string, unknown>;
  }>;
}

/**
 * Save = one atomic commit bundling the `.sysml` model file and its sibling
 * `.view.json` (geometry), keyed by qualified name so the diagram restores
 * exactly on reload.
 */
export async function saveToRepo(
  provider: GitProvider,
  model: Model,
  layout: Layout,
): Promise<CommitResult> {
  const name = getRoot(model).name;
  const nodes: Record<string, NodePos> = {};
  for (const pd of partDefs(model)) {
    const qn = qualifiedName(model, pd.id);
    if (layout[qn]) nodes[qn] = layout[qn];
  }
  const view: ViewFile = {
    schema: 1,
    package: name,
    diagrams: [{ id: "bdd-main", kind: "bdd", name: `${name} BDD`, nodes, edges: {} }],
  };
  return provider.writeFiles(
    [
      { path: `model/${name}.sysml`, content: serialize(model) },
      { path: `views/${name}.view.json`, content: JSON.stringify(view, null, 2) },
    ],
    `Update ${name}`,
  );
}

export async function loadFromRepo(
  provider: GitProvider,
  packageName: string,
): Promise<{ model: Model; layout: Layout }> {
  const text = await provider.readFile(`model/${packageName}.sysml`);
  const { model, errors } = parse(text);
  if (!model) throw new Error(`Parse failed: ${errors[0]?.message ?? "unknown"}`);
  let layout: Layout = {};
  try {
    const view = JSON.parse(
      await provider.readFile(`views/${packageName}.view.json`),
    ) as ViewFile;
    layout = view.diagrams[0]?.nodes ?? {};
  } catch {
    // No view file yet — diagram will auto-layout.
  }
  return { model, layout };
}
