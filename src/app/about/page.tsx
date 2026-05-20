import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "About — Cogniflow Automations",
};

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-6">
            About Cogniflow
          </h1>

          <div className="space-y-6 text-[var(--color-text-muted)] leading-relaxed">
            <p>
              Cogniflow Automations builds AI-powered voice agents for Indian businesses.
              We believe every business — from a neighbourhood clinic to a growing sales team —
              deserves the power of intelligent call automation.
            </p>

            <p>
              Our platform deploys AI agents that handle inbound and outbound calls with
              sub-500ms latency across 10+ Indian languages. Whether it&apos;s booking appointments,
              qualifying leads, or following up with customers, our agents work 24/7 so your
              team can focus on what matters.
            </p>

            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">
              Why we built this
            </h2>
            <p>
              Indian businesses lose thousands of leads every month to missed calls.
              Hiring enough agents to cover every call, in every language, around the clock
              is expensive and hard to scale. We built Cogniflow to solve exactly this —
              reliable, natural-sounding AI agents that understand Indian languages,
              accents, and business contexts.
            </p>

            <h2 className="text-xl font-semibold text-[var(--color-text)] pt-4">
              Our team
            </h2>
            <p>
              We&apos;re a small, focused team based in Bangalore, combining expertise in
              AI/ML, voice technology, and Indian language processing. We&apos;re backed by
              real-world deployments handling thousands of calls every month.
            </p>

            <div className="pt-6 border-t border-[var(--color-border)] mt-8">
              <p className="text-sm text-[var(--color-text-light)]">
                Have questions? Reach out at{" "}
                <a href="mailto:cogniflowautomations@gmail.com" className="text-[var(--color-brand)] hover:underline">
                  cogniflowautomations@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
