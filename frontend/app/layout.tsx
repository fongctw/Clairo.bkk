import "./globals.css";

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clairo.bkk — Bangkok Green Space Finder",
  description: "Find safe, clean public parks near you in Bangkok based on real-time PM2.5 air quality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/60 bg-white/85 px-5 py-3 shadow-sm backdrop-blur">
            <Link href="/map" className="font-display text-xl font-semibold text-ink">
              🌿 Clairo.bkk
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/map" className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink/60 hover:bg-mist hover:text-ink transition">
                Map
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
