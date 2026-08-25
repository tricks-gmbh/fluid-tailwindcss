import type { CompileResult } from "../../shared/types";
import { EXAMPLE_CLASSES } from "../lib/defaults";

interface ClassFieldProps {
  value: string;
  onChange: (value: string) => void;
  result: CompileResult | null;
  isCompiling: boolean;
  transportError: string | null;
}

const STATUS_STYLES = {
  fluid: {
    label: "Handled by the plugin",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  "tailwind-only": {
    label: "Valid Tailwind class, not a fluid utility",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  unknown: {
    label: "Not processable",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  error: {
    label: "Compile error",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
} as const;

function Status({ result, isCompiling, transportError }: Omit<ClassFieldProps, "value" | "onChange">) {
  if (transportError) {
    return (
      <p className="text-xs text-rose-300">
        Cannot reach the compile endpoint. Is the dev server running? ({transportError})
      </p>
    );
  }

  if (!result) {
    return (
      <p className="text-xs text-slate-500">
        {isCompiling ? "Compiling…" : "Enter a class to validate it against the plugin."}
      </p>
    );
  }

  const status = STATUS_STYLES[result.status];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {status.label}
      </span>
      {isCompiling && <span className="text-xs text-slate-500">compiling…</span>}
      {result.status === "unknown" && (
        <span className="text-xs text-slate-500">
          Tailwind emitted no rule for <code className="text-slate-400">{result.className}</code>.
        </span>
      )}
      {result.error && <span className="text-xs text-rose-300">{result.error}</span>}
    </div>
  );
}

export function ClassField({
  value,
  onChange,
  result,
  isCompiling,
  transportError,
}: ClassFieldProps) {
  return (
    <div className="panel p-4">
      <label htmlFor="class-input" className="field-label">
        Tailwind class
      </label>
      <input
        id="class-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="fl-text-base/2xl"
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        className="field-input font-mono text-base"
      />

      <div className="mt-3">
        <Status result={result} isCompiling={isCompiling} transportError={transportError} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {EXAMPLE_CLASSES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onChange(example)}
            className={`rounded-md border px-2 py-1 font-mono text-xs transition ${
              example === value
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "border-slate-800 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
