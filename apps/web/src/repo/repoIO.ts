import { getRoot, partDefs, qualifiedName, shortId, type Model } from "@sygil/model";
import { parse, serialize } from "@sygil/sysml-notation";
import type { CommitResult, GitProvider } from "@sygil/git";
import type { DiagramMeta, NodePos } from "../store/sygilStore.js";

interface ViewDiagram {
  id: string;
  kind: string;
  name: string;
  packageId?: string;
  nodes: Record<string, NodePos>;
  edges: Record<string, unknown>;
}

interface ViewFile {
  schema: number;
  package: string;
  diagrams: ViewDiagram[];
}

export async function saveToRepo(
  provider: GitProvider,
  model: Model,
  diagrams: DiagramMeta[],
): Promise<CommitResult> {
  const name = getRoot(model).name;
  const viewDiagrams: ViewDiagram[] = diagrams.map((d) => {
    const nodes: Record<string, NodePos> = {};
    for (const pd of partDefs(model)) {
      const qn = qualifiedName(model, pd.id);
      if (d.layout[qn]) nodes[qn] = d.layout[qn];
    }
    return { id: d.id, kind: d.kind, name: d.name, packageId: d.packageId, nodes, edges: {} };
  });
  const view: ViewFile = { schema: 1, package: name, diagrams: viewDiagrams };
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
): Promise<{ model: Model; diagrams: DiagramMeta[] }> {
  const text = await provider.readFile(`model/${packageName}.sysml`);
  const { model, errors } = parse(text);
  if (!model) throw new Error(`Parse failed: ${errors[0]?.message ?? "unknown"}`);
  let diagrams: DiagramMeta[] = [];
  try {
    const view = JSON.parse(
      await provider.readFile(`views/${packageName}.view.json`),
    ) as ViewFile;
    diagrams = view.diagrams.map((d) => ({
      id: d.id,
      kind: "bdd" as const,
      name: d.name,
      packageId: d.packageId ?? model.rootId,
      layout: d.nodes ?? {},
    }));
  } catch {
    // No view file yet — will get a default diagram from the store.
  }
  if (diagrams.length === 0) {
    diagrams = [{ id: shortId(), kind: "bdd", name: "Main BDD", packageId: model.rootId, layout: {} }];
  }
  return { model, diagrams };
}
