import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SmoothScroll } from "@/components/SmoothScroll";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Cogniflow — AI Calling Agent & AI SDR for Indian Businesses",
  description:
    "Deploy AI voice agents for appointment booking, lead qualification, and sales outreach. Sub-500ms latency, 10+ Indian languages, starting at ₹2,999/month.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Cogniflow — AI Agents That Handle Your Calls",
    description:
      "Automate inbound & outbound calls with AI. Hindi, Tamil, Telugu + 7 more languages. Live in 10 minutes.",
    url: "https://www.cogniflowautomations.com",
    siteName: "Cogniflow Automations",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cogniflow — AI Calling Agent Platform",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
