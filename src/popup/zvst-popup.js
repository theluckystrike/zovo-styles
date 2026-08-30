/**
 * popup/zvst-popup.js — fork (Zovo Styles) popup additions: per-site
 * dark/light variant switcher, one-click full backup, starter themes entry,
 * Pro chip. GPL-3.0-only. Zero network here except user-initiated license
 * activation inside the Pro gate.
 */

import {API} from '@/js/msg-api';
import * as prefs from '@/js/prefs';
import {P_SITE_SCHEMES} from '../zvst/constants';
import {isPro, proGate} from '../zvst/pro-ui';

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Effective override for host, walking parent domains (bg semantics). */
function effectiveScheme(map, host) {
  for (let h = host; h;) {
    const v = map[h];
    if (v === 'dark' || v === 'light') return v;
    const dot = h.indexOf('.');
    h = dot > 0 ? h.slice(dot + 1) : '';
  }
  return '';
}

async function downloadBackup() {
  const data = await API.zls.exportFullBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zls-full-backup-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function initZvstBar(tabUrl, urlSupported) {
  const bar = document.getElementById('zls-bar');
  if (!bar) return;

  /* Per-site dark/light variant switcher */
  const host = urlSupported ? hostOf(tabUrl) : '';
  const segWrap = document.getElementById('zls-scheme');
  if (!host) {
    segWrap.hidden = true;
  } else {
    const buttons = [...segWrap.querySelectorAll('.zls-seg-btn')];
    const reflect = () => {
      const cur = effectiveScheme(prefs.__values[P_SITE_SCHEMES] || {}, host);
      for (const b of buttons) {
        b.classList.toggle('zls-on', b.dataset.zlsScheme === cur);
      }
    };
    prefs.subscribe(P_SITE_SCHEMES, reflect, true);
    for (const b of buttons) {
      b.onclick = async () => {
        const mode = b.dataset.zlsScheme;
        const cur = effectiveScheme(prefs.__values[P_SITE_SCHEMES] || {}, host);
        // clicking the active mode clears the override back to Auto
        const next = mode === cur ? '' : mode;
        await API.zls.setSiteScheme(host, next || null);
        reflect();
      };
    }
  }

  /* One-click full backup */
  document.getElementById('zls-backup').onclick = e => {
    e.preventDefault();
    downloadBackup();
  };

  /* Pro chip (hidden once Pro is active) */
  const proChip = document.getElementById('zls-pro');
  const syncPro = () => {
    proChip.hidden = isPro();
  };
  prefs.subscribe('zls.licenseCache', syncPro, true);
  syncPro();
  proChip.onclick = () => proGate('Pro tools');
}
