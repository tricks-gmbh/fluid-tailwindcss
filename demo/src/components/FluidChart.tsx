import { useEffect, useMemo, useRef, useState } from "react";
import { sampleSeries, valueAt, type PlotSeries } from "../lib/series";
import { formatPx, formatRem } from "../lib/format";

export interface ChartGuide {
  label: string;
  viewport: number;
  /** Guides the current mode ignores are drawn faintly. */
  muted: boolean;
}

interface FluidChartProps {
  series: PlotSeries[];
  guides: ChartGuide[];
  maxViewport: number;
  emptyMessage: string;
}

const HEIGHT = 452;
const MARGIN = { top: 40, right: 24, bottom: 46, left: 66 };
const X_TICK_STEP = 480;

interface LaidOutGuide extends ChartGuide {
  /** Labels are stacked in two rows so neighbouring guides stay readable. */
  row: 0 | 1;
}

/**
 * Merges guides that sit on the same viewport width and pushes labels that
 * would otherwise overlap into a second row.
 */
function layOutGuides(guides: ChartGuide[], xToPixel: (viewport: number) => number): LaidOutGuide[] {
  const merged: ChartGuide[] = [];

  for (const guide of [...guides].sort((a, b) => a.viewport - b.viewport)) {
    const previous = merged[merged.length - 1];
    if (previous && previous.viewport === guide.viewport) {
      previous.label += ` · ${guide.label}`;
      previous.muted = previous.muted && guide.muted;
      continue;
    }
    merged.push({ ...guide });
  }

  const rowEnds: [number, number] = [-Infinity, -Infinity];

  return merged.map((guide) => {
    const x = xToPixel(guide.viewport);
    const row: 0 | 1 = x >= rowEnds[0] ? 0 : 1;
    // Rough advance width for the 10px label font.
    rowEnds[row] = x + guide.label.length * 5.6 + 12;
    return { ...guide, row };
  });
}

function useElementWidth(ref: React.RefObject<HTMLDivElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

/** Axis bounds rounded to human-friendly steps of 1, 2 or 5 times a power of ten. */
function niceScale(min: number, max: number, targetTicks = 6) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { ticks: [0, 1], min: 0, max: 1 };
  }
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const rawStep = (max - min) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    // Guard against accumulated float error in the tick labels.
    ticks.push(Math.round(value * 1e6) / 1e6);
  }

  return { ticks, min: niceMin, max: niceMax };
}

