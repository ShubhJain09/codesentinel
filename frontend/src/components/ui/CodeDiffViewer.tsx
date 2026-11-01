import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Columns, AlignJustify, Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

const DEMO_DIFF: DiffLine[] = [
  { type: 'unchanged', oldLineNumber: 1, newLineNumber: 1, content: '# Pull Request Diff: handlers/calculation_engine.py' },
  { type: 'unchanged', oldLineNumber: 2, newLineNumber: 2, content: 'import ast' },
  { type: 'unchanged', oldLineNumber: 3, newLineNumber: 3, content: '' },
  { type: 'unchanged', oldLineNumber: 4, newLineNumber: 4, content: 'def execute_user_calculation(raw_expression: str):' },
  { type: 'unchanged', oldLineNumber: 5, newLineNumber: 5, content: '    """Evaluate user-supplied arithmetic expression."""' },
  { type: 'removed',   oldLineNumber: 6,                     content: '    # Flawed: Arbitrary code evaluation via built-in eval()' },
  { type: 'removed',   oldLineNumber: 7,                     content: '    # CWE-95: Improper Neutralization of Directives in Dynamically Evaluated Code' },
  { type: 'removed',   oldLineNumber: 8,                     content: '    return eval(raw_expression)  # ◄ FLAGGED BY SEMGREP 1.181.0' },
  { type: 'added',                       newLineNumber: 6,   content: '    # Remediated: Safe literal evaluation with strict syntax validation' },
  { type: 'added',                       newLineNumber: 7,   content: '    # Restricts input strictly to numbers, strings, and tuples' },
  { type: 'added',                       newLineNumber: 8,   content: '    return ast.literal_eval(raw_expression)  # ✔ SECURE IMPLEMENTATION' },
  { type: 'unchanged', oldLineNumber: 9, newLineNumber: 9, content: '' },
  { type: 'unchanged', oldLineNumber: 10, newLineNumber: 10, content: 'def health_check():' },
  { type: 'unchanged', oldLineNumber: 11, newLineNumber: 11, content: '    return {"status": "ok", "engine": "semgrep-verified"}' },
];

