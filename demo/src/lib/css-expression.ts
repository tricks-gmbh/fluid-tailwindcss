/**
 * A tiny evaluator for the CSS math expressions the plugin emits.
 *
 * Values are parsed once into a tree and then evaluated for many viewport
 * widths, which is what makes the graph cheap to redraw. Everything resolves to
 * pixels: relative units are converted using the evaluation context, so `*` and
 * `/` are plain arithmetic and no unit algebra is needed.
 */

export interface EvalContext {
  /** Viewport width in pixels; drives `vw` and container units. */
  viewport: number;
  rootFontSize: number;
}

export type ExpressionNode =
  | { kind: "literal"; value: number }
  | { kind: "unit"; value: number; unit: RelativeUnit }
  | { kind: "binary"; operator: "+" | "-" | "*" | "/"; left: ExpressionNode; right: ExpressionNode }
  | { kind: "negate"; operand: ExpressionNode }
  | { kind: "call"; name: FunctionName; args: ExpressionNode[] };

type RelativeUnit = "rem" | "em" | "vw" | "cq";
type FunctionName = "clamp" | "min" | "max" | "abs";

/** Units that convert to pixels without knowing the viewport. */
const absoluteUnits: Record<string, number> = {
  px: 1,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  Q: 96 / 2.54 / 40,
};

/**
 * Units resolved at evaluation time. Container units are treated as viewport
 * units because the playground has no container to measure. `em` follows the
 * plugin's own simplification of treating it like `rem`.
 */
const relativeUnits: Record<string, RelativeUnit> = {
  rem: "rem",
  em: "em",
  vw: "vw",
  vi: "vw",
  cqw: "cq",
  cqi: "cq",
};

const functionNames = new Set<FunctionName>(["clamp", "min", "max", "abs"]);

export class CssExpressionError extends Error {}

type Token =
  | { type: "number"; value: number; unit: string }
  | { type: "function"; name: string }
  | { type: "ident"; name: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

const numberPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const identifierPattern = /^-{0,2}[a-zA-Z_][a-zA-Z0-9_-]*/;

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let rest = input.trim();

  const expectsOperand = () => {
    const previous = tokens[tokens.length - 1];
    if (!previous) return true;
    if (previous.type === "number" || previous.type === "ident") return false;
    if (previous.type === "paren") return previous.value === "(";
    return true;
  };

  while (rest.length > 0) {
    if (/^\s/.test(rest)) {
      rest = rest.trimStart();
      continue;
    }

    // A leading sign only belongs to the number when an operand is expected;
    // otherwise `1rem + 2px` would tokenize `+ 2px` as a single number.
    const numberMatch = rest.match(numberPattern);
    if (numberMatch && (expectsOperand() || !/^[+-]/.test(numberMatch[0]))) {
      rest = rest.slice(numberMatch[0].length);
      const unitMatch = rest.match(identifierPattern);
      let unit = "";
      if (unitMatch) {
        unit = unitMatch[0];
        rest = rest.slice(unit.length);
      } else if (rest.startsWith("%")) {
        unit = "%";
        rest = rest.slice(1);
      }
      tokens.push({ type: "number", value: Number(numberMatch[0]), unit });
      continue;
    }

    const identifierMatch = rest.match(identifierPattern);
    if (identifierMatch) {
      rest = rest.slice(identifierMatch[0].length);
      if (rest.startsWith("(")) {
        rest = rest.slice(1);
        tokens.push({ type: "function", name: identifierMatch[0].toLowerCase() });
      } else {
        tokens.push({ type: "ident", name: identifierMatch[0] });
      }
      continue;
    }

    const char = rest[0];
    rest = rest.slice(1);

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      continue;
    }

    throw new CssExpressionError(`of the unexpected character "${char}"`);
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const node = this.parseSum();
    if (this.index < this.tokens.length) {
      throw new CssExpressionError("the value is not a single numeric expression");
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private parseSum(): ExpressionNode {
    let left = this.parseProduct();

    for (;;) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
        return left;
      }
      this.index++;
      left = { kind: "binary", operator: token.value, left, right: this.parseProduct() };
    }
  }

  private parseProduct(): ExpressionNode {
    let left = this.parseUnary();

    for (;;) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
        return left;
      }
      this.index++;
      left = { kind: "binary", operator: token.value, left, right: this.parseUnary() };
    }
  }

  private parseUnary(): ExpressionNode {
    const token = this.peek();
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      this.index++;
      const operand = this.parseUnary();
      return token.value === "-" ? { kind: "negate", operand } : operand;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();
    if (!token) throw new CssExpressionError("the expression ends unexpectedly");
    this.index++;

    if (token.type === "number") {
      return this.toValueNode(token);
    }

    if (token.type === "paren" && token.value === "(") {
      const node = this.parseSum();
      this.expectClosingParen();
      return node;
    }

    if (token.type === "function") {
      return this.parseCall(token.name);
    }

    if (token.type === "ident") {
      throw new CssExpressionError(`the keyword "${token.name}" is not a number`);
    }

    throw new CssExpressionError("a value is missing");
  }

  private toValueNode(token: Extract<Token, { type: "number" }>): ExpressionNode {
    if (!token.unit) {
      return { kind: "literal", value: token.value };
    }

    const relative = relativeUnits[token.unit];
    if (relative) {
      return { kind: "unit", value: token.value, unit: relative };
    }

    const factor = absoluteUnits[token.unit];
    if (factor != null) {
      return { kind: "literal", value: token.value * factor };
    }

    throw new CssExpressionError(`the unit "${token.unit}" is not supported`);
  }

  private parseCall(name: string): ExpressionNode {
    // `calc()` and the nested parens of `var()` fallbacks are just grouping.
    if (name === "calc") {
      const node = this.parseSum();
      this.expectClosingParen();
      return node;
    }

    if (name === "var") {
      return this.parseVar();
    }

    if (!functionNames.has(name as FunctionName)) {
      throw new CssExpressionError(`the function ${name}() is not supported`);
    }

    const args = this.parseArguments();
    if (name === "clamp" && args.length !== 3) {
      throw new CssExpressionError("clamp() needs three arguments");
    }
    if (args.length === 0) {
      throw new CssExpressionError(`${name}() needs at least one argument`);
    }

    return { kind: "call", name: name as FunctionName, args };
  }

  /**
   * Custom properties cannot be resolved here, so only the fallback is usable.
   * That still covers Tailwind's own `var(--spacing, 0.25rem)` style output.
   */
  private parseVar(): ExpressionNode {
    const name = this.peek();
    if (name?.type !== "ident") {
      throw new CssExpressionError("var() is missing a custom property name");
    }
    this.index++;

    if (this.peek()?.type !== "comma") {
      throw new CssExpressionError(`var(${name.name}) has no fallback to evaluate`);
    }
    this.index++;

    const fallback = this.parseSum();
    this.expectClosingParen();
    return fallback;
  }

  private parseArguments(): ExpressionNode[] {
    const args: ExpressionNode[] = [];

    for (;;) {
      args.push(this.parseSum());
      const token = this.peek();
      if (token?.type === "comma") {
        this.index++;
        continue;
      }
      this.expectClosingParen();
      return args;
    }
  }

  private isClosingParen(): boolean {
    const token = this.peek();
    return token?.type === "paren" && token.value === ")";
  }

  private expectClosingParen(): void {
    if (!this.isClosingParen()) {
      throw new CssExpressionError("a closing parenthesis is missing");
    }
    this.index++;
  }
}

