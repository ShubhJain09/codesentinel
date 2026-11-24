import { Fragment, type ReactNode } from 'react';
import type { DiffLine, FileDiff } from '../data/fixtures';
import { getRule } from '../data/rules';
import { tokenizeWithRange } from '../lib/highlight';
import { redact, type Finding } from '../lib/scanner';

interface Range {
  start: number;
  end: number;
}

/**
 * One line of source rendered as escaped text. The matched range is wrapped in a single
 * <mark> — the CodeSentinel highlight. Secret-like values are always redacted.
 */
export function CodeText({ text, mark, redactAt, sweep = false }: { text: string; mark: Range | null; redactAt?: Range | undefined; sweep?: boolean }) {
  let display = text;
  let m = mark;
  if (redactAt) {
    const masked = redact(text.slice(redactAt.start, redactAt.end));
    display = text.slice(0, redactAt.start) + masked + text.slice(redactAt.end);
    if (m && m.start === redactAt.start) m = { start: m.start, end: m.start + masked.length };
  }
  const tokens = tokenizeWithRange(display, m);
  const groups: Array<{ marked: boolean; items: typeof tokens }> = [];
  for (const t of tokens) {
    const last = groups[groups.length - 1];
    if (last && last.marked === t.marked) last.items.push(t);
    else groups.push({ marked: t.marked, items: [t] });
  }
  const spans = (items: typeof tokens, g: number) =>
    items.map((t, i) => (
      <span key={`${g}-${i}`} className={`tok tok--${t.kind}`}>
        {t.text}
      </span>
    ));
  return (
    <>
      {groups.map((grp, g) =>
        grp.marked ? (
          <mark key={g} className={`hl${sweep ? ' hl--sweep' : ''}`} title={redactAt ? 'Secret value redacted by CodeSentinel' : undefined}>
            {spans(grp.items, g)}
          </mark>
        ) : (
          <Fragment key={g}>{spans(grp.items, g)}</Fragment>
        ),
      )}
      {display.length === 0 && ' '}
    </>
  );
}

const key = (f: { filePath: string; line: number }) => `${f.filePath}:${f.line}`;

interface DiffProps {
  file: FileDiff;
  /** Findings in this file that are visible (revealed). */
  findings: readonly Finding[];
  /** All findings in this file, used only so secrets are redacted before a scan reveals them. */
  allFindings?: readonly Finding[];
  selected?: string | null;
  /** Render something directly under a flagged line (the review note). */
  renderNote?: (f: Finding) => ReactNode;
  onLineClick?: (f: Finding) => void;
  sweep?: boolean;
  /** Only show lines within this many rows of a finding (0 = all). */
  around?: number;
  label?: string;
}

/** A unified diff in the familiar GitHub shape: old · new · sign · code. */
export function Diff({ file, findings, allFindings, selected, renderNote, onLineClick, sweep = false, around = 0, label }: DiffProps) {
  const byLine = new Map(findings.map((f) => [key(f), f]));
  const secretByLine = new Map((allFindings ?? findings).filter((f) => getRule(f.ruleId).redactMatch).map((f) => [key(f), f]));
  const lines: DiffLine[] = file.hunks.flatMap((h) => h.lines);
  const flaggedIdx = lines.map((l, i) => (l.newNo !== null && byLine.has(`${file.path}:${l.newNo}`) ? i : -1)).filter((i) => i >= 0);
  const keep = (i: number) => around === 0 || flaggedIdx.some((f) => Math.abs(f - i) <= around);

  return (
    <div className="diff" role="table" aria-label={label ?? `Changes to ${file.path}`}>
      {file.hunks.map((h, hi) => (
        <Fragment key={hi}>
          {around === 0 && (
            <div className="diff__hunk" role="row">
              <span role="cell" className="mono">
                {h.header}
              </span>
            </div>
          )}
          {h.lines.map((l, li) => {
            const idx = file.hunks.slice(0, hi).reduce((n, x) => n + x.lines.length, 0) + li;
            if (!keep(idx)) return null;
            const k = l.newNo !== null ? `${file.path}:${l.newNo}` : '';
            const f = byLine.get(k);
            const secret = secretByLine.get(k);
            const isSel = !!f && f.fingerprint === selected;
            return (
              <Fragment key={`${hi}-${li}`}>
                <div
                  role="row"
                  className={[
                    'diff__row',
                    `diff__row--${l.kind}`,
                    f ? `is-flagged flag--${f.severity}` : '',
                    isSel ? 'is-selected' : '',
                  ].join(' ')}
                  data-line={l.newNo ?? undefined}
                  onClick={f && onLineClick ? () => onLineClick(f) : undefined}
                >
                  <span role="cell" className="diff__no tnum" aria-label={l.oldNo ? `Old line ${l.oldNo}` : undefined}>
                    {l.oldNo ?? ''}
                  </span>
                  <span role="cell" className="diff__no tnum" aria-label={l.newNo ? `Line ${l.newNo}` : undefined}>
                    {l.newNo ?? ''}
                  </span>
                  <span role="cell" className="diff__sign" aria-label={l.kind === 'add' ? 'Added' : l.kind === 'del' ? 'Removed' : undefined}>
                    {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ''}
                  </span>
                  <code role="cell" className="diff__code">
                    <CodeText text={l.text} mark={f ? f.range : null} redactAt={secret ? secret.range : undefined} sweep={sweep && !!f} />
                  </code>
                </div>
                {f && renderNote && (
                  <div role="row" className="diff__note-row">
                    <div role="cell">{renderNote(f)}</div>
                  </div>
                )}
              </Fragment>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
