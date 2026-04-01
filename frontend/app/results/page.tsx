import { ResultsCharts } from "@/components/ResultsCharts";
import { ResultsTable } from "@/components/ResultsTable";
import { StatCard } from "@/components/StatCard";
import { getLatestResult } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

export default async function ResultsPage() {
  const result = await getLatestResult();

  return (
    <main className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Highest-scoring area" value={result.summaryStatistics.highestScoringArea} hint="Best-ranked candidate area in the current run." />
        <StatCard title="Average NDVI" value={result.summaryStatistics.averageNdvi.toFixed(3)} hint="Mean greenness across the grid." />
        <StatCard title="Average PM2.5" value={result.summaryStatistics.averagePm25.toFixed(1)} hint="Interpolated mean PM2.5 across candidate cells." />
        <StatCard title="Green spaces detected" value={String(result.summaryStatistics.totalGreenSpacesDetected)} hint="Clipped park and open-space features." />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <ResultsTable rankings={result.rankedFeatures} />
        <ResultsCharts rankings={result.rankedFeatures} />
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h2 className="font-semibold">Export current analysis</h2>
        <p className="mt-2 text-sm text-ink/70">
          Download the latest suitability output for reporting or GIS inspection.
        </p>
        <div className="mt-4 flex gap-3">
          <a href={`${API_BASE_URL}/export/geojson`} className="rounded-full bg-canopy px-4 py-2 font-semibold text-white">
            Download GeoJSON
          </a>
          <a href={`${API_BASE_URL}/export/csv`} className="rounded-full bg-river px-4 py-2 font-semibold text-white">
            Download CSV
          </a>
        </div>
      </section>
    </main>
  );
}