export function FluidChart({ series, guides, maxViewport, emptyMessage }: FluidChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrapperRef, 900);
  const [hoverViewport, setHoverViewport] = useState<number | null>(null);

  const plotWidth = Math.max(120, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const samples = useMemo(
    () => series.map((entry) => sampleSeries(entry, maxViewport)),
    [series, maxViewport],
  );

  const yScaleInfo = useMemo(() => {
    // The zero line is always included so the magnitude of a value stays readable.
    let lowest = 0;
    let highest = 0;
    let seen = false;

    for (const entries of samples) {
      for (const sample of entries) {
        if (!Number.isFinite(sample.value)) continue;
        lowest = Math.min(lowest, sample.value);
        highest = Math.max(highest, sample.value);
        seen = true;
      }
    }

    return seen ? niceScale(lowest, highest) : niceScale(0, 32);
  }, [samples]);

  const xToPixel = (viewport: number) => MARGIN.left + (viewport / maxViewport) * plotWidth;
  const yToPixel = (value: number) =>
    MARGIN.top +
    plotHeight -
    ((value - yScaleInfo.min) / (yScaleInfo.max - yScaleInfo.min)) * plotHeight;

  const paths = useMemo(
    () =>
      samples.map((entries) =>
        entries
          .map(
            (sample, index) =>
              `${index === 0 ? "M" : "L"}${xToPixel(sample.viewport).toFixed(2)} ${yToPixel(
                sample.value,
              ).toFixed(2)}`,
          )
          .join(" "),
      ),
    [samples, plotWidth, plotHeight, yScaleInfo, maxViewport],
  );

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let viewport = 0; viewport <= maxViewport; viewport += X_TICK_STEP) {
      ticks.push(viewport);
    }
    return ticks;
  }, [maxViewport]);

  const handlePointer = (event: React.PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    setHoverViewport(Math.round(Math.min(1, Math.max(0, ratio)) * maxViewport));
  };

  const hoverReadouts =
    hoverViewport == null
      ? []
      : series.map((entry) => ({ entry, value: valueAt(entry, hoverViewport) }));

  const tooltipOnLeft =
    hoverViewport != null && xToPixel(hoverViewport) > MARGIN.left + plotWidth * 0.6;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-none select-none overflow-visible"
        role="img"
        aria-label="Computed value per viewport width"
      >
        {/* horizontal grid + y axis labels */}
        {yScaleInfo.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={yToPixel(tick)}
              y2={yToPixel(tick)}
              stroke={tick === 0 ? "#475569" : "#1e293b"}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 12}
              y={yToPixel(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500 text-[11px] tabular-nums"
            >
              {formatPx(tick)}
            </text>
          </g>
        ))}

        {/* vertical grid + x axis labels */}
        {xTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={xToPixel(tick)}
              x2={xToPixel(tick)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <text
              x={xToPixel(tick)}
              y={MARGIN.top + plotHeight + 20}
              textAnchor="middle"
              className="fill-slate-500 text-[11px] tabular-nums"
            >
              {tick}
            </text>
          </g>
        ))}

        {/* option guides */}
        {layOutGuides(guides, xToPixel).map((guide) => (
          <g key={`${guide.label}-${guide.viewport}`} opacity={guide.muted ? 0.4 : 1}>
            <line
              x1={xToPixel(guide.viewport)}
              x2={xToPixel(guide.viewport)}
              y1={MARGIN.top - 4}
              y2={MARGIN.top + plotHeight}
              stroke="#8b5cf6"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={xToPixel(guide.viewport) + 5}
              y={MARGIN.top - 22 + guide.row * 13}
              className="fill-violet-300 text-[10px] font-medium"
            >
              {guide.label}
            </text>
          </g>
        ))}

        {series.map((entry, index) => (
          <path
            key={`${entry.property}-${index}`}
            d={paths[index]}
            fill="none"
            stroke={entry.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeDasharray={entry.fluid ? undefined : "6 4"}
          />
        ))}

        {/* hover crosshair */}
        {hoverViewport != null && series.length > 0 && (
          <g>
            <line
              x1={xToPixel(hoverViewport)}
              x2={xToPixel(hoverViewport)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke="#94a3b8"
              strokeWidth={1}
            />
            {hoverReadouts.map(
              ({ entry, value }, index) =>
                Number.isFinite(value) && (
                  <circle
                    key={`${entry.property}-${index}`}
                    cx={xToPixel(hoverViewport)}
                    cy={yToPixel(value)}
                    r={4}
                    fill={entry.color}
                    stroke="#020617"
                    strokeWidth={2}
                  />
                ),
            )}
          </g>
        )}

        {series.length === 0 && (
          <text
            x={MARGIN.left + plotWidth / 2}
            y={MARGIN.top + plotHeight / 2}
            textAnchor="middle"
            className="fill-slate-500 text-sm"
          >
            {emptyMessage}
          </text>
        )}

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoverViewport(null)}
        />

        <text
          x={MARGIN.left + plotWidth / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          className="fill-slate-500 text-[11px]"
        >
          viewport width (px)
        </text>
        <text
          x={14}
          y={MARGIN.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 14 ${MARGIN.top + plotHeight / 2})`}
          className="fill-slate-500 text-[11px]"
        >
          computed value (px)
        </text>
      </svg>

      {hoverViewport != null && series.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-40 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
          style={{
            left: tooltipOnLeft ? undefined : xToPixel(hoverViewport) + 14,
            right: tooltipOnLeft ? width - xToPixel(hoverViewport) + 14 : undefined,
            top: MARGIN.top + 8,
          }}
        >
          <div className="mb-1.5 font-medium text-slate-300 tabular-nums">
            {hoverViewport} px viewport
          </div>
          <ul className="space-y-1">
            {hoverReadouts.map(({ entry, value }, index) => (
              <li key={`${entry.property}-${index}`} className="flex items-baseline gap-2">
                <span
                  className="mt-0.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-400">{entry.property}</span>
                <span className="ml-auto pl-3 whitespace-nowrap">
                  <span className="font-medium text-slate-100 tabular-nums">
                    {formatPx(value)} px
                  </span>
                  <span className="ml-1.5 text-[10px] text-slate-500 tabular-nums">
                    {formatRem(value)} rem
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
