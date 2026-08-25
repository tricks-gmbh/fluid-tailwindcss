import type { CompileRequest, CompileResult } from "../../shared/types";

const COMPILE_ENDPOINT = "/api/compile";

/**
 * Asks the dev server to compile a single class with the given plugin options.
 */
export async function compileClass(
  request: CompileRequest,
  signal: AbortSignal,
): Promise<CompileResult> {
  const response = await fetch(COMPILE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Compile request failed (${response.status}): ${details}`);
  }

  return (await response.json()) as CompileResult;
}
