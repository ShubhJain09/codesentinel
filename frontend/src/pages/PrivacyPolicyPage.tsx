import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            Legal &amp; Privacy Safeguards
          </div>
          <h1 className="text-display-md font-black text-[#0B0D13] mb-4 tracking-tight">
            Privacy Policy
          </h1>
          <div className="text-xs text-[#5F687A] mb-8 pb-4 border-b border-[#E3DDD3]">
            Effective Date: October 2026 · College OJT Project PST_PD_143 (Group G385)
          </div>

          <div className="space-y-6 text-xs text-[#5F687A] leading-relaxed">
            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">1. Scope of Data Processing</h2>
              <p>
                CodeSentinel is an on-premises and local developer security operations platform designed for automated static analysis of pull requests. CodeSentinel does not sell, market, or share developer source code, revision metadata, or vulnerability reports with any third-party advertisers.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">2. Source Code Handling &amp; Isolation</h2>
              <p>
                Code files fetched during pull-request analysis are treated strictly as read-only static text. Files are temporarily saved to ephemeral, random scratch directories (<code className="font-mono bg-[#EDE8DF] px-1 py-0.5 rounded text-[#0B0D13]">mkdtemp</code>), analyzed locally via the Semgrep CLI, and purged immediately upon scan termination.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">3. Session &amp; Credential Security</h2>
              <p>
                Operator passwords are never stored in plaintext; they are hashed using standard PBKDF2-SHA256 with 200,000 computational rounds. Session authentication uses cryptographically secure, random 256-bit tokens transferred exclusively via HTTP-only, SameSite=Lax cookies.
              </p>
            </section>

            <section>
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">4. Analytics &amp; Telemetry Transparency</h2>
              <p>
                This prototype does not load invasive surveillance trackers or third-party behavioral fingerprinting. Semgrep metrics reporting is explicitly disabled (<code className="font-mono bg-[#EDE8DF] px-1 py-0.5 rounded text-[#0B0D13]">SEMGREP_SEND_METRICS=off</code>).
              </p>
            </section>

            <section className="pt-4 border-t border-[#E3DDD3]">
              <h2 className="text-sm font-bold text-[#0B0D13] mb-2">5. Cookie &amp; Telemetry Preference Controls</h2>
              <p className="mb-4">
                You can adjust or reset your local cookie and interface telemetry choices at any time:
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    localStorage.removeItem('codesentinel_privacy_consent');
                    window.dispatchEvent(new CustomEvent('codesentinel-open-privacy-preferences'));
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E3DDD3] bg-[#EDE8DF] hover:bg-[#E3DDD3] text-xs font-semibold text-[#0B0D13] transition-all"
                >
                  Re-open Privacy Preferences Banner
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('codesentinel_privacy_consent');
                    alert('Local preferences reset.');
                  }}
                  className="px-3.5 py-2 rounded-lg border border-[#E3DDD3] bg-white hover:bg-[#F2ECE1] text-xs font-semibold text-[#5F687A] transition-all"
                >
                  Reset Local Storage
                </button>
              </div>
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
