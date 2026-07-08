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
    // Count only exports DECLARED in this file. A name whose declaration lives
    // elsewhere (an `export … from` re-export / barrel facade) does not make THIS
    // file a god-file, so it is excluded — otherwise a thin facade re-exporting
    // focused modules reads as a false god.
    let ownExports = 0;
    for (const [, decls] of f.getExportedDeclarations()) {
      if (decls.some((d) => d.getSourceFile() === f)) ownExports++;
    }
    out.push({ file, loc: f.getEndLineNumber(), exports: ownExports });
  }
  return out.sort((a, b) => b.loc - a.loc);
}
