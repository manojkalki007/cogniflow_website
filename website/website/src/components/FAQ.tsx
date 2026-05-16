"use client";

import { useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";

const QUESTIONS = [
  {
    q: "How fast is the AI agent?",
    a: "Our average end-to-end response time is 350ms — faster than human conversation. We achieve this through semantic turn detection, speculative pre-generation with Groq, and co-located inference.",
  },
  {
    q: "What languages are supported?",
    a: "30+ languages including English, Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, and more. The AI can switch languages mid-conversation based on the caller's preference.",
  },
  {
    q: "Can I use my existing phone number?",
    a: "Yes. Bring your own number via SIP trunk, or we can provision new numbers through Twilio, Telnyx, or Exotel. Setup takes under 5 minutes.",
  },
  {
    q: "Is it HIPAA/PCI compliant?",
    a: "Yes. Our compliance guardrails auto-redact PII from transcripts, block prompt injection attempts, and enforce DNC lists. We support HIPAA, PCI, and GDPR requirements.",
  },
  {
    q: "How does agent cloning work?",
    a: "Upload 20+ call recordings from your best human agent. Our AI analyzes conversation patterns, objection handling, tone, and closing techniques to create a digital clone — no fine-tuning or ML expertise needed.",
  },
  {
    q: "What CRMs do you integrate with?",
    a: "Native integrations with Salesforce, HubSpot, Zoho CRM, and Leadsquared. We also support custom webhooks for any CRM. All calls, transcripts, and outcomes sync automatically.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-medium group-hover:text-text-primary transition-colors pr-4">
          {question}
        </span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-text-secondary leading-relaxed pb-5">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="relative py-32 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4">
            FAQ
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.02em]">
            Common <span className="gradient-text">questions</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-6 md:p-8"
        >
          {QUESTIONS.map((faq) => (
            <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
