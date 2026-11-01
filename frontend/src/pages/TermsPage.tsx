import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
            to="/"
            className="px-3.5 py-2 rounded-lg border border-[#E3DDD3] bg-white hover:bg-[#F2ECE1] text-xs font-semibold text-[#0B0D13] transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft size={13} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-6 py-12 flex-1">
        <div className="bg-white rounded-2xl border border-[#E3DDD3] p-8 md:p-12 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-wider text-brand-crimson font-bold mb-2">
            Legal Terms &amp; Conditions
          </div>
          <h1 className="text-display-md font-black text-[#0B0D13] mb-4 tracking-tight">
            Terms of Service
          </h1>
          <div className="text-xs text-[#5F687A] mb-8 pb-4 border-b border-[#E3DDD3]">
            Academic Evaluation Version · Project PST_PD_143 (Group G385) · Mentor Biplove
          </div>

          <div className="space-y-6 text-xs text-[#5F687A] leading-relaxed">
            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">1. Educational Scope &amp; Intended Use</h2>
              <p>
                CodeSentinel is developed as an on-job training (OJT) capstone project under the Product Development track. It is provided for educational demonstration, code scanning verification, and security testing of controlled repositories.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">2. Scanning Boundaries &amp; Disclaimer</h2>
              <p>
                Static analysis results provided by CodeSentinel and Semgrep are heuristic indicators and do not constitute a formal guarantee of code security or compliance. A clean scan does not certify absence of all vulnerabilities, logic flaws, or zero-day exploits.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">3. Prohibited Usage</h2>
              <p>
                Operators agree not to configure CodeSentinel to analyze repositories without authorization, nor attempt to bypass safe path constraints or inject malicious executable payloads into PR review systems.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">4. Limitation of Liability</h2>
              <p>
                CodeSentinel is provided "as-is" without warranty of any kind. Under no circumstances shall the student authors, mentors, or educational institution be liable for direct or indirect damages arising from use of this software.
              </p>
            </section>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#E3DDD3] py-6 text-center text-xs text-[#5F687A] bg-[#F7F4EE]">
        CodeSentinel · Project PST_PD_143 · Group G385
      </footer>
    </div>
  );
}