export function CodeDiffViewer() {
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = DEMO_DIFF.map((l) => {
      const prefix = l.type === 'removed' ? '- ' : l.type === 'added' ? '+ ' : '  ';
      return prefix + l.content;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-[#0D0F14] rounded-2xl border border-[#232731] shadow-2xl overflow-hidden font-mono text-xs">
      {/* Top Header Bar */}
      <div className="px-5 py-3.5 bg-[#14171F] border-b border-[#232731] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-zinc-400 font-sans text-xs font-semibold">
            handlers/calculation_engine.py
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            CWE-95 Flagged
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg bg-[#0D0F14] p-0.5 border border-[#232731]">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-all flex items-center gap-1.5',
                viewMode === 'split'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Columns size={12} />
              <span className="hidden sm:inline">Split View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('unified')}
              className={cn(
                'px-2.5 py-1 rounded-md text-[11px] font-sans font-medium transition-all flex items-center gap-1.5',
                viewMode === 'unified'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <AlignJustify size={12} />
              <span className="hidden sm:inline">Unified Diff</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-[#232731] bg-[#0D0F14] text-zinc-400 hover:text-zinc-100 hover:bg-[#1A1E26] transition-colors"
            title="Copy diff to clipboard"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Diff Content Viewport */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#232731] text-[11px] leading-relaxed overflow-x-auto">
          {/* Left Column: Flawed Code */}
          <div className="p-4 bg-[#0D0F14]">
            <div className="pb-2.5 mb-2.5 border-b border-[#232731] flex items-center justify-between text-rose-400 font-sans font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={13} />
                Flawed Code (PR Base / Target)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">eval() call node</span>
            </div>
            <div className="space-y-0.5">
              {DEMO_DIFF.filter((l) => l.type !== 'added').map((line, idx) => {
                const isViolation = line.type === 'removed';
                return (
                  <div
                    key={`flaw-${idx}`}
                    className={cn(
                      'flex items-start px-2 py-0.5 rounded transition-colors',
                      isViolation
                        ? 'bg-rose-950/40 text-rose-200 border-l-2 border-rose-500'
                        : 'text-zinc-400 hover:bg-white/[0.02]'
                    )}
                  >
                    <span className="w-6 shrink-0 text-right pr-3 select-none text-zinc-600 font-mono text-[10px]">
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span className="w-4 shrink-0 text-center select-none font-bold text-rose-400">
                      {isViolation ? '-' : ' '}
                    </span>
                    <span className={cn('break-all font-mono', isViolation && 'font-semibold text-rose-300')}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Remediated Code */}
          <div className="p-4 bg-[#0D0F14]">
            <div className="pb-2.5 mb-2.5 border-b border-[#232731] flex items-center justify-between text-emerald-400 font-sans font-semibold text-xs">
              <span className="flex items-center gap-1.5">
                <CheckCircle size={13} />
                Remediated Code (Proposed Patch)
              </span>
              <span className="text-[10px] text-emerald-500 font-mono">AST Verified Clean</span>
            </div>
            <div className="space-y-0.5">
              {DEMO_DIFF.filter((l) => l.type !== 'removed').map((line, idx) => {
                const isFix = line.type === 'added';
                return (
                  <div
                    key={`fix-${idx}`}
                    className={cn(
                      'flex items-start px-2 py-0.5 rounded transition-colors',
                      isFix
                        ? 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500'
                        : 'text-zinc-400 hover:bg-white/[0.02]'
                    )}
                  >
                    <span className="w-6 shrink-0 text-right pr-3 select-none text-zinc-600 font-mono text-[10px]">
                      {line.newLineNumber ?? ''}
                    </span>
                    <span className="w-4 shrink-0 text-center select-none font-bold text-emerald-400">
                      {isFix ? '+' : ' '}
                    </span>
                    <span className={cn('break-all font-mono', isFix && 'font-semibold text-emerald-300')}>
                      {line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Unified View */
        <div className="p-4 overflow-x-auto text-[11px] leading-relaxed">
          <div className="space-y-0.5">
            {DEMO_DIFF.map((line, idx) => {
              const isRem = line.type === 'removed';
              const isAdd = line.type === 'added';
              return (
                <div
                  key={`uni-${idx}`}
                  className={cn(
                    'flex items-start px-2 py-0.5 rounded font-mono transition-colors',
                    isRem && 'bg-rose-950/40 text-rose-200 border-l-2 border-rose-500',
                    isAdd && 'bg-emerald-950/40 text-emerald-200 border-l-2 border-emerald-500',
                    !isRem && !isAdd && 'text-zinc-400 hover:bg-white/[0.02]'
                  )}
                >
                  <span className="w-6 shrink-0 text-right pr-2 select-none text-zinc-600 text-[10px]">
                    {line.oldLineNumber ?? ''}
                  </span>
                  <span className="w-6 shrink-0 text-right pr-3 select-none text-zinc-600 text-[10px]">
                    {line.newLineNumber ?? ''}
                  </span>
                  <span
                    className={cn(
                      'w-4 shrink-0 text-center select-none font-bold',
                      isRem && 'text-rose-400',
                      isAdd && 'text-emerald-400',
                      !isRem && !isAdd && 'text-zinc-600'
                    )}
                  >
                    {isRem ? '-' : isAdd ? '+' : ' '}
                  </span>
                  <span
                    className={cn(
                      'break-all',
                      isRem && 'font-semibold text-rose-300',
                      isAdd && 'font-semibold text-emerald-300'
                    )}
                  >
                    {line.content}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Verdict Bar */}
      <div className="px-5 py-3 bg-[#11131A] border-t border-[#232731] flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-sans text-[11px]">
            Semgrep Rule: <code className="text-zinc-300">rules.codesentinel.demo.python-eval</code>
          </span>
        </div>
        <div className="font-sans text-[11px] text-zinc-500">
          Result: <strong className="text-emerald-400">0 Findings Detected</strong> after remediation
        </div>
      </div>
    </div>
  );
}

export default CodeDiffViewer;
