import { serialize } from "@sygil/sysml-notation";
import type { Model } from "@sygil/model";

export interface ExportArtifact {
  /** Suggested file name, e.g. "VehicleModel.json". */
  filename: string;
  mimeType: string;
  content: string;
}

/**
 * Plugin contract for the export/integration layer. Simulation adapters
 * (OpenModelica, Simulink, …) implement this same interface; the MVP ships the
 * JSON reference adapter and documented stubs for the rest.
 */
export interface ExportAdapter {
  id: string;
  label: string;
  export(model: Model): ExportArtifact[];
}

/** Reference adapter: dumps the canonical model as JSON. */
export const JsonExportAdapter: ExportAdapter = {
  id: "json",
  label: "JSON (canonical model)",
  export(model: Model): ExportArtifact[] {
    return [
      {
        filename: `${model.elements[model.rootId]?.name ?? "model"}.json`,
        mimeType: "application/json",
        content: JSON.stringify(model, null, 2),
      },
    ];
  },
};

/** Convenience adapter that emits the raw SysML v2 textual notation. */
export const SysmlTextAdapter: ExportAdapter = {
  id: "sysml",
  label: "SysML v2 text (.sysml)",
  export(model: Model): ExportArtifact[] {
    return [
      {
        filename: `${model.elements[model.rootId]?.name ?? "model"}.sysml`,
        mimeType: "text/plain",
        content: serialize(model),
      },
    ];
  },
};

/**
 * Documented stub. Proves the interface shape for a future simulation adapter;
 * full OpenModelica generation is out of scope for the MVP.
 */
export const ModelicaStubAdapter: ExportAdapter = {
  id: "modelica-stub",
  label: "OpenModelica (stub)",
  export(model: Model): ExportArtifact[] {
    const name = model.elements[model.rootId]?.name ?? "model";
    return [
      {
        filename: `${name}.mo`,
        mimeType: "text/plain",
        content:
          `// Sygil OpenModelica export — STUB.\n` +
          `// The export plugin interface is implemented; Modelica generation\n` +
          `// is a future adapter. Source package: ${name}.\n`,
      },
    ];
  },
};

export const builtinAdapters: ExportAdapter[] = [
  JsonExportAdapter,
  SysmlTextAdapter,
  ModelicaStubAdapter,
];
