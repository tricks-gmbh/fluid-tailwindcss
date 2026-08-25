import type { CompileResult } from "../../shared/types";
import type { SkippedSeries } from "../lib/series";

interface CssOutputProps {
  result: CompileResult | null;
  skipped: SkippedSeries[];
}

export function CssOutput({ result, skipped }: CssOutputProps) {
  const css = result?.css.trim();

  return (
    <div className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-200">Generated CSS</h2>

      {css ? (
        <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 font-mono text-xs leading-relaxed text-slate-300">
          {css}
        </pre>
      ) : (
        <p className="text-xs text-slate-500">No CSS was generated for this class.</p>
      )}

      {result && result.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {result.warnings.map((warning, index) => (
            <p
              key={index}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] leading-relaxed text-amber-200"
            >
              {warning}
            </p>
          ))}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mt-3 space-y-1">
          {skipped.map((entry) => (
            <p key={entry.property} className="text-[11px] leading-relaxed text-slate-500">
              <code className="text-slate-400">{entry.property}</code> is not plotted because{" "}
              {entry.reason}.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
