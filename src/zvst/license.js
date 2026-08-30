/**
 * zvst/license.js — license verification for the Zovo Styles fork.
 * GPL-3.0-only. Port of the fleet canonical layer 5.95 (frozen zovo-license
 * contract, ScheduledHistoryCleaner/PaperFetch/Zovo-Night lineage).
 *
 * Grant semantics (HARD invariants — fleet licensing standard 2026-08-19 §5):
 *   - The ONLY paths to plan 'pro' are (a) a schema-validated {valid:true}
 *     response from the license server, or (b) the 7-day grace cache holding
 *     a record that was ITSELF server-verified, bound to the same key.
 *   - NO client-only Pro grant. NO backdoor/demo/hardcoded keys.
 *   - NEVER gate on tier === 'pro': the server answers pro OR lifetime, and
 *     22 of 66 customers are lifetime. Grant on valid:true only.
 *   - SUPABASE_ANON_KEY resolves ONLY from the build-time define (never in
 *     the repo). Absent define → verify() fails CLOSED to free.
 *
 * Key shape (matches what checkout mints): ZOVO-XXXX-XXXX-XXXX-XXXX, the
 * permissive [A-Z0-9] class — 43 of 66 live keys contain L or U, so any
 * narrower class silently rejects paying customers.
 */

import * as prefs from '@/js/prefs';
import {
  EXTENSION_KEY,
  LICENSE_OFFLINE_GRACE_MS,
  LICENSE_VERIFY_TIMEOUT_MS,
  LICENSE_VERIFY_URL,
  NAMESPACE,
  P_LICENSE_CACHE,
  P_LICENSE_KEY,
} from './constants';

/** Build-time substituted (tools/webpack.vars.js VARS); '' when unset. */
function anonKey() {
  const k = typeof __.SUPABASE_ANON_KEY === 'string' ? __.SUPABASE_ANON_KEY : '';
  // A templating placeholder that survived the build is not a key.
  if (k === '' || k.includes('{{') || k.includes('}}')) return '';
  return k;
}

/**
 * Key shape: `ZOVO-` + four 4-char alphanumeric groups. The client checks
 * SHAPE only; the server is the sole authority on authenticity. Tested
 * against the NORMALIZED uppercase form only — never raw input.
 */
export const PRO_KEY_PATTERN = /^ZOVO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const MAX_KEY_LENGTH = 64;

/** trim + uppercase + bound. PRO_KEY_PATTERN is tested against the
 *  NORMALIZED form, never against raw input. */
export function normalizeKey(raw) {
  if (typeof raw !== 'string') return null;
  if (raw.length > MAX_KEY_LENGTH) return null;
  const key = raw.trim().toUpperCase();
  return key === '' ? null : key;
}

export function isKeyShape(key) {
  const normalized = normalizeKey(key);
  return normalized !== null && PRO_KEY_PATTERN.test(normalized);
}

/** A cached grant is honored for 7 days; a server expiry ends it sooner. A
 *  checkedAt stamped in the FUTURE (hand-tampered storage) never grants. */
export function cacheGrantsPro(cache, now = Date.now()) {
  if (cache === null || typeof cache !== 'object') return false;
  if (cache.plan !== 'pro') return false;
  if (typeof cache.checkedAt !== 'number' || !Number.isFinite(cache.checkedAt)) return false;
  if (cache.checkedAt > now + 60_000) return false; // future stamp = tampered
  if (typeof cache.exp === 'number' && cache.exp > 0 && cache.exp < now) return false;
  return now - cache.checkedAt <= LICENSE_OFFLINE_GRACE_MS;
}

/** Sync tier resolution — every wall gate reads this (after prefs.ready). */
export function currentPlan() {
  return cacheGrantsPro(prefs.__values[P_LICENSE_CACHE]) ? 'pro' : 'free';
}

/** Minimal shape accepted back from the verify endpoint (schema guard). */
function isVerifyResponse(v) {
  if (typeof v !== 'object' || v === null) return false;
  if (typeof v.valid !== 'boolean') return false;
  if (v.exp !== undefined && typeof v.exp !== 'number') return false;
  return true;
}

/**
 * Offline fallback: Pro ONLY when the grace cache holds a server-verified
 * record bound to THIS key. A structurally valid key with no server record
 * is told to connect — never unlocked offline.
 */
function offlineFallback(normalizedKey) {
  const cache = prefs.__values[P_LICENSE_CACHE];
  if (prefs.__values[P_LICENSE_KEY] === normalizedKey && cacheGrantsPro(cache)) {
    return {valid: true, plan: 'pro', exp: cache.exp ?? 0, offline: true};
  }
  return {valid: false, plan: 'free', offline: true, error: 'offline-connect-to-activate'};
}

/**
 * Server-first verify with the canonical offline fallback. Never throws.
 * The ONLY fresh grant path is a schema-validated {valid:true}; with no
 * build-time anon key there is no server path and the result fails closed.
 * On a fresh grant, persists {key, cache} to prefs (synced).
 */
export async function verify(key) {
  const normalized = normalizeKey(key);
  if (normalized === null || !PRO_KEY_PATTERN.test(normalized)) {
    return {valid: false, plan: 'free', error: 'bad-key-shape'};
  }

  const apiKey = anonKey();
  if (apiKey === '') {
    console.warn(`[${NAMESPACE}] license verify unavailable (no build key) — offline path`);
    return offlineFallback(normalized);
  }
  if (!LICENSE_VERIFY_URL.startsWith('https://')) {
    return {valid: false, plan: 'free', error: 'insecure-endpoint'};
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LICENSE_VERIFY_TIMEOUT_MS);
  try {
    const res = await fetch(LICENSE_VERIFY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': apiKey,
        'authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({license_key: normalized, extension: EXTENSION_KEY}),
      signal: ctrl.signal,
    });
    if (!res.ok) return {valid: false, plan: 'free', error: `server-${res.status}`};
    let body;
    try {
      body = await res.json();
    } catch {
      return offlineFallback(normalized);
    }
    if (!isVerifyResponse(body)) {
      return {valid: false, plan: 'free', error: 'bad-response'};
    }
    if (body.valid === true) {
      const exp = typeof body.exp === 'number' && Number.isFinite(body.exp) ? body.exp : 0;
      const cache = {plan: 'pro', checkedAt: Date.now(), exp};
      prefs.set(P_LICENSE_KEY, normalized);
      prefs.set(P_LICENSE_CACHE, cache);
      return {valid: true, plan: 'pro', exp};
    }
    return {valid: false, plan: 'free', error: 'server-declined'};
  } catch (err) {
    console.warn(`[${NAMESPACE}] license verify offline`, err);
    return offlineFallback(normalized);
  } finally {
    clearTimeout(timer);
  }
}

/** Deactivate: clears key + cache, back to free. */
export function deactivate() {
  prefs.set(P_LICENSE_KEY, '');
  prefs.set(P_LICENSE_CACHE, null);
}
