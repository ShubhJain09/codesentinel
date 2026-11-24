import { ClockCounterClockwise, GearSix, GitBranch, House, ListChecks, Plus, SealWarning, UsersThree } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { Mark, OutcomeBanner, SeverityBadge, StatusLabel, Wordmark } from '../components/brand';
import { CodeText, Diff } from '../components/code';
import { ReviewNote } from '../components/note';
import { SEVERITY_ORDER } from '../data/rules';
import { SAMPLE_PR, findingsFor, useTheme } from '../lib/store';

const SWATCHES: Array<[string, string, string]> = [
  ['Page', '--page', ''],
  ['Surface', '--surface', ''],
  ['Line', '--line', ''],
  ['Ink 1', '--ink-1', 'Body text'],
  ['Ink 2', '--ink-2', 'Secondary text'],
  ['Ink 3', '--ink-3', 'Hints, metadata'],
  ['Marker', '--marker', 'Highlight · mark · primary action only'],
  ['Marker tint', '--marker-tint', 'Selection'],
  ['Link / focus', '--link', 'Links and focus rings'],
];

const CONTRAST: Record<'light' | 'dark', Record<string, string>> = {
  light: { '--ink-1': '17.9:1', '--ink-2': '8.8:1', '--ink-3': '5.4:1', '--link': '6.3:1', '--marker': 'ink on it 13.4:1' },
  dark: { '--ink-1': '16.0:1', '--ink-2': '9.4:1', '--ink-3': '6.0:1', '--link': '7.1:1', '--marker': 'ink on it 12.2:1' },
};

const finding = findingsFor(SAMPLE_PR)[0]!;
const file = SAMPLE_PR.files.find((f) => f.path === finding.filePath)!;

