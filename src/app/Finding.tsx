import { ArrowLeft, CaretLeft, CaretRight, Check, Copy, FileCode } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SeverityBadge, SeverityGlyph, StatusLabel } from '../components/brand';
import { Diff } from '../components/code';
import { ReviewNote } from '../components/note';
import { RULESET_VERSION, getRule } from '../data/rules';
import {
  STATUS_HINT,
  STATUS_LABEL,
  findScan,
  findingsFor,
  formatTime,
  prOf,
  reviewOf,
  setReview,
  useStore,
  type ReviewStatus,
} from '../lib/store';
import { Crumbs } from './Shell';
import { NotFound } from './pages';

const ORDER: ReviewStatus[] = ['open', 'in_review', 'resolved', 'accepted_risk'];

function Decision({ fingerprint }: { fingerprint: string }) {
  const s = useStore();
  const rec = reviewOf(s, fingerprint);
  const [pending, setPending] = useState<ReviewStatus | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState<'ok' | 'session' | null>(null);
  const reasonId = useId();
  const groupId = useId();

  useEffect(() => {
    setPending(null);
    setReason('');
    setSaved(null);
  }, [fingerprint]);

  const choose = (st: ReviewStatus) => {
    if (st === 'accepted_risk') {
      setPending(st);
      setSaved(null);
      return;
    }
    setPending(null);
    setSaved(setReview(fingerprint, st) ? 'ok' : 'session');
  };

  const value = pending ?? rec.status;

  return (
    <section className="panel" aria-labelledby={`${groupId}-h`}>
      <h2 className="panel__title" id={`${groupId}-h`}>
        Review decision
      </h2>
      <p className="panel__hint">Record what should happen with this finding. It does not change the scan result.</p>
      <fieldset className="decision" aria-labelledby={`${groupId}-h`}>
        {ORDER.map((st) => (
          <label key={st} className={`decision__opt${value === st ? ' is-on' : ''}`}>
            <input type="radio" name={`decision-${fingerprint}`} value={st} checked={value === st} onChange={() => choose(st)} />
            <span className="decision__radio" aria-hidden="true" />
            <span className="decision__text">
              <span className="decision__label">{STATUS_LABEL[st]}</span>
              <span className="decision__hint">{STATUS_HINT[st]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {pending === 'accepted_risk' && (
        <form
          className="decision__reason"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 8) return;
            setSaved(setReview(fingerprint, 'accepted_risk', reason.trim()) ? 'ok' : 'session');
            setPending(null);
            setReason('');
          }}
        >
          <label htmlFor={reasonId} className="field__label">
            Why is this risk acceptable?
          </label>
          <textarea
            id={reasonId}
            className="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: only used in local development, overridden in production"
            aria-describedby={`${reasonId}-hint`}
          />
          <p id={`${reasonId}-hint`} className="field__hint">
            Required, at least 8 characters.
          </p>
          <div className="decision__actions">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={reason.trim().length < 8}>
              Save decision
            </button>
          </div>
        </form>
      )}

      <p className="decision__saved" role="status">
        {saved === 'ok' && (
          <>
            <Check size={14} weight="bold" /> Saved in this browser
          </>
        )}
        {saved === 'session' && <>Saved for this session only — browser storage is unavailable</>}
      </p>

      {rec.history.length > 0 && (
        <>
          <h3 className="panel__sub">History</h3>
          <ol className="history">
            {[...rec.history].reverse().map((e) => (
              <li key={e.at}>
                <StatusLabel status={e.status} />
                <span className="history__meta">
                  {e.actor} · {formatTime(e.at)}
                </span>
                {e.reason && <span className="history__reason">“{e.reason}”</span>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export function Finding() {
  const { scanId = '', fp = '' } = useParams();
  const s = useStore();
  const navigate = useNavigate();
  const scan = findScan(s, scanId);
  const [copied, setCopied] = useState(false);
  const [allLines, setAllLines] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  if (!scan) return <NotFound what="scan" />;
  const pr = prOf(scan);
  const findings = findingsFor(pr);
  const index = findings.findIndex((f) => f.fingerprint === fp);
  const finding = findings[index];
  if (!finding) return <NotFound what="finding" />;
  const rule = getRule(finding.ruleId);
  const file = pr.files.find((f) => f.path === finding.filePath)!;
  const prev = findings[index - 1];
  const next = findings[index + 1];
  const location = `${finding.filePath}:${finding.line}`;
  const reportHref = `/app/scans/${scan.id}`;
  const hrefFor = (f: { fingerprint: string }) => `/app/scans/${scan.id}/findings/${f.fingerprint}`;

  const jump = () => {
    const row = codeRef.current?.querySelector<HTMLElement>(`[data-line="${finding.line}"]`);
    row?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    row?.classList.remove('is-pulsed');
    void row?.offsetWidth;
    row?.classList.add('is-pulsed');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page page--finding">
      <header className="fhead">
        <Crumbs>
          <Link to="/app/scans">Scans</Link>
          <CaretRight size={12} aria-hidden="true" />
          <Link to={reportHref}>
            {scan.id} · {pr.repo} #{pr.number}
          </Link>
          <CaretRight size={12} aria-hidden="true" />
          <span aria-current="page">
            Finding {index + 1} of {findings.length}
          </span>
        </Crumbs>

        <div className="fhead__bar">
          <Link to={reportHref} className="btn btn--secondary btn--sm">
            <ArrowLeft size={16} weight="bold" />
            Back to scan report
          </Link>
          <div className="fhead__step" role="group" aria-label="Move between findings">
            <button type="button" className="btn btn--ghost btn--sm" disabled={!prev} onClick={() => prev && navigate(hrefFor(prev))}>
              <CaretLeft size={16} weight="bold" />
              Previous
            </button>
            <span className="fhead__pos tnum">
              {index + 1} / {findings.length}
            </span>
            <button type="button" className="btn btn--ghost btn--sm" disabled={!next} onClick={() => next && navigate(hrefFor(next))}>
              Next
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        <div className="fhead__main">
          <SeverityBadge severity={finding.severity} />
          <h1 className="fhead__title">{rule.name}</h1>
          <p className="fhead__summary">{rule.summary}</p>
          <div className="fhead__loc">
            <button type="button" className="loc" onClick={jump}>
              <FileCode size={18} aria-hidden="true" />
              <span className="mono">{finding.filePath}</span>
              <span className="loc__line">line {finding.line}</span>
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
              {copied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy location'}
            </button>
          </div>
        </div>
      </header>

      <div className="flayout">
        <section className="codecard" aria-label={`Source of ${finding.filePath}`} ref={codeRef}>
          <header className="codecard__head">
            <span className="mono codecard__path">
              <span className="codecard__dir">{finding.filePath.slice(0, finding.filePath.lastIndexOf('/') + 1)}</span>
              {finding.filePath.slice(finding.filePath.lastIndexOf('/') + 1)}
            </span>
            <span className="chip">{file.status === 'added' ? 'New file in this pull request' : 'Changed in this pull request'}</span>
            <span className="codecard__stats tnum" aria-label={`${file.additions} lines added, ${file.deletions} removed`}>
              <span className="add">+{file.additions}</span> <span className="del">−{file.deletions}</span>
            </span>
            <button type="button" className="btn btn--ghost btn--sm codecard__toggle" aria-pressed={allLines} onClick={() => setAllLines((v) => !v)}>
              {allLines ? 'Show lines near the finding' : 'Show all changed lines'}
            </button>
          </header>
          <Diff
            file={file}
            findings={[finding]}
            allFindings={findings}
            selected={finding.fingerprint}
            renderNote={(f) => <ReviewNote finding={f} variant="full" headingLevel={2} hideTitle />}
            around={allLines ? 0 : 3}
            sweep
          />
          {!allLines && (
            <button type="button" className="codecard__more" onClick={() => setAllLines(true)}>
              Showing lines near the finding · show all {file.hunks.reduce((n, h) => n + h.lines.length, 0)} changed lines
            </button>
          )}
          <p className="codecard__foot">Code is shown as text and never executed. Secret-like values are redacted.</p>
        </section>

        <aside className="fside" aria-label="Decision and details">
          <Decision fingerprint={finding.fingerprint} />

          <section className="panel" aria-labelledby="facts-h">
            <h2 className="panel__title" id="facts-h">
              Finding details
            </h2>
            <dl className="facts">
              <div>
                <dt>Rule</dt>
                <dd>
                  {rule.id} · {rule.category}
                </dd>
              </div>
              <div>
                <dt>Weakness</dt>
                <dd>{rule.cwe}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd className="mono">{location}</dd>
              </div>
              <div>
                <dt>Detected</dt>
                <dd>{formatTime(scan.startedAt)}</dd>
              </div>
              <div>
                <dt>Scan</dt>
                <dd>
                  {scan.id} · {scan.origin === 'sample' ? 'sample record' : 'run in this browser'}
                </dd>
              </div>
              <div>
                <dt>Ruleset</dt>
                <dd>{RULESET_VERSION}</dd>
              </div>
              <div>
                <dt>Finding ID</dt>
                <dd className="mono">{finding.fingerprint}</dd>
              </div>
            </dl>
          </section>

          <section className="panel" aria-labelledby="others-h">
            <h2 className="panel__title" id="others-h">
              In this scan
            </h2>
            <ol className="others">
              {findings.map((f, i) => (
                <li key={f.fingerprint}>
                  <Link to={hrefFor(f)} className={`others__row${f.fingerprint === finding.fingerprint ? ' is-current' : ''}`} aria-current={f.fingerprint === finding.fingerprint ? 'page' : undefined}>
                    <span className={`others__glyph sev-fg--${f.severity}`}>
                      <SeverityGlyph severity={f.severity} />
                    </span>
                    <span className="others__text">
                      <span className="others__title">
                        {i + 1}. {getRule(f.ruleId).name}
                      </span>
                      <span className="others__loc mono">
                        {f.filePath.split('/').pop()}:{f.line}
                      </span>
                    </span>
                    <StatusLabel status={reviewOf(s, f.fingerprint).status} />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
