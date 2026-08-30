/**
 * zvst/css-fixer.js — fork (Zovo Styles) deterministic, conservative CSS
 * auto-fixer. GPL-3.0-only.
 *
 * stylelint-bundle (upstream's bundled linter) DETECTS problems but its fix
 * path is compiled out (fix:true returns no output), so Pro auto-fix is
 * implemented here as a small set of safe, explicit transforms. Each fix is
 * semantics-preserving by construction and unit-testable.
 *
 * Supported fixes (plain CSS only — LESS/Stylus syntax is declined):
 *   1. duplicate property in one declaration block → keep the LAST (the one
 *      the cascade would use); the deliberate-fallback pattern (same
 *      property repeated CONSECUTIVELY with different values, e.g.
 *      `background: red; background: linear-gradient(...)`) is preserved;
 *   2. duplicate font names inside font-family lists;
 *   3. hex colors lowercased and shortened (#FFFFFF → #fff);
 *   4. zero-with-unit → bare 0 (0px → 0); time (0s) and angle (0deg) units
 *      are kept since some grammars require them;
 *   5. rules left empty by fixes (or already empty) are removed;
 *   6. doubled semicolons collapsed.
 * Comments and string contents are never rewritten.
 */

/** Split CSS into segments: {t:'code'|'comment'|'string', s:text}. */
export function segment(code) {
  const out = [];
  let i = 0;
  let start = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    if (c === '/' && code[i + 1] === '*') {
      if (start < i) out.push({t: 'code', s: code.slice(start, i)});
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out.push({t: 'comment', s: code.slice(i, stop)});
      i = stop;
      start = stop;
    } else if (c === '"' || c === "'") {
      if (start < i) out.push({t: 'code', s: code.slice(start, i)});
      let j = i + 1;
      while (j < n && code[j] !== c) {
        if (code[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, n);
      out.push({t: 'string', s: code.slice(i, j)});
      i = j;
      start = j;
    } else {
      i++;
    }
  }
  if (start < n) out.push({t: 'code', s: code.slice(start)});
  return out;
}

const rxHex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const rxZeroUnit = /(^|[\s:,(-])-?0(px|em|rem|pt|pc|cm|mm|in|ex|ch|vh|vw|vmin|vmax|q)\b/gi;
const rxSemi = /;\s*;/g;

/** Value-level fixes applied to a code segment (no block surgery). */
function fixCodeSegment(s, fixes) {
  s = s.replace(rxHex, (m, h) => {
    let x = h.toLowerCase();
    if (x.length === 6 && x[0] === x[1] && x[2] === x[3] && x[4] === x[5]) {
      x = x[0] + x[2] + x[4];
    }
    if (x !== h) fixes.push('hex color normalized');
    return '#' + x;
  });
  s = s.replace(rxZeroUnit, (m, pre) => {
    fixes.push('zero unit dropped');
    return pre + '0';
  });
  s = s.replace(rxSemi, () => {
    fixes.push('doubled semicolon collapsed');
    return ';';
  });
  return s;
}

/** Declaration-list surgery on one block body (strings/comments preserved). */
function fixBlockBody(body, fixes) {
  const segs = segment(body);
  // nested braces in code segments → not a plain declaration list, skip
  if (segs.some(x => x.t === 'code' && /[{}]/.test(x.s))) return body;
  // value-level fixes on code sub-segments first (strings/comments untouched)
  const joined = segs.map(x => x.t === 'code' ? fixCodeSegment(x.s, fixes) : x.s).join('');
  if (!joined.includes(':')) return joined;
  const parts = joined.split(';');
  const trailingSemi = parts[parts.length - 1].trim() === '';
  const decls = trailingSemi ? parts.slice(0, -1) : parts;
  const tail = trailingSemi ? parts[parts.length - 1] : '';
  if (!decls.length) return joined;
  const seen = new Map();
  const drop = new Set();
  let changed = false;
  decls.forEach((d, idx) => {
    const m = /^\s*([a-zA-Z-][\w-]*)\s*:\s*/.exec(d);
    if (!m) return;
    const prop = m[1].toLowerCase();
    const value = d.slice(m[0].length).trim();
    if (prop === 'font-family') {
      const names = value.split(',').map(x => x.trim());
      const seenNames = new Set();
      let dup = false;
      const kept = names.filter(nm => {
        const key = nm.toLowerCase().replace(/["']/g, '');
        if (seenNames.has(key)) {
          dup = true;
          return false;
        }
        seenNames.add(key);
        return true;
      });
      if (dup) {
        fixes.push('duplicate font name removed');
        decls[idx] = d.slice(0, m[0].length) + kept.join(', ');
        changed = true;
      }
      return;
    }
    const prev = seen.get(prop);
    if (prev !== undefined) {
      const consecutive = prev.index === idx - 1;
      const different = prev.value !== value;
      if (!(consecutive && different)) {
        drop.add(prev.index); // keep the LAST occurrence (cascade winner)
        fixes.push(`duplicate "${prop}" removed`);
        changed = true;
      }
    }
    seen.set(prop, {index: idx, value});
  });
  if (!changed) return joined;
  return decls.filter((_, idx) => !drop.has(idx)).join(';') +
    (trailingSemi ? ';' : '') + tail;
}

/**
 * Fix plain-CSS source.
 * @param {string} code
 * @return {{output: string, fixes: string[], declined: boolean}}
 */
export function fixCss(code) {
  const fixes = [];
  const segs = segment(code);
  const n = segs.length;
  let out = '';
  /** pending = selector/at-rule text awaiting its block; buffered so an
   *  emptied rule can be dropped whole (selector + braces). */
  for (let i = 0; i < n; i++) {
    const seg = segs[i];
    if (seg.t !== 'code') {
      out += seg.s;
      continue;
    }
    let s = seg.s;
    while (s) {
      const open = s.indexOf('{');
      if (open < 0) {
        out += fixCodeSegment(s, fixes);
        break;
      }
      const head = fixCodeSegment(s.slice(0, open), fixes);
      // find matching close with depth counting across segments
      let depth = 1;
      let body = s.slice(open + 1);
      let j = i;
      let closed = false;
      for (;;) {
        let k = 0;
        let cut = -1;
        while (k < body.length) {
          const ch = body[k];
          if (ch === '{') depth++;
          else if (ch === '}' && --depth === 0) {
            cut = k;
            break;
          }
          k++;
        }
        if (cut >= 0) {
          const bodyText = body.slice(0, cut);
          const after = body.slice(cut + 1);
          // nested block inside (e.g. @media) → recurse into inner rules
          const hasNested = segment(bodyText).some(x => x.t === 'code' && /[{}]/.test(x.s));
          let fixedBody;
          if (hasNested) {
            const inner = fixCss(bodyText);
            fixedBody = inner.output;
            fixes.push(...inner.fixes);
          } else {
            fixedBody = fixBlockBody(bodyText, fixes);
          }
          if (!hasNested && !/[^\s;]/.test(fixedBody)) {
            fixes.push('empty rule removed'); // drop selector + braces whole
          } else {
            out += head + '{' + fixedBody + '}';
          }
          closed = true;
          s = after;
          if (j > i) i = j;
          break;
        }
        // body continues: append remainder and pull the next segment
        j++;
        if (j >= n) break;
        if (segs[j].t !== 'code') {
          body += segs[j].s;
          continue;
        }
        body += segs[j].s;
      }
      if (!closed) {
        // unbalanced — emit verbatim, no surgery
        out += head + '{' + body;
        if (j > i) i = j;
        break;
      }
    }
  }
  return {output: out, fixes, declined: false};
}

/** True when a CodeMirror mode string is plain CSS (safe for fixCss). */
export function isPlainCssMode(mode) {
  const m = String(mode || '').toLowerCase();
  return !/less|stylus|scss|sass/.test(m);
}
