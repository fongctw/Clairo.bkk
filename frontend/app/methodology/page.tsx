export default function MethodologyPage() {
  return (
    <main className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h1 className="font-display text-3xl font-semibold">Methodology summary</h1>
        <ol className="mt-4 space-y-3 text-sm text-ink/75">
          <li>1. Load study area, green-space, PM2.5, and pollution-source datasets.</li>
          <li>2. Standardize all datasets to a common Thailand-ready projected CRS.</li>
          <li>3. Interpolate PM2.5 using inverse distance weighting.</li>
          <li>4. Compute source-distance values for each analysis cell.</li>
          <li>5. Normalize NDVI, PM2.5, and distance to a 0-100 suitability scale.</li>
          <li>6. Combine layers using weighted overlay and classify the result.</li>
        </ol>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h2 className="font-semibold">Formula</h2>
        <div className="mt-4 rounded-2xl bg-mist p-4 font-mono text-sm">
          Suitability = (NDVI * 0.45) + (PM2.5 inverse * 0.35) + (Distance * 0.20)
        </div>
        <p className="mt-4 text-sm text-ink/75">
          Higher NDVI is better, lower PM2.5 is better, and farther from pollution sources is better.
        </p>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h2 className="font-semibold">Dataset summary</h2>
        <p className="mt-3 text-sm text-ink/75">
          The local demo ships with simplified GeoJSON and CSV inputs and synthetic greenness values when a raster is missing.
        </p>
      </section>

      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h2 className="font-semibold">Limitations</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink/75">
          <li>The app identifies relatively greener and lower-pollution areas, not zero-pollution zones.</li>
          <li>PM2.5 is time-varying, and interpolation accuracy depends on station distribution.</li>
          <li>Greenness does not guarantee public access or comfort on the ground.</li>
        </ul>
      </section>
    </main>
  );
}

