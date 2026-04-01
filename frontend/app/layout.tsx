import "./globals.css";

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Green & Clean Bangkok Finder",
  description: "Spatial suitability analysis for relatively green and lower-pollution areas in Bangkok."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/85 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
            <div>
              <Link href="/" className="font-display text-3xl font-semibold">
                Green &amp; Clean Bangkok Finder
              </Link>
              <p className="mt-2 max-w-2xl text-sm text-ink/70">
                A GIS suitability analysis app for locating relatively greener and lower-pollution areas in Bangkok and nearby provinces.
              </p>
            </div>
            <nav className="flex flex-wrap gap-3 text-sm font-medium">
              <Link href="/" className="rounded-full bg-mist px-4 py-2">Home</Link>
              <Link href="/map" className="rounded-full bg-mist px-4 py-2">Map</Link>
              <Link href="/results" className="rounded-full bg-mist px-4 py-2">Results</Link>
              <Link href="/methodology" className="rounded-full bg-mist px-4 py-2">Methodology</Link>
              <Link href="/about" className="rounded-full bg-mist px-4 py-2">About</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

