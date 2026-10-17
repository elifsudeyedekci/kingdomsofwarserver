export default function RootLoading() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-5">
      {/* Spinner */}
      <svg
        className="w-10 h-10 text-amber-500 animate-spin"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>

      <p className="text-sm text-gray-400 tracking-wide">Loading Kingdoms of War Admin...</p>
    </div>
  );
}
