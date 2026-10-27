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
import "@/styles/partner.css";
import "@/styles/arcade.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import World from "@/components/World";
import SiteChrome from "@/components/SiteChrome";
import SubscribePopup from "@/components/Subscribe";
import Music from "@/components/Music";
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
    images: [{ url: "/brand/og.jpg", width: 1677, height: 938, alt: "ZUBA running through an African city at night beside the gold ZUBA emblem" }],
  },
  twitter: { card: "summary_large_image", site: site.socials.x.handle },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${josefin.variable} ${raleway.variable} ${caveat.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ZUBA",
              url: "https://www.zubatoken.com",
              logo: "https://www.zubatoken.com/brand/zuba-coin.png",
              description: site.description,
              email: "info@zubatoken.com",
              sameAs: [site.socials.x.url, site.socials.telegram.url, site.socials.whatsapp.url],
            }),
          }}
        />
        <World />
        <Nav />
        <main>{children}</main>
        <SiteChrome>
          <Footer />
        </SiteChrome>
        <SubscribePopup />
        <Music />
      </body>
    </html>
  );
}