/**
 * Parses a CSS value into an evaluable tree.
 * Throws `CssExpressionError` for anything that cannot be turned into a number.
 */
export function parseCssExpression(value: string): ExpressionNode {
  return new Parser(tokenize(value)).parse();
}

/** Evaluates a parsed expression to a pixel value. */
export function evaluateCssExpression(node: ExpressionNode, context: EvalContext): number {
  switch (node.kind) {
    case "literal":
      return node.value;

    case "unit":
      return node.value * unitScale(node.unit, context);

    case "negate":
      return -evaluateCssExpression(node.operand, context);

    case "binary": {
      const left = evaluateCssExpression(node.left, context);
      const right = evaluateCssExpression(node.right, context);
      switch (node.operator) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return left / right;
      }
    }

    case "call": {
      const args = node.args.map((arg) => evaluateCssExpression(arg, context));
      switch (node.name) {
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
        case "abs":
          return Math.abs(args[0]);
        case "clamp":
          // Per spec clamp(MIN, VAL, MAX) is max(MIN, min(VAL, MAX)),
          // so MIN wins when the bounds are inverted.
          return Math.max(args[0], Math.min(args[1], args[2]));
      }
    }
  }
}

function unitScale(unit: RelativeUnit, context: EvalContext): number {
  switch (unit) {
    case "rem":
    case "em":
      return context.rootFontSize;
    case "vw":
    case "cq":
      return context.viewport / 100;
  }
}

/** True when the value contains a unit that only makes sense at some viewport width. */
export function isViewportDependent(node: ExpressionNode): boolean {
  switch (node.kind) {
    case "literal":
      return false;
    case "unit":
      return node.unit === "vw" || node.unit === "cq";
    case "negate":
      return isViewportDependent(node.operand);
    case "binary":
      return isViewportDependent(node.left) || isViewportDependent(node.right);
    case "call":
      return node.args.some(isViewportDependent);
  }
}
