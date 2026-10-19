import type { Metadata } from "next";
import { art } from "@/content/art";
import { Heading, Runes, ZText } from "@/components/ui/Glyphs";
import { perks } from "@/content/subscriptions";
import SubscribeForm from "./SubscribeForm";

export const metadata: Metadata = {
  title: "Zualingo Premium",
  description: "Get Zualingo Premium: all lesson chapters, 200 Kitendawili riddles, every Zuba Boom level, every Zuba Run city and every animated story. Pay once, get a one-time 5-digit code by email.",
  alternates: { canonical: "/subscriptions" },
};

const steps = [
  { n: "01", t: "Choose a plan", d: "Pick 1, 3 or 12 months." },
  { n: "02", t: "Use your app email", d: "Enter the same email you sign in with in the Zualingo app." },
  { n: "03", t: "Pay", d: "We confirm your payment, usually within a few hours." },
  { n: "04", t: "Get your code", d: "A one-time 5-digit code arrives by email. In the app: Profile, Premium, I have a code." },
];

const faq = [
  { q: "Why does my email matter?", a: "Your code is tied to your email. It only unlocks Premium for the Zualingo account that signs in with that email, so nobody else can use it." },
  { q: "Can I share my code?", a: "No. Each code works once, for one account. Never share it." },
  { q: "What happens when my plan ends?", a: "Your progress stays. Premium chapters and levels lock again until you add a new code. Buying again before it ends adds the new days on top." },
  { q: "I paid but have no code yet.", a: "Check your spam folder first. If it is not there after a few hours, reply to our confirmation email with your payment reference." },
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
            <a href="#plans" className="btn primary">
              Choose a plan
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

      <SubscribeForm />

      <section className="section">
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
