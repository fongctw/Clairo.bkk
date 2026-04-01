"use client";

import type { LayerToggleState } from "@/lib/types";

type FilterSidebarProps = {
  layers: LayerToggleState;
  onLayerToggle: (key: keyof LayerToggleState) => void;
  onRun: () => void;
  isLoading: boolean;
};

export function FilterSidebar(props: FilterSidebarProps) {
  const { layers, onLayerToggle, onRun, isLoading } = props;
  const layerLabels: Record<keyof LayerToggleState, string> = {
    ndvi: "Greenness surface",
    pm25: "PM2.5 stations",
    greenSpaces: "Green places",
    pollutionSources: "Pollution sources",
    suitability: "Suitability areas"
  };

  return (
    <aside className="space-y-6 rounded-3xl border border-white/60 bg-white/85 p-5 shadow-sm backdrop-blur">
      <section className="rounded-2xl bg-field/60 p-4">
        <h2 className="font-semibold">Bangkok focus</h2>
        <p className="mt-2 text-sm text-ink/70">
          This view is centered on Bangkok and nearby provinces. Choose the layers you want first, then click the analysis button to apply them on the map.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">What to show</h2>
        <div className="mt-4 space-y-3">
          {Object.entries(layers).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between rounded-xl border border-ink/10 bg-mist px-3 py-2">
              <span className="text-sm">{layerLabels[key as keyof LayerToggleState]}</span>
              <input type="checkbox" checked={enabled} onChange={() => onLayerToggle(key as keyof LayerToggleState)} />
            </label>
          ))}
        </div>
      </section>

      <button
        className="w-full rounded-2xl bg-canopy px-4 py-3 font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onRun}
        disabled={isLoading}
      >
        {isLoading ? "Applying map and analysis..." : "Run suitability analysis"}
      </button>
    </aside>
  );
}
