"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductShowcase from "@/components/ProductShowcase";
import LatencyVisual from "@/components/LatencyVisual";
import FeaturesGrid from "@/components/FeaturesGrid";
import HowItWorks from "@/components/HowItWorks";
import SocialProof from "@/components/SocialProof";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";

const VocalHero = dynamic(() => import("@/components/VocalHero"), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <VocalHero />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <ProductShowcase />
        <LatencyVisual />
        <FeaturesGrid />
        <HowItWorks />
        <SocialProof />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
