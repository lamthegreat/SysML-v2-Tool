export type TokenType = "name" | "punct" | "mult" | "eof";

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

const PUNCT_MULTI = [":>>", ":>", "::"];
const PUNCT_SINGLE = new Set(["{", "}", ";", ":", ","]);

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

export class TokenizeError extends Error {
  constructor(
    message: string,
    public start: number,
    public end: number,
  ) {
    super(message);
  }
}

/**
 * Tokenize SysML v2 textual notation (MVP subset). Whitespace, line comments and
 * block comments are skipped. Qualified names (`A::B`) are emitted as a single
 * `name` token. Multiplicity `[ ... ]` is emitted as one `mult` token carrying
 * the inner text. Tokens retain source offsets so the parser can slice verbatim
 * text for unrecognized (`raw`) constructs.
 */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const ch = src[i];

    // whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // line comment
    if (ch === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    // block comment
    if (ch === "/" && src[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      if (i >= n) throw new TokenizeError("Unterminated block comment", start, n);
      i += 2;
      continue;
    }

    // multiplicity [ ... ]
    if (ch === "[") {
      const start = i;
      i++;
      let inner = "";
      while (i < n && src[i] !== "]") inner += src[i++];
      if (i >= n) throw new TokenizeError("Unterminated multiplicity", start, n);
      i++; // consume ]
      tokens.push({ type: "mult", value: inner.trim(), start, end: i });
      continue;
    }

    // multi-char punctuation
    let matched = false;
    for (const p of PUNCT_MULTI) {
      if (src.startsWith(p, i)) {
        tokens.push({ type: "punct", value: p, start: i, end: i + p.length });
        i += p.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // single-char punctuation
    if (PUNCT_SINGLE.has(ch)) {
      tokens.push({ type: "punct", value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }

    // identifier / qualified name
    if (isIdentStart(ch)) {
      const start = i;
      while (i < n && isIdentPart(src[i])) i++;
      // fold qualified-name segments A::B::C into one token
      while (src.startsWith("::", i) && isIdentStart(src[i + 2] ?? "")) {
        i += 2;
        while (i < n && isIdentPart(src[i])) i++;
      }
      tokens.push({ type: "name", value: src.slice(start, i), start, end: i });
      continue;
    }

    // Permissive fallback: any other character (operators, `*`, `(`, `=`, …)
    // becomes a generic punct token. Known-construct parsers won't match it, so
    // it flows into a `raw` element whose text is sliced verbatim from source —
    // keeping unrecognized notation lossless instead of failing the whole parse.
    tokens.push({ type: "punct", value: ch, start: i, end: i + 1 });
    i++;
  }

  tokens.push({ type: "eof", value: "", start: n, end: n });
  return tokens;
}
