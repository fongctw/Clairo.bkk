export function LayerLegend() {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-4 text-sm shadow-sm">
      <h3 className="font-semibold">Map legend</h3>
      <ul className="mt-3 space-y-2 text-ink/80">
        <li><span className="mr-2 inline-block h-3 w-3 rounded border border-[#1f4f39] bg-[#dcedc8]" />Bangkok study area</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded bg-[#2e7d32]" />Green places and parks</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded bg-[#1b5e20]" />Very high suitability</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded bg-[#4caf50]" />High suitability</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded bg-[#4d8bb7]" />PM2.5 station</li>
        <li><span className="mr-2 inline-block h-3 w-3 rounded bg-[#bf5b04]" />Pollution source</li>
      </ul>
    </div>
  );
}
