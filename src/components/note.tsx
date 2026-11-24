import { ArrowRight, CaretRight } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { RULESET_VERSION, getRule } from '../data/rules';
import type { Finding } from '../lib/scanner';
import { Mark, SeverityBadge } from './brand';
import { CodeText } from './code';

/**
 * CodeSentinel's review note: it sits directly under the flagged line, like a
 * reviewer's comment in a pull request — what, why it matters, how to fix.
 */
export function ReviewNote({
  finding,
  variant = 'full',
  href,
  headingLevel = 3,
  hideTitle = false,
}: {
  finding: Finding;
  variant?: 'full' | 'compact';
  href?: string;
  headingLevel?: 2 | 3 | 4;
  /** On the finding page the title and summary already sit in the page header. */
  hideTitle?: boolean;
}) {
  const rule = getRule(finding.ruleId);
  const [showFix, setShowFix] = useState(variant === 'full');
  const fixId = useId();
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const Sub = `h${Math.min(headingLevel + 1, 5)}` as 'h3' | 'h4' | 'h5';

  return (
    <article className={`note note--${variant} flag--${finding.severity}`} aria-label={`CodeSentinel review note: ${rule.name}`}>
      <header className="note__head">
        <span className="note__avatar" aria-hidden="true">
          <Mark size={16} />
        </span>
        <p className="note__who">
          <strong>CodeSentinel</strong> flagged this line
        </p>
        <SeverityBadge severity={finding.severity} />
      </header>

      {hideTitle ? (
        <H className="visually-hidden">Review note</H>
      ) : (
        <>
          <H className="note__title">{rule.name}</H>
          <p className="note__summary">{rule.summary}</p>
        </>
      )}

      <section className={`note__section${hideTitle ? ' note__section--first' : ''}`}>
        <Sub className="note__h">Why it matters</Sub>
        <p className="note__p">{variant === 'full' ? `${rule.why} ${rule.impact}` : rule.impact}</p>
      </section>

      {variant === 'compact' && (
        <button type="button" className="note__toggle" aria-expanded={showFix} aria-controls={fixId} onClick={() => setShowFix((v) => !v)}>
          <CaretRight size={14} weight="bold" className="note__caret" />
          {showFix ? 'Hide the fix' : 'Show how to fix it'}
        </button>
      )}

      <AnimatePresence initial={false}>
        {showFix && (
          <motion.section
            id={fixId}
            className="note__section note__fix"
            initial={variant === 'compact' ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Sub className="note__h">How to fix it</Sub>
            <p className="note__p">{rule.remediation}</p>
            <figure className="suggestion" aria-label="Suggested change, not applied automatically">
              <figcaption className="suggestion__cap">
                Suggested change <span>· not applied automatically</span>
              </figcaption>
              <div className="suggestion__row suggestion__row--del">
                <span className="suggestion__sign" aria-label="Remove">
                  −
                </span>
                <code>
                  <CodeText text={rule.safer.before} mark={null} />
                </code>
              </div>
              <div className="suggestion__row suggestion__row--add">
                <span className="suggestion__sign" aria-label="Add">
                  +
                </span>
                <code>
                  <CodeText text={rule.safer.after} mark={null} />
                </code>
              </div>
            </figure>
          </motion.section>
        )}
      </AnimatePresence>

      {variant === 'full' ? (
        <details className="note__details">
          <summary>
            <CaretRight size={14} weight="bold" className="note__caret" />
            Rule details and known limitations
          </summary>
          <dl className="note__facts">
            <div>
              <dt>Rule</dt>
              <dd>
                {rule.id} · {rule.name}
              </dd>
            </div>
            <div>
              <dt>Matches</dt>
              <dd>{rule.matches}</dd>
            </div>
            <div>
              <dt>Weakness</dt>
              <dd>
                {rule.category} · {rule.cwe}
              </dd>
            </div>
            <div>
              <dt>Ruleset</dt>
              <dd>{RULESET_VERSION}</dd>
            </div>
          </dl>
          <ul className="note__limits">
            {rule.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      ) : (
        href && (
          <Link to={href} className="note__open">
            Open the full finding <ArrowRight size={14} weight="bold" />
          </Link>
        )
      )}
    </article>
  );
}
