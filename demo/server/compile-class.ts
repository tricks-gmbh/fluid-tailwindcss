import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { compile } from "tailwindcss";
import { extractDeclarations } from "./css-declarations";
import type { CompileRequest, CompileResult, PlaygroundOptions } from "../shared/types";

const require = createRequire(import.meta.url);

/**
 * Loads a JS/TS module by absolute path. The Vite dev server passes
 * `ssrLoadModule` here so the plugin is read straight from `src/*.ts` and picks
 * up edits without a build step.
 */
export type ModuleLoader = (absolutePath: string) => Promise<Record<string, unknown>>;

export interface CompileContext {
  /** Repository root; the plugin entry is resolved relative to it. */
  repoRoot: string;
  loadModule: ModuleLoader;
}

/**
 * Renders the playground options as an `@plugin` block. Uses the lowercase
 * aliases because that is the form CSS `@plugin` blocks deliver.
 */
function formatPluginOptions(options: PlaygroundOptions): string {
  const declarations: string[] = [];

  const add = (name: string, value: number | null) => {
    if (value != null && Number.isFinite(value)) {
      declarations.push(`${name}: ${value}`);
    }
  };

  add("minviewport", options.minViewport);
  add("maxviewport", options.maxViewport);
  add("minlayoutviewport", options.minLayoutViewport);
  add("maxlayoutviewport", options.maxLayoutViewport);
  declarations.push(`mode: ${options.mode}`);

  return declarations.map((declaration) => `${declaration};`).join(" ");
}

/**
 * Only the theme (as a reference, so it is not emitted) plus the utilities
 * layer, which keeps the output small enough to read and parse.
 */
function buildInputCss(pluginEntry: string | null, options: PlaygroundOptions): string {
  const lines = [`@import "tailwindcss/theme.css" theme(reference);`, `@tailwind utilities;`];

  if (pluginEntry) {
    lines.push(`@plugin "${pluginEntry}" { ${formatPluginOptions(options)} };`);
  }

  return lines.join("\n");
}

function createCompileOptions(context: CompileContext) {
  return {
    base: context.repoRoot,
    loadModule: async (id: string, base: string) => {
      const resolved = path.resolve(base, id);
      const module = await context.loadModule(resolved);
      return {
        path: resolved,
        base: path.dirname(resolved),
        module: (module.default ?? module) as never,
      };
    },
    loadStylesheet: async (id: string, base: string) => {
      const target = id === "tailwindcss" ? "tailwindcss/index.css" : id;
      const resolved = target.startsWith("tailwindcss/")
        ? require.resolve(target)
        : path.resolve(base, target);

      return {
        path: resolved,
        base: path.dirname(resolved),
        content: fs.readFileSync(resolved, "utf-8"),
      };
    },
  };
}

/** Everything Tailwind emits unconditionally, so an empty result is detectable. */
function stripBanner(css: string): string {
  return css.replace(/\/\*![\s\S]*?\*\//g, "").trim();
}

/**
 * Runs `console.warn` capture around a build so plugin diagnostics (unit
 * mismatches, accessibility hints) can be surfaced in the UI.
 */
async function withCapturedWarnings<T>(
  run: () => Promise<T>,
): Promise<{ value: T; warnings: string[] }> {
  const warnings: string[] = [];
  const original = console.warn;

  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    return { value: await run(), warnings };
  } finally {
    console.warn = original;
  }
}

async function buildCss(
  context: CompileContext,
  className: string,
  options: PlaygroundOptions,
  pluginEntry: string | null,
): Promise<string> {
  const compiler = await compile(buildInputCss(pluginEntry, options), createCompileOptions(context));
  return stripBanner(compiler.build([className]));
}

/**
 * Compiles a single class candidate twice: with the plugin registered and
 * without it. Comparing both tells the difference between "the plugin handles
 * this class", "plain Tailwind handles it" and "nothing handles it".
 */
export async function compileClass(
  request: CompileRequest,
  context: CompileContext,
): Promise<CompileResult> {
  const className = request.className.trim();
  const empty: CompileResult = {
    className,
    status: "unknown",
    css: "",
    declarations: [],
    warnings: [],
    error: null,
  };

  if (!className) return empty;

  const pluginEntry = path.resolve(context.repoRoot, "src/index.ts");

  try {
    const { value: css, warnings } = await withCapturedWarnings(() =>
      buildCss(context, className, request.options, pluginEntry),
    );

    if (!css) {
      return { ...empty, warnings };
    }

    const withoutPlugin = await buildCss(context, className, request.options, null);

    return {
      className,
      status: withoutPlugin ? "tailwind-only" : "fluid",
      css,
      declarations: extractDeclarations(css),
      warnings,
      error: null,
    };
  } catch (error) {
    return {
      ...empty,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
