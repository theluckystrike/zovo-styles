/**
 * edit/zvst-autofix.js — fork (Zovo Styles) Pro "Auto-fix" action in the
 * editor's lint panel: applies the deterministic safe fixes from
 * zvst/css-fixer.js to every plain-CSS section (dirty tracking picks the
 * change up for save). GPL-3.0-only.
 */

import {messageBox} from '@/js/dom-util';
import editor from './editor';
import {fixCss, isPlainCssMode} from '../zvst/css-fixer';
import {runPro} from '../zvst/pro-ui';

function fixAll() {
  const cms = editor.getEditors(true).filter(Boolean);
  let changed = 0;
  let skipped = 0;
  const allFixes = new Set();
  for (const cm of cms) {
    if (!isPlainCssMode(cm.options.mode)) {
      skipped++;
      continue;
    }
    const before = cm.getValue();
    const {output, fixes} = fixCss(before);
    fixes.forEach(f => allFixes.add(f));
    if (output !== before) {
      const cursor = cm.getCursor();
      cm.setValue(output);
      cm.setCursor(cursor);
      changed++;
    }
  }
  if (changed) {
    messageBox.alert(`Auto-fix applied: ${[...allFixes].join(', ')}.`);
  } else if (skipped) {
    messageBox.alert('Nothing safe to fix — auto-fix works on plain CSS sections only.');
  } else {
    messageBox.alert('Auto-fix found nothing it can safely fix.');
  }
}

export default function initAutofix() {
  const btn = document.getElementById('zls-autofix');
  if (!btn) return;
  btn.onclick = () => runPro('Auto-fix', fixAll);
}
