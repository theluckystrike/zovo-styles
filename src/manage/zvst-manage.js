/**
 * manage/zvst-manage.js — fork (Zovo Styles) manage-page additions: curated
 * starter theme pack installer + one-click full backup. GPL-3.0-only.
 */

import {messageBox} from '@/js/dom-util';
import {API} from '@/js/msg-api';

async function downloadFullBackup() {
  const data = await API.zls.exportFullBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zls-full-backup-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

async function renderStarters(root) {
  const list = await API.zls.starterList();
  root.textContent = '';
  for (const t of list) {
    const row = document.createElement('div');
    row.className = 'zls-starter-row';
    const meta = document.createElement('div');
    meta.className = 'zls-starter-meta';
    const name = document.createElement('b');
    name.textContent = t.name;
    const host = document.createElement('span');
    host.className = 'zls-starter-host';
    host.textContent = t.host;
    const blurb = document.createElement('div');
    blurb.className = 'zls-starter-blurb';
    blurb.textContent = t.blurb;
    meta.append(name, ' ', host, blurb);
    const btn = document.createElement('button');
    btn.textContent = t.installed ? 'Installed ✓' : 'Install';
    btn.disabled = t.installed;
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Installing…';
      try {
        await API.zls.installStarter(t.id);
        btn.textContent = 'Installed ✓';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Install';
        messageBox.alert(`Install failed: ${err.message || err}`);
      }
    };
    row.append(meta, btn);
    root.append(row);
  }
}

export default function initZvstManage() {
  const oneClick = document.getElementById('zls-oneclick');
  if (oneClick) oneClick.onclick = downloadFullBackup;
  const listRoot = document.getElementById('zls-starter-list');
  if (listRoot) renderStarters(listRoot);

  /* Empty state: show whenever the styles pane has no visible entries */
  const installed = document.getElementById('installed');
  const empty = document.getElementById('zls-empty');
  if (installed && empty) {
    const sync = () => {
      const any = installed.querySelector('.entry:not(.hidden):not(.not-matching)');
      empty.hidden = !!any;
    };
    new MutationObserver(sync).observe(installed, {childList: true, subtree: true,
      attributes: true, attributeFilter: ['class']});
    sync();
    const browse = document.getElementById('zls-empty-starters');
    if (browse) browse.onclick = e => {
      e.preventDefault();
      const det = document.getElementById('zls-starters');
      const d = det && det.querySelector('details');
      if (d) {
        d.open = true;
        det.scrollIntoView({block: 'start', behavior: 'smooth'});
      }
    };
  }

  // deep link from the popup "Themes" button
  if (location.hash === '#zls-starters') {
    const det = document.getElementById('zls-starters');
    const d = det && det.querySelector('details');
    if (d) {
      d.open = true;
      setTimeout(() => det.scrollIntoView({block: 'start'}), 300);
    }
  }
}
