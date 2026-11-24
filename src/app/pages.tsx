import { ArrowRight, CaretRight, CloudArrowUp, GitPullRequest, GithubLogo, Play } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { OutcomeBanner, SeverityBadge, StatusLabel } from '../components/brand';
import { PULL_REQUESTS, prKey } from '../data/fixtures';
import { RULES, RULESET_VERSION, SEVERITY_ORDER, getRule } from '../data/rules';
import type { ScanResult } from '../lib/scanner';
import { allScans, findScan, findingsFor, formatTime, prOf, recordScan, resultFor, reviewOf, useStore, type ScanRecord } from '../lib/store';
import { Crumbs } from './Shell';

export function PageHead({ title, description, crumbs, action }: { title: string; description?: ReactNode; crumbs?: ReactNode; action?: ReactNode }) {
  return (
    <header className="phead">
      {crumbs}
      <div className="phead__row">
        <h1 className="phead__title">{title}</h1>
        {action}
      </div>
      {description && <p className="phead__desc">{description}</p>}
    </header>
  );
}

function outcomeOf(result: ScanResult) {
  const o = result.outcome;
  if (o.kind === 'findings') {
    const top = SEVERITY_ORDER.find((s) => o.findings.some((f) => f.severity === s));
    const crit = o.findings.filter((f) => f.severity === 'critical').length;
    const high = o.findings.filter((f) => f.severity === 'high').length;
    const detail = [crit && `${crit} critical`, high && `${high} high`].filter(Boolean).join(', ');
    return { kind: 'findings' as const, top, title: `${o.findings.length} findings need review`, text: detail ? `Including ${detail}. Each one is a potential issue to review, not proof of a vulnerability.` : 'Each one is a potential issue to review, not proof of a vulnerability.' };
  }
  if (o.kind === 'clean')
    return { kind: 'clean' as const, top: undefined, title: 'No configured rule matched', text: `None of the ${RULES.length} rules matched the ${result.linesScanned} added lines. This is not a security guarantee — it only means these patterns were not found.` };
  return { kind: 'failed' as const, top: undefined, title: 'Scan failed — no result was produced', text: `${o.reason}. The scanner stopped before any rule ran, so this is not a clean result. Remove or replace the file, then scan again.` };
}

function OutcomeChip({ result }: { result: ScanResult }) {
  const o = outcomeOf(result);
  return <span className={`ochip ochip--${o.kind}`}>{o.kind === 'findings' ? `${(result.outcome as { findings: unknown[] }).findings.length} findings` : o.kind === 'clean' ? 'No rule matched' : 'Failed'}</span>;
}

/* ---------- Home ---------- */

export function Home() {
  const s = useStore();
  const latest = allScans(s)[0];
  const sample = allScans(s).find((x) => x.repo === 'demo-auth-service');
  const first = sample ? findingsFor(prOf(sample))[0] : undefined;
  return (
    <div className="page">
      <PageHead
        title="Welcome to CodeSentinel"
        description="Scan a pull request, read what CodeSentinel found, and record a decision. This prototype uses three sample pull requests."
        action={
          <Link to="/app/new-scan" className="btn btn--primary">
            New scan
          </Link>
        }
      />
      <section className="steps" aria-labelledby="steps-h">
        <h2 id="steps-h" className="section-h">
          Get started in three steps
        </h2>
        <ol className="steps__list">
          <li className="step">
            <span className="step__n">1</span>
            <div>
              <h3 className="step__title">Scan a pull request</h3>
              <p className="step__text">Pick one of the sample pull requests. The five documented rules run in your browser.</p>
              <Link to="/app/new-scan" className="btn btn--secondary btn--sm">
                Start a new scan
              </Link>
            </div>
          </li>
          <li className="step">
            <span className="step__n">2</span>
            <div>
              <h3 className="step__title">Read the scan report</h3>
              <p className="step__text">The report says plainly whether the scan found issues, found nothing, or failed.</p>
              {latest && (
                <Link to={`/app/scans/${latest.id}`} className="btn btn--secondary btn--sm">
                  Open the latest report
                </Link>
              )}
            </div>
          </li>
          <li className="step">
            <span className="step__n">3</span>
            <div>
              <h3 className="step__title">Investigate a finding</h3>
              <p className="step__text">See the exact line, why it matters, and a safer way to write it.</p>
              {sample && first && (
                <Link to={`/app/scans/${sample.id}/findings/${first.fingerprint}`} className="btn btn--secondary btn--sm">
                  Open a sample finding
                </Link>
              )}
            </div>
          </li>
        </ol>
      </section>
      <GateNote>Home's activity, “Needs attention” and recent work are designed in the next gate.</GateNote>
    </div>
  );
}

