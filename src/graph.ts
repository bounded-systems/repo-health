// graph.ts — the import graph, built with the TypeScript compiler (ts-morph) so
// edges are REAL import/export declarations, not text matches. This is the whole
// point: a JSDoc `@example import { x } from "y"` in a comment is not an edge, so
// it can't produce a phantom cycle (the failure mode that fooled the grep/skott
// prototypes on metabase_refs.ts / card_meta.ts / changeset.ts).
import { Project, type SourceFile, ts } from "ts-morph";

export interface Cycle {
  chain: string[]; // relative file paths, cycle-closing node repeated at the end
}

/** Build a ts-morph project over the given globs, using bundler resolution so
 * extensionless relative imports (`../lib/foo`) resolve to `foo.ts`. */
export function buildProject(globs: string[]): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
      allowJs: true,
      noEmit: true,
    },
  });
  // One call so negation globs (`!pattern`, used to exclude generated/vendored
  // files) apply against the positive patterns rather than being no-ops.
  project.addSourceFilesAtPaths(globs);
  return project;
}

function rel(root: string, p: string): string {
  return p.startsWith(root) ? p.slice(root.length).replace(/^\/+/, "") : p;
}

/** Real intra-project edges from a source file: import + `export ... from`. */
function edgesOf(f: SourceFile): SourceFile[] {
  const out: SourceFile[] = [];
  for (const imp of f.getImportDeclarations()) {
    const t = imp.getModuleSpecifierSourceFile();
    if (t) out.push(t);
  }
  for (const exp of f.getExportDeclarations()) {
    const t = exp.getModuleSpecifierSourceFile();
    if (t) out.push(t);
  }
  return out;
}

/** All distinct import cycles among the files matched by `globs`. */
export function detectCycles(globs: string[], root = ""): Cycle[] {
  const project = buildProject(globs);
  const files = project.getSourceFiles();
  const inProject = new Set(files.map((f) => f.getFilePath()));

  const adj = new Map<string, string[]>();
  for (const f of files) {
    adj.set(
      f.getFilePath(),
      edgesOf(f).map((t) => t.getFilePath()).filter((p) => inProject.has(p)),
    );
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];
  const cycles: Cycle[] = [];
  const seen = new Set<string>();

  const dfs = (u: string) => {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) {
        const i = stack.indexOf(v);
        const nodes = stack.slice(i);
        const key = [...nodes].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push({ chain: [...nodes, v].map((p) => rel(root, p)) });
        }
      } else if (c === WHITE) {
        dfs(v);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  };

  for (const f of files) {
    if ((color.get(f.getFilePath()) ?? WHITE) === WHITE) dfs(f.getFilePath());
  }
  return cycles;
}

/** Reverse-dependency fan-in: how many project files import each file (hubs). */
export function importHubs(globs: string[], root = ""): { file: string; importedBy: number }[] {
  const project = buildProject(globs);
  const files = project.getSourceFiles();
  const inProject = new Set(files.map((f) => f.getFilePath()));
  const fanIn = new Map<string, number>();
  for (const f of files) fanIn.set(f.getFilePath(), 0);
  for (const f of files) {
    for (const t of edgesOf(f)) {
      const p = t.getFilePath();
      if (inProject.has(p)) fanIn.set(p, (fanIn.get(p) ?? 0) + 1);
    }
  }
  return [...fanIn.entries()]
    .map(([p, n]) => ({ file: rel(root, p), importedBy: n }))
    .sort((a, b) => b.importedBy - a.importedBy);
}
