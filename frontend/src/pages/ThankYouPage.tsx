import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, ArrowRight, Home } from 'lucide-react';

export default function ThankYouPage() {
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
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center mb-5 shadow-sm">
            <CheckCircle size={32} />
          </div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
            Transmission Confirmed
          </div>
          <h1 className="text-display-sm font-black text-[#0B0D13] mt-2 tracking-tight">
            Thank you for connecting.
          </h1>
          <p className="text-xs text-[#5F687A] mt-3 leading-relaxed">
            Your demonstration inquiry or security feedback has been logged in the audit trail.
            Our team (Group G385) monitors this project during academic evaluation hours.
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
              <span>Launch Workspace</span>
              <ArrowRight size={14} />
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