/* ---------- Scans ---------- */

export function Scans() {
  const s = useStore();
  return (
    <div className="page">
      <PageHead
        title="Scans"
        description="Every scan, newest first. Open one to see its report."
        action={
          <Link to="/app/new-scan" className="btn btn--primary">
            New scan
          </Link>
        }
      />
      <ul className="list">
        {allScans(s).map((scan) => {
          const pr = prOf(scan);
          return (
            <li key={scan.id}>
              <Link to={`/app/scans/${scan.id}`} className="list__row">
                <GitPullRequest size={20} className="list__icon" aria-hidden="true" />
                <span className="list__main">
                  <span className="list__title">{pr.title}</span>
                  <span className="list__sub">
                    {pr.repo} #{pr.number} · <span className="mono">{scan.id}</span> · {formatTime(scan.startedAt)} · {scan.origin === 'sample' ? 'Sample record' : 'Run in this browser'}
                  </span>
                </span>
                <OutcomeChip result={resultFor(pr)} />
                <CaretRight size={16} className="list__chev" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Scan report (minimal hub for this gate) ---------- */

export function ScanReport() {
  const { scanId = '' } = useParams();
  const s = useStore();
  const scan = findScan(s, scanId);
  if (!scan) return <NotFound what="scan" />;
  const pr = prOf(scan);
  const result = resultFor(pr);
  const o = outcomeOf(result);
  const findings = findingsFor(pr);
  const first = findings[0];

  return (
    <div className="page">
      <PageHead
        crumbs={
          <Crumbs>
            <Link to="/app/scans">Scans</Link>
            <CaretRight size={12} aria-hidden="true" />
            <span aria-current="page">{scan.id}</span>
          </Crumbs>
        }
        title={pr.title}
        description={
          <span className="meta">
            <span>
              {pr.repo} <span className="mono">#{pr.number}</span>
            </span>
            <span className="mono">
              {pr.branch} → {pr.base}
            </span>
            <span>by {pr.author}</span>
            <span>
              <span className="mono">{scan.id}</span> · {formatTime(scan.startedAt)}
            </span>
            <span className="chip chip--sample">{scan.origin === 'sample' ? 'Sample record' : 'Run in this browser'}</span>
          </span>
        }
      />
      <OutcomeBanner
        kind={o.kind}
        title={o.title}
        topSeverity={o.top}
        action={
          first ? (
            <Link to={`/app/scans/${scan.id}/findings/${first.fingerprint}`} className="btn btn--primary">
              Start review
              <ArrowRight size={16} weight="bold" />
            </Link>
          ) : undefined
        }
      >
        {o.text}
      </OutcomeBanner>

      {findings.length > 0 && (
        <section className="report-findings" aria-labelledby="rf-h">
          <h2 id="rf-h" className="section-h">
            Findings
          </h2>
          <ul className="list">
            {findings.map((f) => (
              <li key={f.fingerprint}>
                <Link to={`/app/scans/${scan.id}/findings/${f.fingerprint}`} className="list__row">
                  <SeverityBadge severity={f.severity} />
                  <span className="list__main">
                    <span className="list__title">{getRule(f.ruleId).name}</span>
                    <span className="list__sub mono">
                      {f.filePath}:{f.line}
                    </span>
                  </span>
                  <StatusLabel status={reviewOf(s, f.fingerprint).status} />
                  <CaretRight size={16} className="list__chev" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="report-meta">
        {result.filesScanned} files · {result.linesScanned} added lines checked · {RULESET_VERSION} · rules run in your browser, not Semgrep
      </p>
      <GateNote>The report's “Files changed”, “Scan details” and export tabs are designed in the next gate.</GateNote>
    </div>
  );
}

/* ---------- New scan (minimal for this gate) ---------- */

export function NewScan() {
  const navigate = useNavigate();
  const [pick, setPick] = useState(prKey(PULL_REQUESTS[0]!));
  const run = () => {
    const pr = PULL_REQUESTS.find((p) => prKey(p) === pick);
    if (!pr) return;
    const rec = recordScan(pr);
    navigate(`/app/scans/${rec.id}`);
  };
  return (
    <div className="page page--narrow">
      <PageHead title="New scan" description="Choose what to scan. CodeSentinel checks the lines a pull request adds against five documented rules." />
      <section aria-labelledby="src-h" className="ns-section">
        <h2 id="src-h" className="section-h">
          1. What do you want to scan?
        </h2>
        <div className="sources">
          <div className="source is-on">
            <GitPullRequest size={22} aria-hidden="true" />
            <span className="source__title">Sample pull request</span>
            <span className="source__text">Controlled examples written for this prototype</span>
          </div>
          <div className="source is-disabled" aria-disabled="true">
            <CloudArrowUp size={22} aria-hidden="true" />
            <span className="source__title">Upload files</span>
            <span className="source__text">Designed in the next gate</span>
          </div>
          <div className="source is-disabled" aria-disabled="true">
            <GithubLogo size={22} aria-hidden="true" />
            <span className="source__title">Connected repository</span>
            <span className="source__text">Needs GitHub integration — planned, not available</span>
          </div>
        </div>
        <fieldset className="pick">
          <legend className="field__label">Sample pull request</legend>
          {PULL_REQUESTS.map((pr) => (
            <label key={prKey(pr)} className={`pick__opt${pick === prKey(pr) ? ' is-on' : ''}`}>
              <input type="radio" name="pr" checked={pick === prKey(pr)} onChange={() => setPick(prKey(pr))} />
              <span className="decision__radio" aria-hidden="true" />
              <span className="pick__text">
                <span className="pick__title">{pr.title}</span>
                <span className="pick__sub">
                  {pr.repo} #{pr.number} · {pr.files.length} files changed
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
      <section aria-labelledby="rules-h" className="ns-section">
        <h2 id="rules-h" className="section-h">
          2. What will be checked
        </h2>
        <ul className="rulelist">
          {RULES.map((r) => (
            <li key={r.id}>
              <span className="mono rulelist__id">{r.id}</span> {r.name}
            </li>
          ))}
        </ul>
      </section>
      <div className="ns-run">
        <button type="button" className="btn btn--primary btn--lg" onClick={run}>
          <Play size={18} weight="fill" />
          Run scan
        </button>
        <p className="field__hint">Runs instantly in your browser. Nothing is uploaded.</p>
      </div>
    </div>
  );
}

/* ---------- Placeholders ---------- */

const PLANNED: Record<string, { title: string; text: string }> = {
  findings: { title: 'Findings', text: 'A filterable list of open findings across every repository, by severity, status, rule and repository.' },
  repositories: { title: 'Repositories', text: 'Add a sample repository or (later) connect GitHub, then see its pull requests and scans.' },
  rules: { title: 'Rules', text: 'Each of the five rules with examples it flags, examples it ignores, and its known limitations.' },
  members: { title: 'Members', text: 'Owners and admins invite people and assign roles. Accounts are not built in this prototype.' },
  settings: { title: 'Settings', text: 'Workspace settings for owners and admins. Not built in this prototype.' },
  help: { title: 'Help', text: 'How CodeSentinel scans, what each outcome means, and what it cannot detect.' },
};

export function Planned() {
  const { pathname } = useLocation();
  const key = pathname.split('/')[2] ?? '';
  const p = PLANNED[key] ?? { title: 'Not built yet', text: 'This area is outside the current design gate.' };
  return (
    <div className="page">
      <PageHead title={p.title} />
      <div className="planned">
        <p className="planned__badge">Next design gate</p>
        <p className="planned__text">{p.text}</p>
        <p className="planned__text">This gate focuses on the homepage, the design system and the finding page.</p>
        <div className="planned__actions">
          <Link to="/app/new-scan" className="btn btn--primary">
            New scan
          </Link>
          <Link to="/app" className="btn btn--secondary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="page">
      <PageHead title={`This ${what} doesn't exist`} description="It may have been a scan from another browser — records are stored locally." />
      <Link to="/app/scans" className="btn btn--secondary">
        Go to Scans
      </Link>
    </div>
  );
}

function GateNote({ children }: { children: ReactNode }) {
  return <p className="gatenote">{children}</p>;
}

export type { ScanRecord };
