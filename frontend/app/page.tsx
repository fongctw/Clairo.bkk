import Link from "next/link";

import { StatCard } from "@/components/StatCard";

export default function HomePage() {
  return (
    <main className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[2rem] bg-gradient-to-br from-canopy via-ink to-river p-8 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-white/70">Academic GIS mini-project</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl font-semibold leading-tight">
            Find relatively green and cleaner urban areas across Bangkok.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-white/80">
            The app combines NDVI-style greenness, PM2.5 interpolation, and distance from pollution sources into a weighted spatial suitability model.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/map" className="rounded-full bg-white px-5 py-3 font-semibold text-ink">
              Open map
            </Link>
            <Link href="/methodology" className="rounded-full border border-white/30 px-5 py-3 font-semibold text-white">
              Read methodology
            </Link>
          </div>
        </div>

        <div className="grid gap-4">
          <StatCard title="Primary decision factors" value="3" hint="Greenness, PM2.5, and distance to pollution sources." />
          <StatCard title="Default study area" value="Bangkok" hint="Configurable for nearby provinces and future custom polygons." />
          <StatCard title="Default weighting" value="45 / 35 / 20" hint="Greenness / PM2.5 / source distance." />
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
          <h2 className="font-semibold">Interactive analysis</h2>
          <p className="mt-3 text-sm text-ink/70">
            Toggle layers, adjust weights, inspect candidate cells, and export the ranked output.
          </p>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
          <h2 className="font-semibold">Mock data ready</h2>
          <p className="mt-3 text-sm text-ink/70">
            The demo runs locally even when real Bangkok datasets are unavailable. Swap in real files later without changing the UI.
          </p>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
          <h2 className="font-semibold">Clear limitations</h2>
          <p className="mt-3 text-sm text-ink/70">
            Results are relative suitability estimates. They do not imply zero pollution or guaranteed public accessibility.
          </p>
        </div>
      </section>
    </main>
  );
}

