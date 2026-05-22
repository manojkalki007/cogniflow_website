import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Cogniflow — AI Calling Agent & AI SDR for Indian Businesses";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0A0F1E 0%, #0F172A 50%, #1E293B 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #00BCD4, #0097A7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            C
          </div>
          <span
            style={{
              color: "#F9FAFB",
              fontSize: "36px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Cogniflow
          </span>
        </div>

        <h1
          style={{
            color: "#F9FAFB",
            fontSize: "52px",
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            margin: 0,
            maxWidth: "900px",
          }}
        >
          AI Calling Agent & AI SDR
        </h1>

        <p
          style={{
            color: "rgba(255,255,255,0.6)",
            fontSize: "24px",
            textAlign: "center",
            marginTop: "16px",
            maxWidth: "700px",
            lineHeight: 1.4,
          }}
        >
          Automate inbound & outbound calls with AI. 10+ Indian languages. Sub-500ms latency.
        </p>

        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "40px",
          }}
        >
          {["Hindi", "Tamil", "Telugu", "Kannada", "English"].map((lang) => (
            <div
              key={lang}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid rgba(0,188,212,0.3)",
                background: "rgba(0,188,212,0.1)",
                color: "#00BCD4",
                fontSize: "16px",
                fontWeight: 600,
              }}
            >
              {lang}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "32px",
            color: "rgba(255,255,255,0.4)",
            fontSize: "16px",
          }}
        >
          cogniflowautomations.com
        </div>
      </div>
    ),
    { ...size }
  );
}
