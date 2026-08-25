import type { CssDeclaration } from "../../shared/types";
import {
  evaluateCssExpression,
  isViewportDependent,
  parseCssExpression,
  type ExpressionNode,
} from "./css-expression";
import { ROOT_FONT_SIZE } from "./defaults";

/** A declaration that can be drawn as a line. */
export interface PlotSeries {
  property: string;
  value: string;
  context: string[];
  node: ExpressionNode;
  /** False for static values, which show up as a flat line. */
  fluid: boolean;
  color: string;
}

/** A declaration that exists but has no numeric value to plot. */
export interface SkippedSeries {
  property: string;
  value: string;
  reason: string;
}

export interface SeriesBuildResult {
  series: PlotSeries[];
  skipped: SkippedSeries[];
}

const SERIES_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#f472b6", "#a78bfa"];

export function buildSeries(declarations: CssDeclaration[]): SeriesBuildResult {
  const series: PlotSeries[] = [];
  const skipped: SkippedSeries[] = [];

  for (const declaration of declarations) {
    try {
      const node = parseCssExpression(declaration.value);
      series.push({
        property: declaration.property,
        value: declaration.value,
        context: declaration.context,
        node,
        fluid: isViewportDependent(node),
        color: SERIES_COLORS[series.length % SERIES_COLORS.length],
      });
    } catch (error) {
      skipped.push({
        property: declaration.property,
        value: declaration.value,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { series, skipped };
}

/** Computed pixel value of a series at one viewport width. */
export function valueAt(series: PlotSeries, viewport: number): number {
  return evaluateCssExpression(series.node, { viewport, rootFontSize: ROOT_FONT_SIZE });
}

/**
 * Samples a series across the plotted viewport range.
 * The sample step is a couple of pixels, which keeps the `clamp()` corners sharp
 * while staying far cheaper than one sample per rendered pixel.
 */
export function sampleSeries(
  series: PlotSeries,
  maxViewport: number,
  step = 2,
): { viewport: number; value: number }[] {
  const samples: { viewport: number; value: number }[] = [];

  for (let viewport = 0; viewport <= maxViewport; viewport += step) {
    samples.push({ viewport, value: valueAt(series, viewport) });
  }

  if (samples[samples.length - 1]?.viewport !== maxViewport) {
    samples.push({ viewport: maxViewport, value: valueAt(series, maxViewport) });
  }

  return samples;
}
