"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { RankedArea } from "@/lib/types";

export function ResultsCharts({ rankings }: { rankings: RankedArea[] }) {
  const chartData = rankings.slice(0, 5).map((item) => ({
    name: item.areaName.replace("Candidate ", "A"),
    total: item.totalScore,
    ndvi: item.greennessScore,
    air: item.pollutionScore
  }));

  return (
    <div className="h-[320px] rounded-3xl border border-white/60 bg-white/90 p-4 shadow-sm">
      <h3 className="mb-4 font-semibold">Top area score comparison</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dce6df" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="total" fill="#3f7d58" radius={6} />
          <Bar dataKey="ndvi" fill="#6fb98f" radius={6} />
          <Bar dataKey="air" fill="#4d8bb7" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

