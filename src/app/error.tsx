"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg, #ffffff)" }}>
      <div className="text-center px-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "rgba(0,188,212,0.1)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00BCD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--color-text, #0F172A)" }}>Something went wrong</h1>
        <p className="text-lg mb-8" style={{ color: "var(--color-text-muted, #475569)" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-3 font-semibold rounded-lg transition-colors text-white"
          style={{ background: "#00BCD4" }}
          onMouseEnter={e => e.currentTarget.style.background = "#0097A7"}
          onMouseLeave={e => e.currentTarget.style.background = "#00BCD4"}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
