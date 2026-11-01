import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] text-[#0B0D13] font-sans selection:bg-brand-violet/20 flex flex-col justify-between">
      <header className="sticky top-0 z-50 bg-[#F7F4EE]/90 backdrop-blur-md border-b border-[#E3DDD3]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0B0D13] text-white flex items-center justify-center font-black shadow-sm">
              <Shield size={18} className="text-white" />
            </div>
            <span className="font-black text-base tracking-tight text-[#0B0D13]">
              CodeSentinel
            </span>
          </Link>
          <Link
            to="/app"
            className="px-4 py-2 rounded-lg bg-[#0B0D13] hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
          >
            Command Center
          </Link>
        </div>
      </header>

      <div className="max-w-md w-full mx-auto text-center px-6 py-20 flex-1 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-[120px] font-black leading-none tracking-tighter text-brand-crimson select-none">
            404
          </div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#5F687A] font-bold mt-2">
            Target Resource Unresolved
          </div>
          <h1 className="text-display-sm font-black text-[#0B0D13] mt-2 tracking-tight">
            Route outside scanner boundary.
          </h1>
          <p className="text-xs text-[#5F687A] mt-3 leading-relaxed">
            The endpoint or resource you requested does not exist in the CodeSentinel workspace or has been moved.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              to="/"
              className="px-4 py-2.5 rounded-lg border border-[#E3DDD3] bg-white hover:bg-[#F2ECE1] text-xs font-semibold text-[#0B0D13] transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Home size={14} /> Back to Homepage
            </Link>
            <Link
              to="/app"
              className="px-4 py-2.5 rounded-lg bg-[#0B0D13] hover:bg-zinc-800 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <ArrowLeft size={14} /> Open Command Center
            </Link>
          </div>
        </motion.div>
      </div>

      <footer className="border-t border-[#E3DDD3] py-6 text-center text-xs text-[#5F687A] bg-[#F7F4EE]">
        CodeSentinel · Project PST_PD_143 · Group G385
      </footer>
    </div>
  );
}
