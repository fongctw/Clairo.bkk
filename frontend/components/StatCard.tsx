import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 p-4 shadow-sm">
      <p className="text-sm font-semibold text-ink/50">{title}</p>
      <p className="mt-2 text-2xl font-black text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink/40">{hint}</p>}
    </div>
  );
}
