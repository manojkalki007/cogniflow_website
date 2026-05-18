"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import DashboardScreenshot from "@/components/DashboardScreenshot";
import ProblemStatement from "@/components/ProblemStatement";
import MarqueeStrip from "@/components/MarqueeStrip";
import IntelligenceSplit from "@/components/IntelligenceSplit";
import PerformanceSplit from "@/components/PerformanceSplit";
import LiveCallExperience from "@/components/LiveCallExperience";
import ChannelReveal from "@/components/ChannelReveal";
import SocialProof from "@/components/SocialProof";
import HowItWorks from "@/components/HowItWorks";
import FeatureGrid from "@/components/FeatureGrid";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3000";

function MidPageCTA() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-text-primary mb-6">
          Ready to see it in action?
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`${DASHBOARD_URL}/login`}
            className="px-8 py-3.5 rounded-full text-sm font-semibold bg-brand text-white hover:bg-brand/90 transition-all duration-200 shadow-[0_0_30px_rgba(0,24,255,0.2)]"
          >
            Start Free Trial
          </a>
          <a
            href="#book-demo"
            className="px-8 py-3.5 rounded-full text-sm font-semibold border border-white/[0.08] text-text-primary hover:border-white/[0.15] hover:bg-white/[0.03] transition-all duration-200"
          >
            Book a Demo
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <DashboardScreenshot />
        <ProblemStatement />
        <MarqueeStrip />
        <section id="product">
          <IntelligenceSplit />
          <PerformanceSplit />
        </section>
        <LiveCallExperience />
        <ChannelReveal />
        <SocialProof />
        <HowItWorks />
        <FeatureGrid />
        <MidPageCTA />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
