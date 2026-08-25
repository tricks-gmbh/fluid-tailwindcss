import { ROOT_FONT_SIZE } from "./defaults";

/** Trims trailing zeros so axis labels and readouts stay compact. */
function trim(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "–";
  return String(Number(value.toFixed(decimals)));
}

export function formatPx(value: number): string {
  return trim(value, 2);
}

export function formatRem(pxValue: number): string {
  return trim(pxValue / ROOT_FONT_SIZE, 4);
}
