# fluid-tailwindcss playground

An interactive tool for inspecting what the plugin does with a single Tailwind class:
it validates the class, shows the generated CSS, and plots the resulting value
across viewport widths from 0 to 3840 px.

## Running it

From the repository root:

```bash
pnpm install
pnpm demo
```

The app opens on <http://localhost:5175>.

## What it does

1. **Validation.** The class is compiled by real Tailwind CSS with the plugin loaded
   straight from `../src/index.ts`, so validity is not guessed from a pattern: it is
   whatever Tailwind actually emits. Each class is compiled twice, with and without the
   plugin, which separates three outcomes:
   - _Handled by the plugin_ — only the plugin produces a rule for it.
   - _Valid Tailwind class, not a fluid utility_ — plain Tailwind already handles it.
   - _Not processable_ — Tailwind emits no rule at all.
2. **Options.** `minViewport`, `maxViewport`, `minLayoutViewport`, `maxLayoutViewport`
   and `mode` are passed to the plugin as an `@plugin` option block. Clearing a viewport
   field leaves that option unset, which matters for the layout viewports: the plugin
   only extrapolates when both of them are set.
3. **Graph.** Every declaration in the generated rule is parsed into an expression tree
   and evaluated per viewport width, so the curve reflects the emitted `clamp()`,
   `min()` or `max()` rather than a re-implementation of the plugin's math.

## Architecture

| Path                                     | Purpose                                                    |
| ---------------------------------------- | ---------------------------------------------------------- |
| `server/vite-plugin-fluid-compile.ts`    | Dev-server endpoint `POST /api/compile`.                    |
| `server/compile-class.ts`                | Runs Tailwind's `compile()` with and without the plugin.     |
| `server/css-declarations.ts`             | Flattens the emitted CSS into declarations.                  |
| `shared/types.ts`                        | Types shared by server and browser.                          |
| `src/lib/css-expression.ts`              | Parser and evaluator for CSS math expressions.               |
| `src/lib/series.ts`                      | Turns declarations into plottable series.                    |
| `src/components/FluidChart.tsx`          | The SVG graph.                                               |

Compiling needs Node, so the playground only works under `vite` (dev), not as a static
build.

## Notes

- `tailwindcss` is pinned to the exact version the repository root dev-depends on, so the
  playground compiles against the same Tailwind (and the same theme defaults) as the test
  suite. Bump both together.
- Container query units (`cqw`, `cqi`) are plotted as if the container matched the
  viewport, and `em` is resolved against the root font size — the same simplification the
  plugin's own math makes.
- The evaluator is covered by `tests/demo-css-expression.test.ts` in the root test suite.
