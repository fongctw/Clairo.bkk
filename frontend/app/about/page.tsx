export default function AboutPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
        <h1 className="font-display text-3xl font-semibold">About and limitations</h1>
        <p className="mt-4 max-w-3xl text-sm text-ink/75">
          Green &amp; Clean Bangkok Finder is a decision-support prototype for GIS coursework. It highlights relatively greener and lower-pollution zones based on current data inputs and model assumptions.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
          <h2 className="font-semibold">What it does not do</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/75">
            <li>It does not guarantee zero pollution.</li>
            <li>It does not reflect every pollution type.</li>
            <li>It does not guarantee accessibility, safety, or route quality.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-white/60 bg-white/90 p-6 shadow-sm">
          <h2 className="font-semibold">Future improvements</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink/75">
            <li>Add time-aware PM2.5 analysis and a time slider.</li>
            <li>Support user geolocation, nearest-area lookup, and route suggestions.</li>
            <li>Add upload tools for real datasets and district comparison workflows.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

