import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg, #ffffff)" }}>
      <div className="text-center px-6">
        <h1 className="text-8xl font-bold mb-2" style={{ color: "#00BCD4" }}>404</h1>
        <h2 className="text-2xl font-semibold mb-4" style={{ color: "var(--color-text, #0F172A)" }}>Page not found</h2>
        <p className="text-lg mb-8" style={{ color: "var(--color-text-muted, #475569)" }}>
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 font-semibold rounded-lg transition-colors text-white"
          style={{ background: "#00BCD4" }}
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
