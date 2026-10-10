import type { Metadata } from "next";
import { Josefin_Sans, Raleway, Caveat } from "next/font/google";
import "./globals.css";
import "@/styles/chrome.css";
import "@/styles/pages.css";
import "@/styles/token.css";
import "@/styles/home.css";
import "@/styles/codex.css";
import "@/styles/about.css";
import "@/styles/subscribe.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import World from "@/components/World";
import SiteChrome from "@/components/SiteChrome";
import SubscribePopup from "@/components/Subscribe";
import { site } from "@/lib/site";

const josefin = Josefin_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-josefin" });
const raleway = Raleway({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], style: ["normal", "italic"], variable: "--font-raleway" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-hand" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.zubatoken.com"),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: {
    title: `${site.name} · ${site.tagline}`,
    description: site.description,
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "ZUBA" }],
  },
  twitter: { card: "summary_large_image", site: site.socials.x.handle },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${josefin.variable} ${raleway.variable} ${caveat.variable}`}>
      <body>
        <World />
        <Nav />
        <main>{children}</main>
        <SiteChrome>
          <Footer />
        </SiteChrome>
        <SubscribePopup />
      </body>
    </html>
  );
}
