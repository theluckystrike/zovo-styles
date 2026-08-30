/**
 * background/zvst-api.js — fork (Zovo Styles) background API: license state,
 * per-site dark/light scheme overrides, curated starter theme pack, and
 * one-click full backup/restore. GPL-3.0-only.
 *
 * Zero telemetry, zero style-data collection: the ONLY network call in this
 * module is the license-verify POST (user-initiated key activation).
 */

import {STORAGE_KEY} from '@/js/consts';
import {API} from '@/js/msg-api';
import * as prefs from '@/js/prefs';
import {deepCopy} from '@/js/util';
import * as chromeSync from '@/js/chrome-sync';
import {broadcast} from './broadcast';
import * as styleMan from './style-manager';
import {entries as urlCacheEntries} from './style-manager/cache';
import {P_SITE_SCHEMES, PRICING_URL} from '../zvst/constants';
import * as license from '../zvst/license';
import STARTER_THEMES from '../zvst/starter-themes.json';

const rxHost = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i;

/** Normalized starter-pack id stored on the style object for idempotency. */
const kStarterTag = 'zlsStarter';

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Invalidate per-URL injection caches + ask every tab to re-query its styles. */
function reapplyAllTabs() {
  urlCacheEntries.clear();
  broadcast({method: 'zlsRequery'});
}

// Re-apply whenever the per-site scheme map changes (any context wrote it).
prefs.subscribe(P_SITE_SCHEMES, reapplyAllTabs);

const zlsApi = {
  /* ------------------------------------------------ license (layer 5.95) */
  licenseState() {
    return {
      plan: license.currentPlan(),
      hasKey: !!prefs.__values['zls.licenseKey'],
      pricingUrl: PRICING_URL,
    };
  },
  activateLicense(key) {
    return license.verify(key);
  },
  deactivateLicense() {
    license.deactivate();
    return {plan: 'free'};
  },

  /* -------------------------------------- per-site dark/light switcher */
  /** @param {string} host bare hostname, e.g. "example.com"
   *  @param {'dark'|'light'|null} mode null clears the override */
  setSiteScheme(host, mode) {
    host = String(host || '').toLowerCase();
    if (!rxHost.test(host)) throw new Error('bad host');
    const map = deepCopy(prefs.__values[P_SITE_SCHEMES] || {});
    if (mode === 'dark' || mode === 'light') {
      map[host] = mode;
    } else {
      delete map[host];
    }
    prefs.set(P_SITE_SCHEMES, map);
    return map;
  },
  siteSchemes() {
    return deepCopy(prefs.__values[P_SITE_SCHEMES] || {});
  },

  /* ------------------------------------------------- starter theme pack */
  starterList() {
    const installed = new Set();
    for (const s of styleMan.getAll()) {
      if (s[kStarterTag]) installed.add(s[kStarterTag]);
    }
    return STARTER_THEMES.map(t => ({
      id: t.id,
      name: t.name,
      host: t.domains[0],
      blurb: t.blurb,
      installed: installed.has(t.id),
    }));
  },
  async installStarter(id) {
    const t = STARTER_THEMES.find(t => t.id === id);
    if (!t) throw new Error('unknown starter theme');
    const dup = styleMan.getAll().some(s => s[kStarterTag] === id);
    if (dup) return {ok: true, already: true};
    const [res] = await styleMan.importMany([{
      [kStarterTag]: t.id,
      name: t.name,
      enabled: true,
      sections: [{
        code: t.code,
        domains: [...t.domains],
      }],
    }]);
    if (res.err) throw new Error(String(res.err));
    return {ok: true, already: false, id: res.style && res.style.id};
  },
  async installAllStarters() {
    let added = 0;
    for (const t of STARTER_THEMES) {
      const r = await zlsApi.installStarter(t.id);
      if (r.ok && !r.already) added++;
    }
    return {added, total: STARTER_THEMES.length};
  },

  /* ---------------------------------------------- one-click full backup */
  /** Single-file envelope: styles + non-default prefs + order + lz values. */
  async exportFullBackup() {
    const prefsObj = deepCopy(prefs.__values);
    for (const key in prefsObj) {
      if (!Object.prototype.hasOwnProperty.call(prefs.__defaults, key)) {
        delete prefsObj[key];
      }
    }
    const [order, lz, styles] = await Promise.all([
      styleMan.getOrder(),
      chromeSync.getLZValues(),
      Promise.resolve(styleMan.getAll()),
    ]);
    return {
      app: 'zovo-styles',
      kind: 'full-backup',
      version: 1,
      created: new Date().toISOString(),
      styles: deepCopy(styles),
      order,
      [STORAGE_KEY]: prefsObj,
      ...lz,
    };
  },
  /**
   * Restore accepts the fork envelope OR an upstream Stylus backup
   * (array of styles / {doc}). Returns a human summary.
   */
  async importFullBackup(json) {
    let styles;
    let settings;
    let order;
    if (Array.isArray(json)) {
      styles = json; // upstream format
    } else if (json && json._rev && json._rev === json.doc?._rev) {
      styles = [json.doc]; // upstream couch export
    } else if (json && json.kind === 'full-backup' && Array.isArray(json.styles)) {
      styles = json.styles;
      settings = json[STORAGE_KEY];
      order = json.order;
    } else if (json && Array.isArray(json.styles)) {
      styles = json.styles;
      settings = json[STORAGE_KEY];
      order = json.order;
    } else {
      throw new Error('Not a Zovo Styles or Stylus backup file');
    }
    const results = await styleMan.importMany(styles);
    const imported = results.filter(r => !r.err).length;
    const failed = results.length - imported;
    if (settings && typeof settings === 'object') {
      for (const k in settings) {
        if (Object.prototype.hasOwnProperty.call(prefs.__defaults, k)) {
          try { prefs.set(k, settings[k]); } catch { /* unknown/readonly pref */ }
        }
      }
    }
    if (Array.isArray(order) && order.length) {
      try { await styleMan.setOrder(order); } catch { /* legacy order data */ }
    }
    return {imported, failed, settings: !!settings};
  },
};

Object.assign(API, {zls: zlsApi});
