import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Privacy() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto prose prose-slate">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-8">Privacy Policy</h1>
          <p className="text-sm text-[var(--color-text-light)] mb-8">Last updated: May 2026</p>

          <div className="space-y-6 text-sm text-[var(--color-text-muted)] leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">1. Information We Collect</h2>
              <p>We collect information you provide directly: name, email, phone number, and organization details when you sign up or contact us. We also collect usage data including call logs, analytics, and interaction data with our AI agents.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">2. How We Use Your Information</h2>
              <p>We use your information to provide and improve our AI calling services, process transactions, send service updates, and provide customer support. Call recordings may be used to improve AI agent quality.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">3. Data Security</h2>
              <p>All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use industry-standard security practices and regularly audit our systems. Call recordings are stored securely and deleted per your retention settings.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">4. Data Sharing</h2>
              <p>We do not sell your personal information. We share data only with service providers necessary to operate our platform (cloud hosting, telephony providers) under strict data processing agreements.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">5. Your Rights</h2>
              <p>You can request access to, correction of, or deletion of your personal data at any time by contacting us at cogniflowautomations@gmail.com.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">6. Contact</h2>
              <p>Cogniflow Automations<br />Bangalore, India<br />cogniflowautomations@gmail.com</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
