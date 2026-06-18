import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Baloo_2, Nunito, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import UsageBeacon from "@/components/UsageBeacon";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Theme fonts: Friendly = Baloo 2 + Nunito; Utilitarian = IBM Plex Sans + Mono.
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"], weight: ["400", "600", "700"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "FuelSmart AU",
  description: "Find cheapest fuel prices across Australia",
  other: {
    // Stops Chrome/Edge offering to translate the page. Our UI is short
    // labels + numbers that CLD3 routinely misclassifies as German.
    google: "notranslate",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Applies the saved theme before paint so there's no flash. Defaults (set
// statically on <html>) are friendly/teal, so only non-default users see a
// sub-frame correction.
const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem('fuelsmart-theme')||'null');if(t&&t.style&&t.palettes){var r=document.documentElement;r.setAttribute('data-style',t.style);r.setAttribute('data-palette',t.palettes[t.style]||'');}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-style="friendly"
      data-palette="teal"
      className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} ${nunito.variable} ${plex.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {children}
        <UsageBeacon />
      </body>
    </html>
  );
}
