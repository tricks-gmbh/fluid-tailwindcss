import { useEffect, useState } from "react";
import type { CompileResult, PlaygroundOptions } from "../../shared/types";
import { compileClass } from "../lib/api";

const DEBOUNCE_MS = 180;

export interface CompileState {
  result: CompileResult | null;
  isCompiling: boolean;
  /** Set when the dev-server endpoint could not be reached at all. */
  transportError: string | null;
}

/**
 * Compiles the class whenever it or the options change.
 *
 * The previous result is kept while a new request is in flight so the graph
 * stays put instead of flashing empty on every keystroke.
 */
export function useCompiledClass(className: string, options: PlaygroundOptions): CompileState {
  const [state, setState] = useState<CompileState>({
    result: null,
    isCompiling: className.trim().length > 0,
    transportError: null,
  });

  useEffect(() => {
    const trimmed = className.trim();

    if (!trimmed) {
      setState({ result: null, isCompiling: false, transportError: null });
      return;
    }

    setState((previous) => ({ ...previous, isCompiling: true }));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      compileClass({ className: trimmed, options }, controller.signal)
        .then((result) => {
          setState({ result, isCompiling: false, transportError: null });
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setState({
            result: null,
            isCompiling: false,
            transportError: error instanceof Error ? error.message : String(error),
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [className, options]);

  return state;
}
