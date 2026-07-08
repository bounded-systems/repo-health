// size.ts — god-file detection with REAL export counts (ts-morph
// getExportedDeclarations), not `grep -c '^export'` which miscounts re-exports,
// multi-declarations, and export groups.
import { buildProject } from "./graph.ts";

export interface FileSize {
  file: string;
  loc: number;
  exports: number;
}

export function sizeReport(globs: string[], root = ""): FileSize[] {
  const project = buildProject(globs);
  const out: FileSize[] = [];
  for (const f of project.getSourceFiles()) {
    const p = f.getFilePath();
    const file = p.startsWith(root) ? p.slice(root.length).replace(/^\/+/, "") : p;
    out.push({
      file,
      loc: f.getEndLineNumber(),
      exports: f.getExportedDeclarations().size,
    });
  }
  return out.sort((a, b) => b.loc - a.loc);
}
