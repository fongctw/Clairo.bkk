import type { RankedArea } from "@/lib/types";

export function ResultsTable({ rankings }: { rankings: RankedArea[] }) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/60 bg-white/90 shadow-sm">
      <table className="min-w-[820px] divide-y divide-ink/10 text-sm xl:min-w-full">
        <thead className="bg-mist">
          <tr>
            <th className="px-4 py-3 text-left">Rank</th>
            <th className="px-4 py-3 text-left">Area</th>
            <th className="px-4 py-3 text-left">Class</th>
            <th className="px-4 py-3 text-left">Total</th>
            <th className="px-4 py-3 text-left">Greenness</th>
            <th className="px-4 py-3 text-left">PM2.5</th>
            <th className="px-4 py-3 text-left">Distance</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((item) => (
            <tr key={item.cellId} className="border-t border-ink/10">
              <td className="px-4 py-3">{item.rank}</td>
              <td className="px-4 py-3">{item.areaName}</td>
              <td className="px-4 py-3">{item.suitabilityClass}</td>
              <td className="px-4 py-3 font-semibold">{item.totalScore.toFixed(1)}</td>
              <td className="px-4 py-3">{item.greennessScore.toFixed(1)}</td>
              <td className="px-4 py-3">{item.pollutionScore.toFixed(1)}</td>
              <td className="px-4 py-3">{item.distanceScore.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
