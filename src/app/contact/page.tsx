import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Phone, MapPin } from "lucide-react";

export const metadata = {
  title: "Contact — Cogniflow Automations",
};

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-4">
            Get in touch
          </h1>
          <p className="text-[var(--color-text-muted)] mb-10">
            Have a question, want a demo, or ready to get started? We&apos;d love to hear from you.
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bento-card text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-4">
                <Mail size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Email</h3>
              <a
                href="mailto:cogniflowautomations@gmail.com"
                className="text-sm text-[var(--color-brand)] hover:underline break-all"
              >
                cogniflowautomations@gmail.com
              </a>
            </div>

            <div className="bento-card text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-4">
                <Phone size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">WhatsApp</h3>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--color-brand)] hover:underline"
              >
                +91 98765 43210
              </a>
            </div>

            <div className="bento-card text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-light)] flex items-center justify-center mx-auto mb-4">
                <MapPin size={20} className="text-[var(--color-brand)]" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text)] mb-1">Location</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Bangalore, India
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-[var(--color-text-muted)] mb-4">
              Want to see Cogniflow in action?
            </p>
            <a
              href="https://cal.com/kalki-111/book-a-call"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Book a Demo Call
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
