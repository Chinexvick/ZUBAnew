import type { Metadata } from "next";
import { art } from "@/content/art";
import { Heading, Runes, ZText } from "@/components/ui/Glyphs";
import { perks } from "@/content/subscriptions";

export const metadata: Metadata = {
  title: "Zualingo Premium",
  description: "Zualingo Premium: all lesson chapters, 200 Kitendawili riddles, every Zuba Boom level, every Zuba Run city and every illustrated story. Your first month is free, then pay with ZUBA right inside the app.",
  alternates: { canonical: "/subscriptions" },
};

const steps = [
  { n: "01", t: "Get the app", d: "Download Zualingo and create your free account." },
  { n: "02", t: "First month free", d: "Every chapter, riddle, game level and story is unlocked for your first 30 days." },
  { n: "03", t: "Earn ZUBA", d: "Play games, finish lessons and win riddle and quiz rooms to fill your in-app ZUBA wallet." },
  { n: "04", t: "Pay with ZUBA", d: "In the app: Profile, Premium. Pick 1 week, 1 month or 3 months and pay from your wallet." },
];

const faq = [
  { q: "Do I still need a code?", a: "No. Premium now lives inside the app. Your first month is free, and after that you pay for Premium with the ZUBA in your in-app wallet." },
  { q: "Can I buy ZUBA with USDT?", a: "Soon. When the ZUBA token contract launches, your wallet in the app will show your own deposit address. USDT you send there turns into ZUBA automatically and appears in the app." },
  { q: "What happens when my free month ends?", a: "Your progress stays. Premium chapters and levels lock again until you add Premium time with ZUBA. Buying again before it ends adds the new days on top." },
  { q: "Is my ZUBA balance safe?", a: "Yes. Your balance is kept on the Zualingo server, so it is the same on every phone you sign in on." },
];

export default function SubscriptionsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("world-hero")})` }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="Premium"
            title="Zualingo Premium"
            size="xl"
            lead="Learn every African language chapter, solve all 200 riddles of the elders and unlock every game level."
          />
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <a href="#how" className="btn primary">
              First month free
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="pw-why">
            {perks.map((w) => (
              <div key={w.t} className="pw-why-card">
                <Runes text="Unlock" />
                <h3 className="t-title sm">
                  <ZText>{w.t}</ZText>
                </h3>
                <p className="t-muted">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <Heading runes="Journey" title="How It Works" size="md" />
          <ol className="pw-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="pw-step-n">{s.n}</span>
                <h3 className="t-title sm">
                  <ZText>{s.t}</ZText>
                </h3>
                <p className="t-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <Heading runes="Answers" title="Questions" size="md" />
          <div className="pw-faq">
            {faq.map((f) => (
              <details key={f.q} className="admin-app">
                <summary>
                  <strong>{f.q}</strong>
                </summary>
                <p className="t-muted" style={{ marginTop: 10 }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
