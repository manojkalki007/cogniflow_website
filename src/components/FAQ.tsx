"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "How does the AI sound on a call?",
    a: "Our agents use advanced neural TTS with sub-500ms latency. They sound natural, handle interruptions, and adjust tone based on sentiment. Most callers can't tell it's AI.",
  },
  {
    q: "Which languages are supported?",
    a: "We support 10+ Indian languages including Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, and English. Mixed-language (Hinglish) conversations are handled naturally.",
  },
  {
    q: "How long does setup take?",
    a: "Most businesses go live in under 10 minutes. Connect your phone number, pick a template, and your agent starts handling calls. Custom agents take 30-60 minutes to configure.",
  },
  {
    q: "Does it integrate with my CRM?",
    a: "Yes. We integrate natively with HubSpot, Salesforce, and Google Calendar. We also support webhooks for custom CRM integrations.",
  },
  {
    q: "What if a caller wants to speak to a human?",
    a: "The AI detects escalation intent and seamlessly transfers to a human agent. You can configure custom escalation rules based on sentiment, keywords, or caller request.",
  },
  {
    q: "Is it compliant with Indian regulations?",
    a: "Yes. We follow TRAI guidelines for automated calling, support DND registry checks, and maintain call logs for compliance. All data is encrypted and stored securely.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-semibold text-[var(--color-text)] tracking-[-0.01em]">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div
              key={i}
              className="border border-[var(--color-border)] rounded-xl overflow-hidden transition-colors hover:border-[var(--color-brand)]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left"
              >
                <span className="text-sm sm:text-base font-medium text-[var(--color-text)] pr-4">{q}</span>
                <ChevronDown
                  size={18}
                  className={`flex-shrink-0 text-[var(--color-text-light)] transition-transform duration-200 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-6 pb-4">
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
