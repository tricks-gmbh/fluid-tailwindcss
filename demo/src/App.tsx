import { useMemo, useState } from "react";
import type { PlaygroundOptions } from "../shared/types";
import { ClassField } from "./components/ClassField";
import { CssOutput } from "./components/CssOutput";
import { FluidChart, type ChartGuide } from "./components/FluidChart";
import { OptionsPanel } from "./components/OptionsPanel";
import { SeriesSummary } from "./components/SeriesSummary";
import { useCompiledClass } from "./hooks/use-compiled-class";
import { DEFAULT_OPTIONS, MAX_PLOT_VIEWPORT } from "./lib/defaults";
import { buildSeries } from "./lib/series";

/** Guides for the viewport options, skipping the ones the mode ignores. */
function buildGuides(options: PlaygroundOptions): ChartGuide[] {
  const ignoredByMode = options.mode === "proportional";

  return (
    [
      { label: "minViewport", viewport: options.minViewport, muted: ignoredByMode },
      { label: "minLayout", viewport: options.minLayoutViewport, muted: ignoredByMode },
      { label: "maxLayout", viewport: options.maxLayoutViewport, muted: false },
      { label: "maxViewport", viewport: options.maxViewport, muted: false },
    ] satisfies { label: string; viewport: number | null; muted: boolean }[]
  ).filter(
    (guide): guide is ChartGuide =>
      guide.viewport != null && guide.viewport > 0 && guide.viewport <= MAX_PLOT_VIEWPORT,
  );
}

export function App() {
  const [className, setClassName] = useState("fl-text-base/2xl");
  const [options, setOptions] = useState<PlaygroundOptions>(DEFAULT_OPTIONS);

  const { result, isCompiling, transportError } = useCompiledClass(className, options);

  const { series, skipped } = useMemo(
    () => buildSeries(result?.declarations ?? []),
    [result],
  );
  const guides = useMemo(() => buildGuides(options), [options]);

  const emptyMessage =
    result == null
      ? "Waiting for a class to compile"
      : result.status === "unknown"
        ? "This class produces no CSS, so there is nothing to plot"
        : "No numeric value in this rule to plot";

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="font-mono text-base font-semibold text-slate-100">fluid-tailwindcss</h1>
          <span className="text-sm text-slate-400">playground</span>
          <p className="ml-auto text-xs text-slate-500">
            Classes are compiled by the real plugin from <code>src/</code>
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4 lg:order-1">
          <OptionsPanel options={options} onChange={setOptions} />
        </div>

        <div className="space-y-4 lg:order-2">
          <ClassField
            value={className}
            onChange={setClassName}
            result={result}
            isCompiling={isCompiling}
            transportError={transportError}
          />

          <div className="panel p-4">
            <FluidChart
              series={series}
              guides={guides}
              maxViewport={MAX_PLOT_VIEWPORT}
              emptyMessage={emptyMessage}
            />
          </div>

          <SeriesSummary series={series} options={options} />
          <CssOutput result={result} skipped={skipped} />
        </div>
      </main>
    </div>
  );
}
