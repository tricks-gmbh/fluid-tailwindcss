/**
 * Types shared between the compile server (Node) and the browser app.
 */

export type FluidMode = "interpolation" | "proportional";

/**
 * Plugin options the playground exposes. `null` means "leave at the plugin
 * default", which matters for the layout viewports: extrapolation only kicks in
 * when both of them are set.
 */
export interface PlaygroundOptions {
  minViewport: number | null;
  maxViewport: number | null;
  minLayoutViewport: number | null;
  maxLayoutViewport: number | null;
  mode: FluidMode;
}

export interface CompileRequest {
  className: string;
  options: PlaygroundOptions;
}

export interface CssDeclaration {
  property: string;
  value: string;
  /** Enclosing at-rules / nested selectors, outermost first, class rule excluded. */
  context: string[];
}

export type CompileStatus =
  /** The class produced a rule that only exists because of the plugin. */
  | "fluid"
  /** Valid Tailwind class, but it is not one of the plugin's utilities. */
  | "tailwind-only"
  /** Tailwind produced no rule at all for this class. */
  | "unknown"
  /** The compiler itself failed. */
  | "error";

export interface CompileResult {
  className: string;
  status: CompileStatus;
  /** CSS emitted for the class, plugin enabled. */
  css: string;
  declarations: CssDeclaration[];
  /** `console.warn` output the plugin produced while handling this class. */
  warnings: string[];
  error: string | null;
}
