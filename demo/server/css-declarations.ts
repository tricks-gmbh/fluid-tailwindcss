import type { CssDeclaration } from "../shared/types";

/**
 * Flattens the declarations out of a small CSS snippet.
 *
 * This is not a general CSS parser; it only has to cope with what Tailwind
 * emits for a single utility candidate: one top-level class rule that may nest
 * at-rules (`@media`) or child selectors (`& > :not([hidden]) ~ …`).
 */
export function extractDeclarations(css: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  const stack: string[] = [];
  let buffer = "";
  let parenDepth = 0;

  const flushDeclaration = () => {
    const text = buffer.trim();
    buffer = "";
    if (!text) return;

    const colon = text.indexOf(":");
    if (colon <= 0) return;

    declarations.push({
      property: text.slice(0, colon).trim(),
      value: text.slice(colon + 1).trim(),
      // The outermost entry is the class rule itself, which the caller knows.
      context: stack.slice(1),
    });
  };

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (char === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }

    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

    if (parenDepth === 0) {
      if (char === "{") {
        stack.push(buffer.trim());
        buffer = "";
        continue;
      }
      if (char === "}") {
        flushDeclaration();
        stack.pop();
        continue;
      }
      if (char === ";") {
        flushDeclaration();
        continue;
      }
    }

    buffer += char;
  }

  return declarations;
}
