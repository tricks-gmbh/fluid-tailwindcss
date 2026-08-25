import { describe, it, expect } from "vitest";
import {
  CssExpressionError,
  evaluateCssExpression,
  isViewportDependent,
  parseCssExpression,
} from "../demo/src/lib/css-expression";
import { extractDeclarations } from "../demo/server/css-declarations";

function at(value: string, viewport: number, rootFontSize = 16): number {
  return evaluateCssExpression(parseCssExpression(value), { viewport, rootFontSize });
}

describe("demo CSS expression evaluator", () => {
  it("resolves absolute and relative units to pixels", () => {
    expect(at("16px", 1000)).toBe(16);
    expect(at("2rem", 1000)).toBe(32);
    expect(at("10vw", 1000)).toBe(100);
    expect(at("10cqw", 800)).toBe(80);
    expect(at("0", 1000)).toBe(0);
  });

  it("evaluates the interpolation clamp the plugin emits", () => {
    const value = "clamp(1rem, 0.6479rem + 1.5023vw, 2rem)";

    // Below the min viewport the lower bound holds.
    expect(at(value, 320)).toBeCloseTo(16, 4);
    // At the min viewport the preferred value reaches the min value.
    expect(at(value, 375)).toBeCloseTo(16, 1);
    // At the max viewport it reaches the max value and stops.
    expect(at(value, 1440)).toBeCloseTo(32, 1);
    expect(at(value, 3840)).toBeCloseTo(32, 4);
  });

  it("evaluates negated clamps", () => {
    const value = "clamp(-2rem, -1.5023vw - 0.6479rem, -1rem)";

    expect(at(value, 375)).toBeCloseTo(-16, 1);
    expect(at(value, 1440)).toBeCloseTo(-32, 1);
    expect(at(value, 3840)).toBeCloseTo(-32, 4);
  });

  it("evaluates proportional mode min/max output", () => {
    expect(at("max(1rem, 2.2222vw)", 375)).toBeCloseTo(16, 4);
    expect(at("max(1rem, 2.2222vw)", 1440)).toBeCloseTo(32, 1);
    expect(at("min(-1rem, -2.2222vw)", 1440)).toBeCloseTo(-32, 1);
  });

  it("honours the CSS rule that clamp min wins over max", () => {
    expect(at("clamp(3rem, 0px, 1rem)", 1000)).toBe(48);
  });

  it("treats calc() as grouping and supports nesting", () => {
    expect(at("calc(clamp(1rem, 100vw, 2rem) * -1)", 1000)).toBe(-32);
    expect(at("calc(2rem + 2 * 4px)", 1000)).toBe(40);
    expect(at("calc((1rem + 1rem) / 2)", 1000)).toBe(16);
  });

  it("falls back to the var() default value", () => {
    expect(at("calc(var(--spacing, 0.25rem) * 4)", 1000)).toBe(16);
  });

  it("rejects values that cannot be turned into a number", () => {
    expect(() => at("var(--tw-translate-x)", 1000)).toThrow(CssExpressionError);
    expect(() => at("var(--tw-translate-x, 0) var(--tw-translate-y, 0)", 1000)).toThrow(
      CssExpressionError,
    );
    expect(() => at("auto", 1000)).toThrow(CssExpressionError);
    expect(() => at("50%", 1000)).toThrow(CssExpressionError);
    expect(() => at("2sponge", 1000)).toThrow(CssExpressionError);
  });

  it("detects whether a value depends on the viewport", () => {
    expect(isViewportDependent(parseCssExpression("clamp(1rem, 1.5vw, 2rem)"))).toBe(true);
    expect(isViewportDependent(parseCssExpression("1rem"))).toBe(false);
  });
});

describe("demo CSS declaration extraction", () => {
  it("reads declarations from a flat rule", () => {
    const declarations = extractDeclarations(`.fl-p-4\\/8 {
      padding: clamp(1rem, 0.6479rem + 1.5023vw, 2rem);
    }`);

    expect(declarations).toEqual([
      {
        property: "padding",
        value: "clamp(1rem, 0.6479rem + 1.5023vw, 2rem)",
        context: [],
      },
    ]);
  });

  it("keeps the nesting context of nested selectors and at-rules", () => {
    const declarations = extractDeclarations(`.md\\:fl-space-x-4\\/8 {
      @media (width >= 48rem) {
        & > :not([hidden]) ~ :not([hidden]) {
          margin-left: clamp(1rem, 1.5vw, 2rem);
        }
      }
    }`);

    expect(declarations).toHaveLength(1);
    expect(declarations[0].context).toEqual([
      "@media (width >= 48rem)",
      "& > :not([hidden]) ~ :not([hidden])",
    ]);
  });

  it("reads every declaration of a multi-property rule", () => {
    const declarations = extractDeclarations(`.fl-text-base\\/2xl {
      font-size: clamp(1rem, 1vw, 1.5rem);
      line-height: clamp(1.5rem, 1vw, 2rem);
    }`);

    expect(declarations.map((declaration) => declaration.property)).toEqual([
      "font-size",
      "line-height",
    ]);
  });

  it("ignores comments", () => {
    const declarations = extractDeclarations(`.fl-p-4 { /* fluid */ padding: 1rem; }`);
    expect(declarations).toEqual([{ property: "padding", value: "1rem", context: [] }]);
  });
});
