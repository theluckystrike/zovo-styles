/**
 * zvst/pro-ui.js — fork (Zovo Styles) shared Pro gate dialog + plan helpers.
 * GPL-3.0-only. Used by the editor (lint auto-fix), popup, and options page.
 *
 * The gate offers two honest paths: activate an existing license key, or open
 * the pricing page. No fake urgency, no counts, no discounts.
 */

import {API} from '@/js/msg-api';
import {PRO_KEY_PATTERN, currentPlan, normalizeKey} from './license';
import {PRICING_URL as PRICING} from './constants';

const NS = 'zvst8k2m';
let stylesInjected = false;

export const isPro = () => currentPlan() === 'pro';

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement('style');
  el.textContent = `
.${NS}-overlay{position:fixed;inset:0;background:rgba(8,10,14,.55);display:flex;
  align-items:center;justify-content:center;z-index:2147483647}
.${NS}-card{width:360px;max-width:92vw;background:#fff;color:#1a1d24;border-radius:12px;
  padding:20px 22px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.${NS}-card h2{margin:0 0 6px;font-size:17px}
.${NS}-card p{margin:6px 0;color:#454b57}
.${NS}-key{width:100%;box-sizing:border-box;margin:10px 0 4px;padding:9px 10px;
  font:13px/1.2 ui-monospace,monospace;letter-spacing:.5px;border:1.5px solid #c9cfd9;
  border-radius:8px;text-transform:uppercase}
.${NS}-key:focus{outline:none;border-color:#5b6cff}
.${NS}-err{min-height:18px;color:#c03535;font-size:12.5px;margin:2px 0}
.${NS}-row{display:flex;gap:10px;margin-top:10px;align-items:center}
.${NS}-btn{flex:1;padding:9px 0;border:0;border-radius:8px;font-weight:600;cursor:pointer;
  background:#5b6cff;color:#fff;font-size:14px}
.${NS}-btn[disabled]{opacity:.6;cursor:default}
.${NS}-link{color:#5b6cff;text-decoration:none;font-weight:600;white-space:nowrap}
.${NS}-close{position:absolute;margin-left:316px;margin-top:-12px;border:0;background:none;
  font-size:18px;cursor:pointer;color:#8a919e}
@media (prefers-color-scheme:dark){
  .${NS}-card{background:#1b1e26;color:#e7e9ee}
  .${NS}-card p{color:#a8aebb}
  .${NS}-key{background:#12141a;color:#e7e9ee;border-color:#3a4150}
}`;
  document.head.appendChild(el);
}

/**
 * Open the Pro gate. Resolves true when a key was activated (caller should
 * re-run the gated action), false when dismissed.
 * @param {string} feature human name of the gated feature, e.g. "Auto-fix"
 * @return {Promise<boolean>}
 */
export function proGate(feature) {
  injectStyles();
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = `${NS}-overlay`;
    overlay.innerHTML = `
      <div class="${NS}-card" role="dialog" aria-modal="true" aria-label="Pro feature">
        <button class="${NS}-close" aria-label="Close">×</button>
        <h2>${feature} is a Pro feature</h2>
        <p>Unlock the Pro tools in Zovo Styles with your license key.</p>
        <input class="${NS}-key" maxlength="23" spellcheck="false"
               placeholder="ZOVO-XXXX-XXXX-XXXX-XXXX" aria-label="License key">
        <div class="${NS}-err"></div>
        <div class="${NS}-row">
          <button class="${NS}-btn">Activate</button>
          <a class="${NS}-link" href="${PRICING}" target="_blank" rel="noopener">Get Pro →</a>
        </div>
      </div>`;
    const input = overlay.querySelector(`.${NS}-key`);
    const err = overlay.querySelector(`.${NS}-err`);
    const btn = overlay.querySelector(`.${NS}-btn`);
    const done = val => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(val);
    };
    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    overlay.querySelector(`.${NS}-close`).onclick = () => done(false);
    overlay.onclick = e => {
      if (e.target === overlay) done(false);
    };
    input.oninput = () => {
      err.textContent = '';
    };
    input.onkeydown = e => {
      if (e.key === 'Enter') btn.click();
    };
    btn.onclick = async () => {
      const raw = input.value;
      const normalized = normalizeKey(raw);
      if (!normalized || !PRO_KEY_PATTERN.test(normalized)) {
        err.textContent = 'That key does not look right — check the format.';
        return;
      }
      btn.disabled = true;
      err.textContent = 'Checking…';
      try {
        const res = await API.zls.activateLicense(normalized);
        if (res && res.valid) {
          done(true);
          return;
        }
        err.textContent = res && res.error === 'offline-connect-to-activate'
          ? 'You are offline — connect once to activate.'
          : 'The server did not accept this key.';
      } catch {
        err.textContent = 'Activation failed — try again.';
      }
      btn.disabled = false;
    };
    document.body.appendChild(overlay);
    input.focus();
  });
}

/** Run `fn` when Pro, else open the gate and run it after activation. */
export async function runPro(feature, fn) {
  if (isPro()) return fn();
  if (await proGate(feature)) return fn();
}
