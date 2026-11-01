export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0E0F12] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logo mark */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-2xl bg-[#D946EF]/20 animate-ping" />
          <div className="relative w-12 h-12 rounded-2xl bg-[#18191E] border border-white/10 flex items-center justify-center shadow-2xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#D946EF]">
              <path
                d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="currentColor"
                opacity="0.9"
              />
              <path
                d="M9 12l2 2 4-4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white tracking-tight">CodeSentinel</p>
          <p className="text-xs text-zinc-500 mt-1">Loading workspace…</p>
        </div>
      </div>
    </div>
  );
}

