type StatCardProps = {
  title: string;
  value: string;
  hint: string;
};

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-medium text-ink/70">{title}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-ink/60">{hint}</p>
    </article>
  );
}

