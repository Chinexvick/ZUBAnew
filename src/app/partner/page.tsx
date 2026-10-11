import type { Metadata } from "next";
import Link from "next/link";
import { art } from "@/content/art";
import { Heading, Runes, ZText } from "@/components/ui/Glyphs";
import PartnerForm from "./PartnerForm";

export const metadata: Metadata = {
  title: "Partner With Us",
  description: "Partner with ZUBA: anime and movie studios, game projects, marketing partners, testers, creators, and developers and animators who want to join the team.",
  alternates: { canonical: "/partner" },
};

const why = [
  { t: "A universe, not a one-off", d: "ZUBA is building films, games, stories and tools under one African universe. Partners plug into all of it." },
  { t: "A community that shows up", d: "Holders, players and creators who watch premieres, play builds, and share what they love." },
  { t: "Token-powered collaboration", d: "$ZUBA lets us reward testers, fund creators, and share upside with partners on-chain." },
  { t: "Audited and KYC verified", d: "Our contract is audited and the team is KYC verified, so partners know who they are building with." },
];

const steps = [
  { n: "01", t: "Choose your path", d: "Pick the partnership that fits you." },
  { n: "02", t: "Send the scroll", d: "Answer a few short questions about you and your idea." },
  { n: "03", t: "We review", d: "The team reads every application, usually within a few days." },
  { n: "04", t: "We talk", d: "We reach out on Telegram or WhatsApp to plan next steps." },
];

const faq = [
  { q: "Is there a fee to partner with ZUBA?", a: "No. We never charge to apply. Anyone asking you to pay on ZUBA's behalf is not us." },
  { q: "How do testers get rewarded?", a: "Testers receive $ZUBA tokens to the BNB Chain wallet they submit, based on the testing rounds they complete and the quality of their reports." },
  { q: "Can I apply for more than one path?", a: "Yes. Send one application per path so the right people on our team see it." },
  { q: "I'm a solo developer or artist. Can I still apply?", a: "Absolutely. The Developers & Animators path is for individuals who want to join the ZUBA team." },
  { q: "How will you contact me?", a: "On the Telegram or WhatsApp number you provide. Make sure it's active." },
];

export default function PartnerPage() {
  return (
    <>
      <section className="page-hero">
        <div className="page-hero-bg" style={{ backgroundImage: `url(${art("world-hero")})` }} aria-hidden="true" />
        <div className="container">
          <Heading
            as="h1"
            runes="Alliance"
            title="Partner With Us"
            size="xl"
            lead="Studios, game makers, marketers, players, creators and talents: help us carry African stories to every screen on earth."
          />
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <a href="#paths" className="btn primary">
              Choose your path
            </a>
            <a href="https://t.me/buildwithvicky" className="btn" target="_blank" rel="noopener noreferrer">
              Talk to us on Telegram
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="pw-why">
            {why.map((w) => (
              <div key={w.t} className="pw-why-card">
                <Runes text="Why" />
                <h3 className="t-title sm">
                  <ZText>{w.t}</ZText>
                </h3>
                <p className="t-muted">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PartnerForm />

      <section className="section">
        <div className="container">
          <Heading runes="Journey" title="How It Works" size="md" />
          <ol className="pw-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="pw-step-n">{s.n}</span>
                <span className="t-title sm">
                  <ZText>{s.t}</ZText>
                </span>
                <span className="t-muted">{s.d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 820 }}>
          <Heading runes="Questions" title="Questions" size="md" />
          <div className="pw-faq">
            {faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
          <p className="center t-muted" style={{ marginTop: 30 }}>
            Prefer email? Write to{" "}
            <a className="hl" href="mailto:info@zubatoken.com">
              info@zubatoken.com
            </a>{" "}
            or see our current <Link href="/#allies" className="hl">allies</Link>.
          </p>
        </div>
      </section>
    </>
  );
}
