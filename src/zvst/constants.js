/**
 * zvst/constants.js — fork (Zovo Styles) constants: namespace, license layer
 * 5.95 endpoints, Pro paywall URL. GPL-3.0-only (fork of openstyles/stylus).
 *
 * LICENSE_VERIFY_URL stays a SINGLE string literal (fleet extqa L3 lesson:
 * bundlers fold const concatenation, a single literal is greppable in dist).
 */

/** Unique CSS/DOM/storage namespace for this fleet member (layer 5.9). */
export const NAMESPACE = 'zvst8k2m';

/** Server-side product key for the license-verify endpoint. */
export const EXTENSION_KEY = 'zovostyles';

/** Where the Pro CTA sends the user. */
export const PRICING_URL = 'https://zovo.one/pricing';

/** License (fleet canonical layer 5.95; SHC/PaperFetch/Zovo-Night pattern). */
export const LICENSE_VERIFY_URL =
  'https://zgubxqomnbmxgbdhvwja.supabase.co/functions/v1/verify-extension-license';
export const LICENSE_VERIFY_TIMEOUT_MS = 8_000;
export const LICENSE_OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days

/** Pref keys (registered with defaults in src/js/prefs.js). */
export const P_LICENSE_KEY = 'zls.licenseKey';
export const P_LICENSE_CACHE = 'zls.licenseCache';
export const P_SITE_SCHEMES = 'zls.siteSchemes';
