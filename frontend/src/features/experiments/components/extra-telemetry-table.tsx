/** "soot_volume_fraction_ppm" → "Soot volume fraction ppm" */
function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Generic display for any JSON value (the schema escape hatch can hold anything). */
function display(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isFinite(value) ? String(Number(value.toPrecision(6))) : String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value === "" ? "—" : value;
  return JSON.stringify(value);
}

/**
 * Every `extra_telemetry` key, rendered generically: unmapped source columns are kept by the schema,
 * so the UI must show whatever arrives without knowing the keys in advance.
 */
export function ExtraTelemetryTable({ extra }: { extra: Record<string, unknown> | null | undefined }) {
  const entries = Object.entries(extra ?? {}).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return <p className="text-xs text-muted">No extra telemetry for this run.</p>;
  }

  return (
    <table className="w-full text-xs">
      <caption className="sr-only">Extra telemetry ({entries.length} keys)</caption>
      <thead>
        <tr className="text-left text-[11px] text-muted">
          <th scope="col" className="pb-1 font-medium">Key</th>
          <th scope="col" className="pb-1 text-right font-medium">Value</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key} className="border-t border-border/60 align-top">
            <th scope="row" className="py-1.5 pr-3 text-left font-normal">
              <span className="block text-fg">{humanize(key)}</span>
              <span className="block font-mono text-[10px] text-muted">{key}</span>
            </th>
            <td className="py-1.5 text-right font-mono break-words text-fg tabular-nums">{display(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
