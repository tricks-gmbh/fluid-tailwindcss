import type { PlaygroundOptions } from "../../shared/types";

export const DEFAULT_OPTIONS: PlaygroundOptions = {
  minViewport: 375,
  maxViewport: 1920,
  minLayoutViewport: 375,
  maxLayoutViewport: 1440,
  mode: "interpolation",
};

/** Widest viewport plotted on the x axis. */
export const MAX_PLOT_VIEWPORT = 3840;

/** Matches the plugin's `rootFontSize` default, used to convert rem to px. */
export const ROOT_FONT_SIZE = 16;

export const EXAMPLE_CLASSES = [
  "fl-text-base/2xl",
  "fl-p-4/8",
  "fl-text-4xl/7xl",
  "fl-gap-2/10",
  "fl-mt-4.5/10",
  "neg-fl-mt-4/8",
  "fl-p-[12px/48px]",
  "fl-p-4/8--md-lg",
  "fl-rounded-lg/2xl",
  "fl-p-4",
];
