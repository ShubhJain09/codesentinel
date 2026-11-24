import { ArrowRight, Browser, FileCode, GitPullRequest, ListChecks, LockSimple, Play } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeverityGlyph, Wordmark } from '../components/brand';
import { Diff } from '../components/code';
import { ReviewNote } from '../components/note';
import { SEVERITY_LABEL, SEVERITY_ORDER } from '../data/rules';
import type { Finding } from '../lib/scanner';
import { SAMPLE_PR, SAMPLE_SCANS, findingsFor, useReducedMotion, useTheme } from '../lib/store';

const PR = SAMPLE_PR;
const ALL = findingsFor(PR);
const SAMPLE_SCAN_ID = SAMPLE_SCANS.find((s) => s.repo === PR.repo)!.id;

function Demo({ reviewed, onReview }: { reviewed: boolean; onReview: () => void }) {
  const [active, setActive] = useState('src/db/users.js');
  const reduced = useReducedMotion();
  const shown = useMemo(() => (reviewed ? ALL : []), [reviewed]);
  const file = PR.files.find((f) => f.path === active) ?? PR.files[0]!;
  const counts = useMemo(() => SEVERITY_ORDER.map((s) => [s, ALL.filter((f) => f.severity === s).length] as const).filter(([, n]) => n > 0), []);
  const codeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pane = codeRef.current;
    const target = shown.find((f) => f.filePath === active);
    if (!pane || !target) return;
    const row = pane.querySelector<HTMLElement>(`[data-line="${target.line}"]`);
    if (!row) return;
    const top = row.offsetTop - 120;
    pane.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }, [reviewed, active, shown, reduced]);
  const adds = PR.files.reduce((n, f) => n + f.additions, 0);
  const dels = PR.files.reduce((n, f) => n + f.deletions, 0);

  return (
    <div className={`demo${reviewed ? ' is-reviewed' : ''}`}>
      <header className="demo__head">
        <GitPullRequest size={22} className="demo__pr-icon" aria-hidden="true" />
        <div className="demo__titles">
          <p className="demo__title">
            {PR.title} <span className="demo__num">#{PR.number}</span>
          </p>
          <p className="demo__meta">
            <span className="mono">{PR.repo}</span> · {PR.author} wants to merge <span className="mono demo__branch">{PR.branch}</span> into{' '}
            <span className="mono demo__branch">{PR.base}</span>
          </p>
        </div>
        <div className="demo__action" aria-live="polite">
          {!reviewed ? (
            <button type="button" className="btn btn--primary" onClick={onReview}>
              <Play size={16} weight="fill" />
              Review with CodeSentinel
            </button>
          ) : (
            <div className="demo__summary">
              <span className="demo__summary-n">{ALL.length} findings</span>
              <span className="demo__summary-sev">
                {counts.map(([s, n]) => (
                  <span key={s} className={`sev-fg--${s}`} title={`${n} ${SEVERITY_LABEL[s]}`}>
                    <SeverityGlyph severity={s} /> {n} {SEVERITY_LABEL[s].toLowerCase()}
                  </span>
                ))}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="demo__tabs" role="presentation">
        <span className="demo__tab">
          <FileCode size={16} aria-hidden="true" /> Files changed <span className="demo__tabn">{PR.files.length}</span>
        </span>
        <span className="demo__diffstat tnum">
          <span className="add">+{adds}</span> <span className="del">−{dels}</span>
        </span>
      </div>

      <div className="demo__body">
        <nav className="demo__files" aria-label="Changed files">
          <ul>
            {PR.files.map((f) => {
              const n = shown.filter((x) => x.filePath === f.path);
              const name = f.path.split('/').pop();
              const top = n[0]?.severity;
              return (
                <li key={f.path}>
                  <button type="button" className={`demo__file${f.path === active ? ' is-on' : ''}`} aria-current={f.path === active ? 'true' : undefined} onClick={() => setActive(f.path)}>
                    <span className="demo__fname mono">{name}</span>
                    <span className="demo__fdir mono">{f.path.slice(0, f.path.length - (name?.length ?? 0))}</span>
                    {top ? (
                      <span className={`demo__fflag sev-fg--${top}`} aria-label={`${n.length} finding`}>
                        <SeverityGlyph severity={top} />
                      </span>
                    ) : (
                      <span className="demo__fstat tnum">+{f.additions}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="demo__code" ref={codeRef}>
          <p className="demo__path mono">{file.path}</p>
          <Diff
            key={`${file.path}-${reviewed}`}
            file={file}
            findings={shown.filter((f) => f.filePath === file.path)}
            allFindings={ALL}
            sweep={!reduced}
            renderNote={(f: Finding) => (
              <motion.div
                initial={reduced ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: reduced ? 0 : 0.38, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <ReviewNote finding={f} variant="compact" headingLevel={3} href={`/app/scans/${SAMPLE_SCAN_ID}/findings/${f.fingerprint}`} />
              </motion.div>
            )}
          />
          {reviewed && shown.every((f) => f.filePath !== file.path) && (
            <p className="demo__clean">No configured rule matched the lines added to this file. That is not the same as “secure”.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  useTheme();
  const [reviewed, setReviewed] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const scanSample = () => {
    setReviewed(true);
    demoRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <div className="site">
      <a href="#hero" className="skip-link">
        Skip to content
      </a>
      <header className="snav">
        <Link to="/" className="snav__brand" aria-label="CodeSentinel home">
          <Wordmark size={26} />
        </Link>
        <nav className="snav__links" aria-label="Site">
          <a href="#demo">How it works</a>
          <Link to="/specimen">Design system</Link>
        </nav>
        <div className="snav__actions">
          <Link to="/app" className="btn btn--ghost">
            Open the workspace
          </Link>
          <button type="button" className="btn btn--secondary" onClick={scanSample}>
            Scan a sample PR
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="hero" aria-labelledby="hero-h">
          <p className="hero__kicker">Pull-request security review</p>
          <h1 className="hero__title" id="hero-h">
            Catch the <span className="hero__mark">risky line</span>{' '}
            <br />
            before it ships.
          </h1>
          <p className="hero__lead">
            CodeSentinel reads every line a pull request adds, flags known security mistakes, and explains each one in plain language — with a
            safer way to write it.
          </p>
          <div className="hero__ctas">
            <button type="button" className="btn btn--primary btn--lg" onClick={scanSample}>
              <Play size={18} weight="fill" />
              Scan a sample pull request
            </button>
            <Link to="/app" className="btn btn--secondary btn--lg">
              Open the workspace <ArrowRight size={18} weight="bold" />
            </Link>
          </div>
          <ul className="hero__proof">
            <li>
              <ListChecks size={18} aria-hidden="true" /> 5 documented rules
            </li>
            <li>
              <Browser size={18} aria-hidden="true" /> Runs in your browser
            </li>
            <li>
              <LockSimple size={18} aria-hidden="true" /> Nothing is uploaded
            </li>
          </ul>
        </section>

        <section className="stage" id="demo" aria-labelledby="demo-h" ref={demoRef}>
          <h2 id="demo-h" className="visually-hidden">
            Try it on a sample pull request
          </h2>
          <Demo reviewed={reviewed} onReview={() => setReviewed(true)} />
          <p className="stage__caption">
            A sample pull request written for this academic prototype. The rules really run, in your browser — this is not Semgrep and nothing
            connects to GitHub.
          </p>
        </section>
      </main>
    </div>
  );
}
