"use client";

import ScrollReveal from "./ScrollReveal";

const WHATSAPP_MESSAGES = [
  {
    sender: "agent",
    text: "Hi Sarah, thanks for the great call. As promised, here's the Growth plan overview.",
    time: "2:45 PM",
  },
  {
    sender: "agent",
    type: "card",
    title: "Cogniflow Growth Plan",
    subtitle: "$199/mo",
    time: "2:45 PM",
  },
  {
    sender: "sarah",
    text: "This looks perfect. Can we set up a meeting for Thursday?",
    time: "2:47 PM",
  },
  {
    sender: "agent",
    text: "Absolutely. I've sent a calendar invite for Thursday at 2 PM. Looking forward to it.",
    time: "2:47 PM",
  },
];

export default function ChannelReveal() {
  return (
    <section className="max-w-7xl mx-auto py-20 sm:py-32 px-4 sm:px-6">
      {/* Email Section */}
      <ScrollReveal>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Text */}
          <div>
            <p className="text-xs uppercase tracking-widest text-brand font-mono mb-4">
              Email
            </p>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-4 sm:mb-6">
              Every email written for one person
            </h3>
            <p className="text-base text-text-secondary leading-relaxed">
              Not templates. Not mail merge. Your AI agent researches the
              recipient, crafts a unique message, and sends it at the right
              time. Replies go up. Unsubscribes go down.
            </p>
          </div>

          {/* Right - Email Mockup */}
          <ScrollReveal delay={0.15}>
            <div className="bg-glass border border-glass-border rounded-2xl p-6 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-tertiary w-10">To:</span>
                  <span className="text-text-secondary">
                    sarah.chen@acmecorp.com
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-text-tertiary w-10">Subj:</span>
                  <span className="text-text-primary font-medium">
                    Following up on our conversation about scaling your SDR team
                  </span>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="text-xs text-text-secondary leading-relaxed space-y-3">
                <p>
                  Hi Sarah,{" "}
                  <span className="bg-brand/20 text-brand rounded px-1 py-0.5">
                    After seeing Acme Corp&apos;s 40% growth this quarter
                  </span>
                  , I wanted to follow up on{" "}
                  <span className="bg-brand/20 text-brand rounded px-1 py-0.5">
                    our conversation about WhatsApp integration
                  </span>
                  .
                </p>
                <p>
                  <span className="bg-brand/20 text-brand rounded px-1 py-0.5">
                    Given your team is handling 200+ leads daily
                  </span>
                  , I think{" "}
                  <span className="bg-brand/20 text-brand rounded px-1 py-0.5">
                    our Growth plan
                  </span>{" "}
                  would be a perfect fit for where Acme is headed.
                </p>
                <p>
                  Would Thursday work for a quick 15-minute walkthrough?
                </p>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                  Personalization Score
                </span>
                <span className="text-xs text-brand font-medium">94%</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </ScrollReveal>

      {/* WhatsApp Section */}
      <div className="mt-20 sm:mt-32">
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left - WhatsApp Mockup */}
            <ScrollReveal delay={0.15} className="order-2 lg:order-1">
              <div className="bg-glass border border-glass-border rounded-2xl overflow-hidden">
                {/* Chat Header */}
                <div className="px-5 py-3 border-b border-glass-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-semibold">
                    C
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      Cogniflow Agent
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-[10px] text-text-tertiary">
                        online
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-3">
                  {WHATSAPP_MESSAGES.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        msg.sender === "sarah"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 ${
                          msg.sender === "sarah"
                            ? "bg-brand/20 rounded-br-sm"
                            : "bg-bg-secondary rounded-bl-sm"
                        }`}
                      >
                        {msg.type === "card" ? (
                          <div className="border border-glass-border rounded-lg overflow-hidden">
                            <div className="h-8 bg-brand/10" />
                            <div className="px-3 py-2">
                              <p className="text-xs font-medium text-text-primary">
                                {msg.title}
                              </p>
                              <p className="text-[10px] text-text-tertiary">
                                {msg.subtitle}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-secondary leading-relaxed">
                            {msg.text}
                          </p>
                        )}
                        <p className="text-[10px] text-text-tertiary mt-1 text-right">
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>

            {/* Right - Text */}
            <div className="order-1 lg:order-2">
              <p className="text-xs uppercase tracking-widest text-brand font-mono mb-4">
                WhatsApp
              </p>
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-4 sm:mb-6">
                The follow-up that never drops
              </h3>
              <p className="text-base text-text-secondary leading-relaxed">
                Call ends. WhatsApp begins. Your agent moves the conversation to
                the channel the lead prefers — seamlessly, with full context. No
                handoff friction. No dropped threads.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
