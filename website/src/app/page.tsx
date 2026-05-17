"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import ProblemStatement from "@/components/ProblemStatement";
import IntelligenceSplit from "@/components/IntelligenceSplit";
import PerformanceSplit from "@/components/PerformanceSplit";
import LiveCallExperience from "@/components/LiveCallExperience";
import ChannelReveal from "@/components/ChannelReveal";
import HowItWorks from "@/components/HowItWorks";
import FeatureGrid from "@/components/FeatureGrid";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SocialProof />
        <ProblemStatement />
        <section id="product">
          <IntelligenceSplit />
          <PerformanceSplit />
        </section>
        <LiveCallExperience />
        <ChannelReveal />
        <HowItWorks />
        <FeatureGrid />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
