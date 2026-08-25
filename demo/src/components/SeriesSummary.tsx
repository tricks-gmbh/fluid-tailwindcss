import type { PlaygroundOptions } from "../../shared/types";
import { MAX_PLOT_VIEWPORT } from "../lib/defaults";
import { formatPx } from "../lib/format";
import { valueAt, type PlotSeries } from "../lib/series";

interface SeriesSummaryProps {
  series: PlotSeries[];
  options: PlaygroundOptions;
}

/** Viewport widths worth reading off exactly, deduplicated and ordered. */
function checkpointViewports(options: PlaygroundOptions): number[] {
  const candidates = [
    options.minViewport,
    options.minLayoutViewport,
    options.maxLayoutViewport,
    options.maxViewport,
    MAX_PLOT_VIEWPORT,
  ];

  return [...new Set(candidates.filter((value): value is number => value != null && value >= 0))].sort(
    (a, b) => a - b,
  );
}

export function SeriesSummary({ series, options }: SeriesSummaryProps) {
  if (series.length === 0) return null;

  const viewports = checkpointViewports(options);

  return (
    <div className="panel overflow-x-auto p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Computed value at key viewports</h2>
      <table className="w-full min-w-md border-collapse text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="pb-2 text-left font-medium">property</th>
            {viewports.map((viewport) => (
              <th key={viewport} className="pb-2 text-right font-medium tabular-nums">
                {viewport} px
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((entry, index) => (
            <tr key={`${entry.property}-${index}`} className="border-t border-slate-800">
              <td className="py-2 pr-4">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="font-mono text-slate-300">{entry.property}</span>
                  {!entry.fluid && (
                    <span className="rounded border border-slate-700 px-1 text-[10px] text-slate-500">
                      static
                    </span>
                  )}
                </span>
              </td>
              {viewports.map((viewport) => (
                <td key={viewport} className="py-2 text-right text-slate-200 tabular-nums">
                  {formatPx(valueAt(entry, viewport))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {series.some((entry) => entry.value.includes("em") && !entry.value.includes("rem")) && (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          This value uses <code>em</code>, which resolves against the element font size. The graph
          approximates it with the root font size, matching the plugin's own math.
        </p>
      )}
    </div>
  );
}
