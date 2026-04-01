import type { AnalysisResponse } from "@/lib/types";

export function GreenPlacesPanel({ result }: { result: AnalysisResponse }) {
  const places = result.layers.greenSpaces.features.map((feature, index) => ({
    id: `${feature.properties?.name ?? "place"}-${index}`,
    name: String(feature.properties?.name ?? "Unnamed green place"),
    type: String(feature.properties?.type ?? "green space")
  }));

  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
      <h3 className="font-semibold">Green places in Bangkok area</h3>
      <p className="mt-2 text-sm text-ink/65">{places.length} green places are available in the current dataset for this study area.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {places.length > 0 ? (
          places.map((place) => (
            <div key={place.id} className="rounded-xl bg-mist px-3 py-3">
              <p className="font-medium">{place.name}</p>
              <p className="text-sm text-ink/60">{place.type.replaceAll("_", " ")}</p>
            </div>
          ))
        ) : (
          <div className="rounded-xl bg-mist px-3 py-3 text-sm text-ink/65">
            No green-place polygons are available yet. Add real Bangkok park data to improve this section.
          </div>
        )}
      </div>
    </div>
  );
}
