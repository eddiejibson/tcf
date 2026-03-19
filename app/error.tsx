"use client";

export default function RootError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#1a1f26] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-white font-semibold text-lg mb-2">Something went wrong</h2>
        <p className="text-white/50 text-sm mb-6">Please try again or reload the page.</p>
        <div className="flex gap-3">
          <button onClick={reset} className="flex-1 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl transition-all text-sm">
            Try Again
          </button>
          <button onClick={() => window.location.reload()} className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-all text-sm">
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}
