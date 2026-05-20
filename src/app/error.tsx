"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center px-6">
        <h1 className="text-4xl font-bold text-text mb-4">Something went wrong</h1>
        <p className="text-lg text-text-muted mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-block px-6 py-3 bg-brand text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
