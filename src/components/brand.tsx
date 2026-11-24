import type { ReactNode } from 'react';
import { CheckCircle, Circle, CircleHalf, Prohibit, X, Minus } from '@phosphor-icons/react';
import { SEVERITY_LABEL, type Severity } from '../data/rules';
import type { ReviewStatus } from '../lib/store';
import { STATUS_LABEL } from '../lib/store';

/** The CodeSentinel mark: three lines of code, the middle one highlighted. */
export function Mark({ size = 24, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="mark"
    >
      <rect x="3" y="3.75" width="11" height="3.25" rx="1.6" fill="var(--ink-3)" />
      <rect x="1.75" y="9.5" width="20.5" height="5" rx="2.5" fill="var(--marker)" stroke="var(--ink-1)" strokeWidth="1.3" />
      <rect x="3" y="17" width="14.5" height="3.25" rx="1.6" fill="var(--ink-3)" />
    </svg>
  );
}

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size * 0.72 }}>
      <Mark size={size} />
      <span className="wordmark__text">CodeSentinel</span>
    </span>
  );
}

const SEV_GLYPH: Record<Severity, ReactNode> = {
  critical: <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill="currentColor" />,
  high: <path d="M6 1.2 11.3 10.4H0.7Z" fill="currentColor" />,
  medium: <circle cx="6" cy="6" r="4.4" fill="currentColor" />,
  low: <circle cx="6" cy="6" r="3.8" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  info: <circle cx="6" cy="6" r="2" fill="currentColor" />,
};

export function SeverityGlyph({ severity, size = 11 }: { severity: Severity; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      {SEV_GLYPH[severity]}
    </svg>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`sev sev--${severity}`}>
      <SeverityGlyph severity={severity} />
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const STATUS_ICON: Record<ReviewStatus, ReactNode> = {
  open: <Circle size={16} weight="regular" />,
  in_review: <CircleHalf size={16} weight="fill" />,
  resolved: <CheckCircle size={16} weight="fill" />,
  accepted_risk: <Prohibit size={16} weight="regular" />,
};

export function StatusLabel({ status }: { status: ReviewStatus }) {
  return (
    <span className={`status status--${status}`}>
      {STATUS_ICON[status]}
      {STATUS_LABEL[status]}
    </span>
  );
}

export type OutcomeKind = 'findings' | 'clean' | 'failed' | 'not_run';

export function OutcomeBanner({
  kind,
  title,
  children,
  topSeverity,
  action,
}: {
  kind: OutcomeKind;
  title: string;
  children?: ReactNode;
  topSeverity?: Severity | undefined;
  action?: ReactNode;
}) {
  const icon =
    kind === 'findings' && topSeverity ? (
      <span className={`outcome__icon sev--${topSeverity}`}>
        <SeverityGlyph severity={topSeverity} size={14} />
      </span>
    ) : kind === 'clean' ? (
      <span className="outcome__icon outcome__icon--clean">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2.4" />
          <path d="m5.8 9.2 2.2 2.2 4.2-4.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ) : kind === 'failed' ? (
      <span className="outcome__icon outcome__icon--failed">
        <X size={16} weight="bold" />
      </span>
    ) : (
      <span className="outcome__icon outcome__icon--idle">
        <Minus size={16} weight="bold" />
      </span>
    );
  return (
    <div className={`outcome outcome--${kind}${topSeverity ? ` outcome--sev-${topSeverity}` : ''}`} role="status">
      {icon}
      <div className="outcome__body">
        <p className="outcome__title">{title}</p>
        {children && <div className="outcome__text">{children}</div>}
      </div>
      {action && <div className="outcome__action">{action}</div>}
    </div>
  );
}
