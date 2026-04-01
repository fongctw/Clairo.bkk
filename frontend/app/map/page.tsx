"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { FilterSidebar } from "@/components/FilterSidebar";
import { GreenPlacesPanel } from "@/components/GreenPlacesPanel";
import { LayerLegend } from "@/components/LayerLegend";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS, DEFAULT_LAYER_TOGGLES, DEFAULT_WEIGHTS } from "@/lib/config";
import { getLatestResult, runAnalysis } from "@/lib/api";
import type { AnalysisResponse, LayerToggleState } from "@/lib/types";

const DynamicMapView = dynamic(() => import("@/components/MapView").then((mod) => mod.MapView), {
  ssr: false
});

export default function MapPage() {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [hasAppliedAnalysis, setHasAppliedAnalysis] = useState(false);
  const [draftLayers, setDraftLayers] = useState<LayerToggleState>(DEFAULT_LAYER_TOGGLES);
  const [appliedLayers, setAppliedLayers] = useState<LayerToggleState>(DEFAULT_LAYER_TOGGLES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const initial = await getLatestResult();
        setResult(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load backend");
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function handleRun() {
    setIsLoading(true);
    setError(null);
    try {
      const next = await runAnalysis(DEFAULT_FILTERS, DEFAULT_WEIGHTS);
      setResult(next);
      setHasAppliedAnalysis(true);
      setAppliedLayers(draftLayers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleLayer(key: keyof LayerToggleState) {
    setDraftLayers((current) => ({ ...current, [key]: !current[key] }));
  }

  if (isLoading && !result) {
    return <div className="rounded-3xl bg-white/90 p-8 shadow-sm">Loading GIS layers and suitability outputs...</div>;
  }

  if (error && !result) {
    return <div className="rounded-3xl bg-white/90 p-8 text-alert shadow-sm">{error}</div>;
  }

  if (!result) {
    return <div className="rounded-3xl bg-white/90 p-8 shadow-sm">No analysis result available yet.</div>;
  }

  return (
    <main className="space-y-6">
      {error ? <div className="rounded-2xl bg-orange-100 px-4 py-3 text-sm text-alert">{error}</div> : null}
      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="order-2 xl:order-1 xl:sticky xl:top-6 xl:self-start">
          <FilterSidebar
            layers={draftLayers}
            onLayerToggle={toggleLayer}
            onRun={handleRun}
            isLoading={isLoading}
          />
        </div>
        <div className="order-1 space-y-4 xl:order-2">
          <div className="rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-sm md:px-5">
            <h2 className="font-semibold">Bangkok green place finder</h2>
            <p className="mt-2 text-sm text-ink/65">
              The map stays around Bangkok and nearby provinces only. Layer choices and suitability results are applied only after you click the analysis button.
            </p>
          </div>
          <div className="rounded-3xl border border-white/60 bg-white/90 p-2 shadow-sm md:p-3">
            <DynamicMapView result={result} visibleLayers={appliedLayers} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-4">
              <LayerLegend />
              <GreenPlacesPanel result={result} />
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm md:p-5">
              <h3 className="font-semibold">Top clean &amp; green areas</h3>
              {hasAppliedAnalysis ? (
                <>
                  <p className="mt-2 max-w-3xl text-sm text-ink/65">
                    These rankings come from the latest analysis run using the current live PM2.5 feed and available green-place data.
                  </p>
                  <div className="mt-5">
                    <ResultsTable rankings={result.rankedFeatures.slice(0, 5)} />
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl bg-mist p-4 text-sm text-ink/70">
                  Choose the layers you want, then click <span className="font-semibold">Run suitability analysis</span>. The suitability layer and ranked areas will appear only after that.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