function Column({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div className="spec-col" data-theme={theme}>
      <h2 className="spec-col__label">{theme === 'light' ? 'Light theme (default)' : 'Dark theme'}</h2>

      <section className="spec-block">
        <h3 className="spec-h">Brand</h3>
        <div className="spec-brand">
          <Wordmark size={32} />
          <div className="spec-marks">
            <Mark size={16} title="Mark, 16px" />
            <Mark size={24} title="Mark, 24px" />
            <Mark size={48} title="Mark, 48px" />
            <span className="spec-tile">
              <Mark size={28} title="App icon" />
            </span>
          </div>
        </div>
        <p className="spec-voice">“Here’s the line that worries us, why it matters, and a safer way to write it.”</p>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Typography — Instrument Sans (UI, display) &amp; Atkinson Hyperlegible Mono (code)</h3>
        <p className="t-display">
          Catch the <span className="hero__mark">risky line</span>
        </p>
        <p className="t-h1">SQL built by string concatenation</p>
        <p className="t-h2">Why it matters</p>
        <p className="t-h3">Review decision</p>
        <p className="t-body">
          The query text is assembled from a variable instead of a bound parameter, so the database cannot tell data from SQL. 15/24.
        </p>
        <p className="t-small">scan-0003 · 31 Oct, 10:42 UTC · prototype-rules 0.1 — 13/20</p>
        <p className="t-code">
          <CodeText text={`let sql = "SELECT * FROM users WHERE id = '" + id + "'"; // 0O 1lI`} mark={null} />
        </p>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Colour roles</h3>
        <ul className="swatches">
          {SWATCHES.map(([name, v, use]) => (
            <li key={v} className="swatch">
              <span className="swatch__chip" style={{ background: `var(${v})` }} />
              <span className="swatch__name">{name}</span>
              <span className="swatch__meta">{CONTRAST[theme][v] ?? use}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Severity &amp; review status</h3>
        <div className="spec-row">
          {SEVERITY_ORDER.map((s) => (
            <SeverityBadge key={s} severity={s} />
          ))}
        </div>
        <div className="spec-row">
          <StatusLabel status="open" />
          <StatusLabel status="in_review" />
          <StatusLabel status="resolved" />
          <StatusLabel status="accepted_risk" />
        </div>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Scan outcomes — never confusable</h3>
        <div className="spec-stack">
          <OutcomeBanner kind="findings" topSeverity="critical" title="5 findings need review">
            Including 1 critical, 2 high.
          </OutcomeBanner>
          <OutcomeBanner kind="clean" title="No configured rule matched">
            Not a security guarantee — only these patterns were absent.
          </OutcomeBanner>
          <OutcomeBanner kind="failed" title="Scan failed — no result was produced">
            Unsupported file type: assets/architecture.bin
          </OutcomeBanner>
          <OutcomeBanner kind="not_run" title="Not scanned yet" />
        </div>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Actions &amp; inputs</h3>
        <div className="spec-row">
          <button type="button" className="btn btn--primary">
            <Plus size={16} weight="bold" /> New scan
          </button>
          <button type="button" className="btn btn--secondary">
            Back to scan report
          </button>
          <button type="button" className="btn btn--ghost">
            Copy location
          </button>
          <button type="button" className="btn btn--secondary" disabled>
            Disabled
          </button>
        </div>
        <div className="spec-form">
          <label className="field">
            <span className="field__label">Repository name</span>
            <input className="input" defaultValue="demo-auth-service" />
            <span className="field__hint">Letters, numbers and dashes.</span>
          </label>
          <label className="field">
            <span className="field__label">Reason for accepting the risk</span>
            <input className="input" aria-invalid="true" defaultValue="ok" />
            <span className="field__hint field__hint--error">Write at least 8 characters.</span>
          </label>
        </div>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Navigation</h3>
        <div className="spec-nav">
          <span className="btn btn--primary sidebar__new">
            <Plus size={18} weight="bold" /> New scan
          </span>
          <span className="nav">
            <House size={20} /> <span className="nav__label">Home</span>
          </span>
          <span className="nav is-active">
            <ClockCounterClockwise size={20} weight="fill" /> <span className="nav__label">Scans</span> <span className="nav__count">3</span>
          </span>
          <span className="nav">
            <SealWarning size={20} /> <span className="nav__label">Findings</span> <span className="nav__count">5</span>
          </span>
          <span className="nav">
            <GitBranch size={20} /> <span className="nav__label">Repositories</span>
          </span>
          <span className="nav">
            <ListChecks size={20} /> <span className="nav__label">Rules</span>
          </span>
          <p className="sidebar__heading">Workspace admin</p>
          <span className="nav">
            <UsersThree size={20} /> <span className="nav__label">Members</span>
          </span>
          <span className="nav">
            <GearSix size={20} /> <span className="nav__label">Settings</span>
          </span>
        </div>
      </section>

      <section className="spec-block">
        <h3 className="spec-h">Code, highlight &amp; review note</h3>
        <div className="spec-code">
          <Diff file={file} findings={[finding]} selected={finding.fingerprint} around={2} renderNote={(f) => <ReviewNote finding={f} variant="compact" headingLevel={4} />} />
        </div>
      </section>
    </div>
  );
}

export function Specimen() {
  useTheme();
  return (
    <div className="spec">
      <header className="spec-head">
        <Link to="/" className="spec-head__brand" aria-label="CodeSentinel homepage">
          <Wordmark size={24} />
        </Link>
        <div>
          <h1 className="spec-head__title">Highlight — design system specimen</h1>
          <p className="spec-head__text">
            Design gate 1. Light and dark themes side by side. Yellow is reserved for three jobs: the highlight on matched code, the mark, and the one
            primary action per screen.
          </p>
        </div>
        <Link to="/app" className="btn btn--secondary">
          Open the workspace
        </Link>
      </header>

      <main id="main">
      <div className="spec-cols">
        <Column theme="light" />
        <Column theme="dark" />
      </div>

      <section className="spec-type" data-theme="light" aria-labelledby="typetest-h">
        <h2 id="typetest-h" className="spec-type__title">
          Typeface test at application sizes
        </h2>
        <p className="spec-type__intro">
          The same interface text at the sizes the product actually uses: the originally proposed Atkinson pair, and the pairing chosen after
          this test.
        </p>
        <div className="typetest">
          {(
            [
              ['atk', 'Atkinson Hyperlegible Next + Mono', 'Originally proposed'],
              ['alt', 'Instrument Sans + Atkinson Hyperlegible Mono', 'Chosen'],
            ] as const
          ).map(([k, name, tag]) => (
            <div key={k} className={`typetest__col typetest--${k}`}>
              <p className="typetest__name">
                {name} <span className="chip">{tag}</span>
              </p>
              <div className="typetest__row">
                <span className="tt-13">13px · scan-0003 · 31 Oct, 10:42 UTC · 44 added lines</span>
              </div>
              <div className="typetest__row">
                <span className="tt-14">14px · Back to scan report · Copy location · In review</span>
              </div>
              <div className="typetest__row">
                <span className="tt-15">
                  15px · The query text is assembled from a variable instead of a bound parameter, so the database cannot tell data from SQL.
                </span>
              </div>
              <div className="typetest__row">
                <span className="tt-20">20px · Hardcoded secret-like value</span>
              </div>
              <div className="typetest__row">
                <code className="tt-code">{`13.5px · const rate = eval(rule.expression); // 0O 1lI {}[] 8B`}</code>
              </div>
            </div>
          ))}
        </div>
        <div className="spec-verdict" id="verdict">
          <h3 className="spec-h">Verdict</h3>
          <p className="t-body" data-verdict>
            Atkinson Hyperlegible Next is very legible, but its proportional zero is slashed with no alternate in this build, so dates, counts
            and scan IDs (“10:42”, “scan-0003”) look technical and slightly odd in ordinary interface text, and its wide spacing makes dense
            metadata rows less refined. Instrument Sans is tighter and more polished at 13–15px and its width axis gives the display type
            character. Atkinson Hyperlegible Mono stays for code, where telling 0/O and 1/l/I apart genuinely matters — the legibility idea is
            kept exactly where it earns its place.
          </p>
        </div>
      </section>
      </main>
    </div>
  );
}
