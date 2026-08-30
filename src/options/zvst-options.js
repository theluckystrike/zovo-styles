/**
 * options/zvst-options.js — fork (Zovo Styles) options-page Pro/license
 * section: status, activate, deactivate. GPL-3.0-only.
 */

import {API} from '@/js/msg-api';
import * as prefs from '@/js/prefs';
import {PRO_KEY_PATTERN, currentPlan, normalizeKey} from '../zvst/license';

export default function initZvstOptions() {
  const status = document.getElementById('zls-pro-status');
  const input = document.getElementById('zls-key');
  const btnOn = document.getElementById('zls-activate');
  const btnOff = document.getElementById('zls-deactivate');
  const err = document.getElementById('zls-pro-err');
  if (!status || !input || !btnOn) return;

  const reflect = () => {
    const pro = currentPlan() === 'pro';
    status.textContent = pro ? 'Pro is active on this browser.' : 'Free plan';
    status.style.fontWeight = pro ? '700' : '';
    btnOff.hidden = !pro && !prefs.__values['zls.licenseKey'];
    btnOn.hidden = pro;
    input.hidden = pro;
    // Get-Pro CTA only makes sense on the free plan
    const cta = document.getElementById('zls-get-pro');
    if (cta) cta.hidden = pro;
    if (pro) input.value = '';
  };
  prefs.subscribe('zls.licenseCache', reflect, true);
  reflect();

  btnOn.onclick = async () => {
    err.textContent = '';
    const normalized = normalizeKey(input.value);
    if (!normalized || !PRO_KEY_PATTERN.test(normalized)) {
      err.textContent = 'That key does not look right — check the format.';
      return;
    }
    btnOn.disabled = true;
    try {
      const res = await API.zls.activateLicense(normalized);
      if (res && res.valid) {
        reflect();
      } else {
        err.textContent = res && res.error === 'offline-connect-to-activate'
          ? 'You are offline — connect once to activate.'
          : 'The server did not accept this key.';
      }
    } catch {
      err.textContent = 'Activation failed — try again.';
    }
    btnOn.disabled = false;
  };
  input.onkeydown = e => {
    if (e.key === 'Enter') btnOn.click();
  };
  btnOff.onclick = async () => {
    await API.zls.deactivateLicense();
    reflect();
  };
}
