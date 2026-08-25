import type { FluidMode, PlaygroundOptions } from "../../shared/types";
import { DEFAULT_OPTIONS } from "../lib/defaults";

interface OptionsPanelProps {
  options: PlaygroundOptions;
  onChange: (options: PlaygroundOptions) => void;
}

type ViewportKey = Exclude<keyof PlaygroundOptions, "mode">;

const VIEWPORT_FIELDS: {
  key: ViewportKey;
  label: string;
  hint: string;
}[] = [
  {
    key: "minViewport",
    label: "minViewport",
    hint: "Lower end of the scaling range.",
  },
  {
    key: "maxViewport",
    label: "maxViewport",
    hint: "Upper end of the scaling range.",
  },
  {
    key: "minLayoutViewport",
    label: "minLayoutViewport",
    hint: "Width where the min value is reached; scaling extrapolates below it.",
  },
  {
    key: "maxLayoutViewport",
    label: "maxLayoutViewport",
    hint: "Width where the max value is reached; scaling extrapolates above it.",
  },
];

const MODES: { value: FluidMode; label: string; hint: string }[] = [
  {
    value: "interpolation",
    label: "interpolation",
    hint: "Linear interpolation between both values, emitted as clamp().",
  },
  {
    value: "proportional",
    label: "proportional",
    hint: "Max value as a pure viewport ratio, min value as a bound.",
  },
];

function NumberField({
  field,
  value,
  ignored,
  onChange,
}: {
  field: (typeof VIEWPORT_FIELDS)[number];
  value: number | null;
  ignored: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className={ignored ? "opacity-50" : undefined}>
      <label htmlFor={field.key} className="field-label flex items-center justify-between gap-2">
        <span className="normal-case">{field.label}</span>
        {ignored && <span className="text-[10px] text-slate-500 lowercase">unused</span>}
      </label>
      <div className="relative">
        <input
          id={field.key}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value ?? ""}
          placeholder="unset"
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next === "" ? null : Number(next));
          }}
          className="field-input pr-9 tabular-nums"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
          px
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{field.hint}</p>
    </div>
  );
}

export function OptionsPanel({ options, onChange }: OptionsPanelProps) {
  const isProportional = options.mode === "proportional";
  const activeMode = MODES.find((mode) => mode.value === options.mode)!;

  const update = (patch: Partial<PlaygroundOptions>) => onChange({ ...options, ...patch });

  const isDefault = (Object.keys(DEFAULT_OPTIONS) as (keyof PlaygroundOptions)[]).every(
    (key) => options[key] === DEFAULT_OPTIONS[key],
  );

  return (
    <div className="panel p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Plugin options</h2>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_OPTIONS)}
          disabled={isDefault}
          className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-400 transition enabled:hover:border-slate-700 enabled:hover:text-slate-200 disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      <div className="space-y-4">
        {VIEWPORT_FIELDS.map((field) => (
          <NumberField
            key={field.key}
            field={field}
            value={options[field.key]}
            ignored={
              isProportional && (field.key === "minViewport" || field.key === "minLayoutViewport")
            }
            onChange={(value) => update({ [field.key]: value } as Partial<PlaygroundOptions>)}
          />
        ))}

        <div>
          <span className="field-label normal-case">mode</span>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-1">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => update({ mode: mode.value })}
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                  options.mode === mode.value
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">{activeMode.hint}</p>
        </div>
      </div>

      {isProportional && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-400">
          Proportional mode ignores <code>minViewport</code> and <code>minLayoutViewport</code>. The
          max value lands on <code>maxLayoutViewport ?? maxViewport</code>, and{" "}
          <code>maxViewport</code> caps the growth.
        </p>
      )}
    </div>
  );
}
