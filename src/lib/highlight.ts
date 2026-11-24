/**
 * A small, synchronous JavaScript tokenizer for the controlled fixtures.
 * Deliberately quiet: syntax colour is secondary to evidence colour.
 */

export type TokenKind = 'kw' | 'str' | 'num' | 'com' | 'fn' | 'prop' | 'punc' | 'plain' | 'lit';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'import', 'from', 'export', 'const', 'let', 'var', 'function', 'return', 'async', 'await',
  'if', 'else', 'for', 'while', 'new', 'typeof', 'of', 'in', 'throw', 'try', 'catch', 'class',
  'extends', 'default',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this']);

const PATTERN =
  /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d"'`]+)/g;

export function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  let prev = '';
  let m: RegExpExecArray | null;
  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(line)) !== null) {
    const [text, com, str, num, ident, ws] = m;
    if (com) tokens.push({ kind: 'com', text });
    else if (str) tokens.push({ kind: 'str', text });
    else if (num) tokens.push({ kind: 'num', text });
    else if (ident) {
      const after = line.slice(PATTERN.lastIndex).trimStart();
      let kind: TokenKind = 'plain';
      if (KEYWORDS.has(ident)) kind = 'kw';
      else if (LITERALS.has(ident)) kind = 'lit';
      else if (prev.endsWith('.')) kind = after.startsWith('(') ? 'fn' : 'prop';
      else if (after.startsWith('(')) kind = 'fn';
      tokens.push({ kind, text });
    } else if (ws) tokens.push({ kind: 'plain', text });
    else tokens.push({ kind: 'punc', text });
    if (!ws) prev = text;
  }
  return tokens;
}

/** Splits tokens so that [start, end) can be wrapped as a separate mark. */
export function tokenizeWithRange(
  line: string,
  range: { start: number; end: number } | null,
): Array<Token & { marked: boolean }> {
  const tokens = tokenize(line);
  const out: Array<Token & { marked: boolean }> = [];
  let pos = 0;
  for (const t of tokens) {
    const tStart = pos;
    const tEnd = pos + t.text.length;
    pos = tEnd;
    if (!range || tEnd <= range.start || tStart >= range.end) {
      out.push({ ...t, marked: false });
      continue;
    }
    const a = Math.max(range.start, tStart) - tStart;
    const b = Math.min(range.end, tEnd) - tStart;
    if (a > 0) out.push({ kind: t.kind, text: t.text.slice(0, a), marked: false });
    out.push({ kind: t.kind, text: t.text.slice(a, b), marked: true });
    if (b < t.text.length) out.push({ kind: t.kind, text: t.text.slice(b), marked: false });
  }
  return out;
}
