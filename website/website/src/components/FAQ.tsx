"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

const QUESTIONS = [
  {
    q: "How does it sound on a call?",
    a: "Natural, not robotic. Our agents use advanced voice synthesis with real-time tone adaptation. They adjust pacing, emphasis, and warmth based on the caller's sentiment — so every conversation feels human.",
  },
  {
    q: "Can it handle complex conversations?",
    a: "Yes. Your agent is trained on your scripts and product knowledge, adapts in real time to objections and questions, and knows when to escalate to a human. It doesn't just follow a flowchart — it thinks.",
  },
  {
    q: "How long does setup take?",
    a: "Under 10 minutes. Connect your phone number, upload your scripts and contacts, configure your qualification criteria, and go live. No engineering team required.",
  },
  {
    q: "Does it integrate with our CRM?",
    a: "Yes. Native integrations with Salesforce, HubSpot, and other major CRMs. Custom integrations via API. Every call, email, and WhatsApp message is automatically logged and synced.",
  },
  {
    q: "What if a lead wants to talk to a human?",
    a: "Seamless handoff. The agent detects when a human is needed, briefs your team with full context and sentiment analysis, and transfers the call — the lead never experiences a gap.",
  },
  {
    q: "Is it compliant?",
    a: "Built with compliance at the core. Call recording consent, GDPR-compliant data handling, DNC list management, and full audit trails. We handle the complexity so you don't have to.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border py-4 sm:py-5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left group min-h-[44px]"
      >
        <span className="text-base font-medium text-text-primary group-hover:text-brand transition-colors pr-4">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-text-tertiary" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="text-sm text-text-secondary leading-relaxed pt-3">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="max-w-3xl mx-auto py-20 sm:py-32 px-4 sm:px-6">
      <ScrollReveal>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary text-center mb-10 sm:mb-16">
          Questions
        </h2>
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <div>
          {QUESTIONS.map((faq, i) => (
            <FAQItem
              key={faq.q}
              question={faq.q}
              answer={faq.a}
              isOpen={openIndex === i}
              onToggle={() =>
                setOpenIndex(openIndex === i ? null : i)
              }
            />
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
