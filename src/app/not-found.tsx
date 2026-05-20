import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center px-6">
        <h1 className="text-6xl font-bold text-brand mb-4">404</h1>
        <p className="text-xl text-text-muted mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-brand text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
