import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Terms() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto prose prose-slate">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-8">Terms of Service</h1>
          <p className="text-sm text-[var(--color-text-light)] mb-8">Last updated: May 2026</p>

          <div className="space-y-6 text-sm text-[var(--color-text-muted)] leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">1. Service Description</h2>
              <p>Cogniflow Automations provides AI-powered calling agents, AI SDR services, and related communication automation tools (&quot;Services&quot;). By using our Services, you agree to these terms.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">2. Account Responsibilities</h2>
              <p>You are responsible for maintaining the security of your account credentials and for all activities under your account. You must provide accurate information and comply with all applicable laws regarding automated calling and communication.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">3. Acceptable Use</h2>
              <p>You agree not to use our Services for spam, fraud, harassment, or any activity that violates TRAI regulations or applicable telecom laws. AI agents must identify themselves as automated systems when required by law.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">4. Billing & Payments</h2>
              <p>Subscription fees are billed monthly in advance. Additional call minutes are billed at the rate specified in your plan. All prices are in Indian Rupees (INR) and exclusive of applicable taxes.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">5. Limitation of Liability</h2>
              <p>Cogniflow Automations is not liable for any indirect, incidental, or consequential damages arising from the use of our Services. Our total liability is limited to the fees paid in the 12 months preceding the claim.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">6. Termination</h2>
              <p>Either party may terminate the agreement with 30 days written notice. Upon termination, your data will be available for export for 30 days, after which it will be permanently deleted.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-[var(--color-text)] mb-3">7. Governing Law</h2>
              <p>These terms are governed by the laws of India. Any disputes shall be resolved in the courts of Bangalore, Karnataka.</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
