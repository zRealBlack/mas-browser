/* ============================================================
   MAS BROWSER — RENDERER (ALL FUNCTIONALITY)
   ============================================================ */

// ── Constants ─────────────────────────────────────────
const SWATCHES = [
  { name: 'Default', light: '#e8e8ec', dark: '#1a1a1a' },
  { name: 'Rose', light: '#f5d5d5', dark: '#2a1a1a' },
  { name: 'Pink', light: '#f0c4d4', dark: '#2a1318' },
  { name: 'Mauve', light: '#e4cef0', dark: '#201520' },
  { name: 'Purple', light: '#d5ccf0', dark: '#1a1520' },
  { name: 'Blue', light: '#c8dbf0', dark: '#141a24' },
  { name: 'Teal', light: '#c4e8e0', dark: '#141e1a' },
  { name: 'Green', light: '#d0e8c8', dark: '#161e14' },
  { name: 'Peach', light: '#f0dcc4', dark: '#201a12' },
  { name: 'Sand', light: '#f0e4c8', dark: '#1e1a12' },
];

// ── State ─────────────────────────────────────────────
let account = JSON.parse(localStorage.getItem('mas-account'));
let theme = JSON.parse(localStorage.getItem('mas-theme') || '{"mode":"light","accentIdx":0}');
let settings = JSON.parse(localStorage.getItem('mas-settings') || '{"sidebarSync":false,"backdrop":"none","pip":false}');
let profiles = JSON.parse(localStorage.getItem('mas-profiles') || '[{"id":"default","name":"Default"}]');
let activeProfileId = localStorage.getItem('mas-active-profile') || 'default';
let isIncognito = false;
const incognitoPartition = 'incognito-' + Date.now();

let tabs = [], activeTabId = null, sidebarOpen = true, tabIdCounter = 0;
let menuOpen = false, siteInfoOpen = false, siMoreOpen = false, downloadsOpen = false;
let downloads = JSON.parse(localStorage.getItem('mas-downloads') || '[]');

// ── DOM refs ──────────────────────────────────────────
const $ = s => document.querySelector(s);
const sidebar = $('#sidebar');
const pinnedList = $('#pinned-tabs');
const tabListEl = $('#tab-list');
const tabCountEl = $('#tab-count');
const cmdOverlay = $('#cmd-overlay');
const cmdInput = $('#cmd-input');
const cmdSugs = $('#cmd-sugs');
const settingsOverlay = $('#settings-overlay');
const appMenu = $('#app-menu');
const swatchContainer = $('#theme-swatches');
const siteInfoPanel = $('#site-info-panel');
const webviewWrap = $('#webview-wrap');
const newtabPage = $('#newtab-page');
const urlBar = $('#url-bar');
const urlText = $('#url-text');
const btnBack = $('#btn-back');
const btnFwd = $('#btn-fwd');
const btnReload = $('#btn-reload');
const downloadsPanel = $('#downloads-panel');
const dlListEl = $('#dl-list');
const btnDl = $('#btn-downloads');
const dlOverlay = $('#downloads-overlay');

// ── Helpers ───────────────────────────────────────────
function genId() { return `t${++tabIdCounter}`; }
function domainLetter(url) { try { return new URL(url).hostname.replace('www.', '').charAt(0).toUpperCase(); } catch { return '?'; } }
function prettyUrl(url) { try { const u = new URL(url); let d = u.hostname.replace('www.', ''); if (u.pathname !== '/') d += u.pathname; return d.length > 55 ? d.slice(0, 53) + '…' : d; } catch { return url; } }
function isUrlLike(s) { return /^https?:\/\//i.test(s) || (/^[\w-]+(\.[\w-]+)+/.test(s) && !/\s/.test(s)); }
function toUrl(s) { s = s.trim(); if (/^https?:\/\//i.test(s)) return s; if (isUrlLike(s)) return 'https://' + s; return 'https://www.google.com/search?q=' + encodeURIComponent(s); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// ── Theme System ──────────────────────────────────────
function applyTheme() {
  const mode = theme.mode || 'light';
  const idx = theme.accentIdx || 0;
  const swatch = SWATCHES[idx] || SWATCHES[0];
  document.documentElement.setAttribute('data-theme', mode);
  const sbColor = mode === 'dark' ? swatch.dark : swatch.light;
  document.documentElement.style.setProperty('--sidebar-bg', sbColor);
  window.electronAPI.setTheme(mode);
  save('mas-theme', theme);
}

function renderSwatches() {
  swatchContainer.innerHTML = SWATCHES.map((s, i) =>
    `<div class="swatch${i === theme.accentIdx ? ' active' : ''}" data-idx="${i}" style="background:${s.light}" title="${s.name}"></div>`
  ).join('');
  swatchContainer.querySelectorAll('.swatch').forEach(el => {
    el.addEventListener('click', () => {
      theme.accentIdx = parseInt(el.dataset.idx);
      applyTheme();
      renderSwatches();
    });
  });
}

// ── Profiles ──────────────────────────────────────────
function renderProfiles() {
  const container = $('#profile-list');
  if (!container) return;
  container.innerHTML = profiles.map(p =>
    `<div class="st-profile-row" data-pid="${p.id}">
      <div><div class="pr-name">${esc(p.name)}</div><div class="pr-sub">${p.id === activeProfileId ? 'Active profile' : 'Click to switch'}</div></div>
      <span class="pr-chev">›</span>
    </div>`
  ).join('');
  container.querySelectorAll('.st-profile-row').forEach(el => {
    el.addEventListener('click', () => {
      activeProfileId = el.dataset.pid;
      save('mas-active-profile', activeProfileId);
      renderProfiles();
    });
  });
}

$('#btn-new-profile').addEventListener('click', () => {
  const name = prompt('Enter profile name:');
  if (!name) return;
  const id = 'profile-' + Date.now();
  profiles.push({ id, name });
  save('mas-profiles', profiles);
  renderProfiles();
});

// ── Settings Panel ────────────────────────────────────
function openSettings() { settingsOverlay.classList.remove('hidden'); renderProfiles(); renderSwatches(); syncToggleUI(); }
function closeSettings() { settingsOverlay.classList.add('hidden'); }

function syncToggleUI() {
  $('#toggle-sync').checked = settings.sidebarSync;
  $('#sync-lbl').textContent = settings.sidebarSync ? 'On' : 'Off';
  $('#sync-status-text').textContent = settings.sidebarSync ? 'Sync enabled' : 'Sync disabled';
  $('#toggle-dark').checked = theme.mode === 'dark';
  $('#sel-backdrop').value = settings.backdrop || 'none';
}

$('#settings-close').addEventListener('click', closeSettings);
$('#settings-backdrop').addEventListener('click', closeSettings);
$('#btn-settings').addEventListener('click', openSettings);

$('#toggle-sync').addEventListener('change', e => {
  settings.sidebarSync = e.target.checked;
  save('mas-settings', settings);
  syncToggleUI();
});

$('#toggle-dark').addEventListener('change', e => {
  theme.mode = e.target.checked ? 'dark' : 'light';
  applyTheme();
  renderSwatches();
});

$('#sel-backdrop').addEventListener('change', e => {
  settings.backdrop = e.target.value;
  save('mas-settings', settings);
});

// ── App Menu ──────────────────────────────────────────
function toggleMenu() { menuOpen = !menuOpen; appMenu.classList.toggle('hidden', !menuOpen); closeSiteInfo(); }
function closeMenu() { menuOpen = false; appMenu.classList.add('hidden'); }

$('#btn-mas').addEventListener('click', e => { e.stopPropagation(); toggleMenu(); });

$('#mi-default').addEventListener('click', () => { window.electronAPI.setDefault(); closeMenu(); });
$('#mi-updates').addEventListener('click', () => { window.electronAPI.checkUpdates(); closeMenu(); });
$('#mi-import').addEventListener('click', async () => {
  closeMenu();
  const result = await window.electronAPI.importBookmarks();
  if (result.bookmarks.length > 0) {
    result.bookmarks.slice(0, 20).forEach(b => createTab(b.url, { pinned: true, activate: false }));
    alert(`Imported ${result.bookmarks.length} bookmarks from ${result.source}! (First 20 pinned)`);
  } else {
    alert('No bookmarks found in Chrome or Edge.');
  }
});
$('#mi-newtab').addEventListener('click', () => { createTab(''); closeMenu(); });
$('#mi-newwin').addEventListener('click', () => { window.electronAPI.newWindow(); closeMenu(); });
$('#mi-incognito').addEventListener('click', () => { window.electronAPI.newIncognito(); closeMenu(); });
$('#mi-settings').addEventListener('click', () => { openSettings(); closeMenu(); });
$('#mi-print').addEventListener('click', () => {
  const wv = $(`#wv-${activeTabId}`);
  if (wv) wv.print();
  closeMenu();
});
$('#mi-close-app').addEventListener('click', () => window.electronAPI.close());

// ── Sidebar New Tab Button ─────────────────────────────
$('#btn-new-tab').addEventListener('click', () => createTab(''));

// ── Copy Link ─────────────────────────────────────────
function copyCurrentUrl() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url) return;
  navigator.clipboard.writeText(tab.url).then(() => {
    showToast('Link copied!');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = tab.url; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Link copied!');
  });
}

function showToast(msg) {
  const existing = document.querySelector('.copy-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

$('#btn-copy-link').addEventListener('click', e => { e.stopPropagation(); copyCurrentUrl(); });

// ── Site Info Panel ───────────────────────────────────
function openSiteInfo() {
  const btn = $('#btn-site-info');
  const rect = btn.getBoundingClientRect();
  siteInfoPanel.style.top = (rect.bottom + 6) + 'px';
  siteInfoPanel.style.left = Math.max(8, rect.right - 280) + 'px';
  siteInfoPanel.classList.remove('hidden');
  siteInfoOpen = true;
  closeMenu();
}

function closeSiteInfo() {
  siteInfoPanel.classList.add('hidden');
  siteInfoOpen = false;
  siMoreOpen = false;
  $('#si-more-menu').classList.add('hidden');
}

$('#btn-site-info').addEventListener('click', e => {
  e.stopPropagation();
  if (siteInfoOpen) closeSiteInfo(); else openSiteInfo();
});

$('#btn-share-url').addEventListener('click', () => {
  copyCurrentUrl();
  closeSiteInfo();
});

$('#btn-si-more').addEventListener('click', e => {
  e.stopPropagation();
  siMoreOpen = !siMoreOpen;
  $('#si-more-menu').classList.toggle('hidden', !siMoreOpen);
});

$('#si-clear-cache').addEventListener('click', () => { showToast('Cache cleared'); closeSiteInfo(); });
$('#si-clear-cookies').addEventListener('click', () => { showToast('Cookies cleared'); closeSiteInfo(); });
$('#si-manage-ext').addEventListener('click', () => { showToast('Extensions manager coming soon'); closeSiteInfo(); });
$('#si-add-ext').addEventListener('click', () => { showToast('Extension store coming soon'); closeSiteInfo(); });
$('#si-all-settings').addEventListener('click', () => { openSettings(); closeSiteInfo(); });

$('#toggle-pip').addEventListener('change', e => {
  settings.pip = e.target.checked;
  save('mas-settings', settings);
  showToast(settings.pip ? 'Picture-in-Picture enabled' : 'Picture-in-Picture disabled');
});

$('#toggle-pip').checked = settings.pip || false;

// ── Close dropdowns on outside click ──────────────────
document.addEventListener('click', e => {
  if (menuOpen && !appMenu.contains(e.target) && e.target.id !== 'btn-mas') closeMenu();
  if (siteInfoOpen && !siteInfoPanel.contains(e.target) && e.target.id !== 'btn-site-info' && !e.target.closest('#btn-site-info')) closeSiteInfo();
  if (downloadsOpen && !downloadsPanel.contains(e.target) && e.target.id !== 'btn-downloads' && !e.target.closest('#btn-downloads')) closeDownloads();
  const updateNotif = $('#update-notification');
  if (!updateNotif.classList.contains('hidden') && !updateNotif.contains(e.target) && e.target.id !== 'btn-close-update') updateNotif.classList.add('hidden');
});

// ── Downloads Management ──────────────────────────────
function toggleDownloads() {
  downloadsOpen = !downloadsOpen;
  downloadsPanel.classList.toggle('hidden', !downloadsOpen);
  if (downloadsOpen) { closeMenu(); closeSiteInfo(); renderDownloads(); }
}

function closeDownloads() {
  downloadsOpen = false;
  downloadsPanel.classList.add('hidden');
}

function updateDownload(data) {
  let dl = downloads.find(d => d.id === data.id);
  if (!dl) {
    dl = { id: data.id, fileName: data.fileName, state: 'progressing', receivedBytes: 0, totalBytes: data.totalBytes };
    downloads.unshift(dl);
    showDownloadsButton(true);
  }

  if (data.state) dl.state = data.state;
  if (data.receivedBytes !== undefined) dl.receivedBytes = data.receivedBytes;
  if (data.totalBytes !== undefined) dl.totalBytes = data.totalBytes;
  if (data.savePath !== undefined) dl.savePath = data.savePath;

  save('mas-downloads', downloads);
  renderDownloads();
  checkActiveDownloads();
}

function checkActiveDownloads() {
  const active = downloads.some(d => d.state === 'progressing');
  btnDl.classList.toggle('active', active);
}

function showDownloadsButton(show) {
  btnDl.style.opacity = show ? '1' : '0.4';
}


function renderDownloads() {
  const html = downloads.slice(0, 10).map(dl => renderDlItem(dl)).join('');
  dlListEl.innerHTML = html || '<div class="cmd-hint">No recent downloads</div>';

  // Update overlay if open
  if (!dlOverlay.classList.contains('hidden')) {
    $('#dl-full-list').innerHTML = downloads.map(dl => renderDlItem(dl)).join('');
  }
}

function renderDlItem(dl) {
  const progress = dl.totalBytes > 0 ? (dl.receivedBytes / dl.totalBytes) * 100 : 0;
  const isDone = dl.state === 'completed';
  const isPaused = dl.state === 'paused';
  const isCanceled = dl.state === 'cancelled' || dl.state === 'interrupted';

  let statusText = dl.state.charAt(0).toUpperCase() + dl.state.slice(1);
  if (dl.state === 'progressing') statusText = `${Math.round(progress)}% • ${prettySize(dl.receivedBytes)} / ${prettySize(dl.totalBytes)}`;

  return `
    <div class="dl-item" data-id="${dl.id}">
      <div class="dl-item-main">
        <div class="dl-info" onclick="handleDlClick('${dl.id}', 'folder')">
          <div class="dl-name">${esc(dl.fileName)}</div>
          <div class="dl-status">${statusText}</div>
        </div>
        <div class="dl-actions">
          ${!isDone && !isCanceled ? `
            ${isPaused ?
        `<button title="Resume" onclick="handleDlClick('${dl.id}', 'resume')">▶</button>` :
        `<button title="Pause" onclick="handleDlClick('${dl.id}', 'pause')">Ⅱ</button>`
      }
            <button title="Cancel" onclick="handleDlClick('${dl.id}', 'cancel')">✕</button>
          ` : ''}
          <button title="Show in Folder" onclick="handleDlClick('${dl.id}', 'folder')">
            <svg width="14" height="14" viewBox="0 0 16 16"><path d="M1 3h5l2 2h7v9H1V3z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          </button>
        </div>
      </div>
      ${dl.state === 'progressing' || isPaused ? `
        <div class="dl-progress-container">
          <div class="dl-progress-bar ${isPaused ? 'paused' : ''}" style="width: ${progress}%"></div>
        </div>
      ` : ''}
    </div>`;
}

window.handleDlClick = (id, action) => {
  const dl = downloads.find(d => d.id === id);
  if (!dl) return;

  if (action === 'folder') {
    if (dl.savePath) window.electronAPI.showDownloadInFolder(dl.savePath);
  } else if (action === 'pause') {
    window.electronAPI.pauseDownload(id);
  } else if (action === 'resume') {
    window.electronAPI.resumeDownload(id);
  } else if (action === 'cancel') {
    window.electronAPI.cancelDownload(id);
  } else if (action === 'open' && dl.state === 'completed') {
    window.electronAPI.openDownload(dl.savePath);
  }
};


function prettySize(b) {
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

btnDl.addEventListener('click', e => { e.stopPropagation(); toggleDownloads(); });
$('#btn-clear-dl').addEventListener('click', () => { downloads = []; save('mas-downloads', downloads); renderDownloads(); showDownloadsButton(false); });

$('#btn-show-all-dl').addEventListener('click', () => {
  dlOverlay.classList.remove('hidden');
  renderDownloads();
  closeDownloads();
});

$('#dl-overlay-close').addEventListener('click', () => dlOverlay.classList.add('hidden'));
$('#dl-overlay-backdrop').addEventListener('click', () => dlOverlay.classList.add('hidden'));

// Listen for download events from main process
window.electronAPI.onDownloadStarted(data => {
  updateDownload(data);
  if (!downloadsOpen) toggleDownloads();
});
window.electronAPI.onDownloadUpdated(data => updateDownload(data));
window.electronAPI.onDownloadDone(data => updateDownload(data));

// Initial check for button visibility
if (downloads.length > 0) showDownloadsButton(true);

// ── Update Notification ──────────────────────────────
const updateNotif = $('#update-notification');
const updateStatus = $('#update-status');
const btnInstallUpdate = $('#btn-install-update');

$('#btn-close-update').addEventListener('click', () => updateNotif.classList.add('hidden'));
btnInstallUpdate.addEventListener('click', () => window.electronAPI.installUpdate());

window.electronAPI.onUpdateAvailable(info => {
  updateStatus.textContent = `Version ${info.version} is available. Downloading...`;
  updateNotif.classList.remove('hidden');
});

window.electronAPI.onUpdateProgress(p => {
  updateStatus.textContent = `Downloading update: ${Math.round(p.percent)}%`;
});

window.electronAPI.onUpdateDownloaded(info => {
  updateStatus.textContent = `Version ${info.version} downloaded and ready.`;
  btnInstallUpdate.style.display = 'block';
  updateNotif.classList.remove('hidden');
});

window.electronAPI.onUpdateError(err => {
  console.error('Update error:', err);
  // Keep it quiet unless user manually checked
});

window.electronAPI.onNewTabFromMain(url => createTab(url));

// ── Tab Management ────────────────────────────────────
function getPartition() {
  if (isIncognito) return incognitoPartition;
  return 'persist:profile-' + activeProfileId;
}

function createTab(url, opts = {}) {
  const id = genId();
  const { pinned = false, activate = true } = opts;
  const tab = { id, url: url || '', title: 'New Tab', favicon: null, pinned, loading: false };
  tabs.push(tab);

  if (url) {
    const wv = document.createElement('webview');
    wv.id = `wv-${id}`;
    wv.src = toUrl(url);
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('partition', getPartition());
    wireWebview(wv, id);
    webviewWrap.appendChild(wv);
  }

  renderTabEl(tab);
  updateCount();
  if (activate) switchTab(id);
  return id;
}

function switchTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  $('#main-col').style.display = 'flex';

  webviewWrap.querySelectorAll('webview.active').forEach(w => w.classList.remove('active'));
  document.querySelectorAll('.tab-item.active').forEach(el => el.classList.remove('active'));

  activeTabId = id;
  let wv = document.getElementById(`wv-${id}`);
  if (wv) {
    wv.classList.add('active');
    newtabPage.classList.remove('active');
  } else {
    newtabPage.classList.add('active');
  }

  const el = document.querySelector(`.tab-item[data-id="${id}"]`);
  if (el) { el.classList.add('active'); el.classList.remove('unread'); }

  updateUrlBar(tab);
  updateNav();
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  const wv = document.getElementById(`wv-${id}`); if (wv) wv.remove();
  const el = document.querySelector(`.tab-item[data-id="${id}"]`); if (el) el.remove();
  tabs.splice(idx, 1);
  updateCount();

  if (tabs.length === 0) { createTab(''); return; }
  if (activeTabId === id) switchTab(tabs[Math.min(idx, tabs.length - 1)].id);
}

function navigateTab(id, input) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  const url = toUrl(input);
  tab.url = url;
  let wv = document.getElementById(`wv-${id}`);

  if (!wv) {
    wv = document.createElement('webview');
    wv.id = `wv-${id}`;
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('partition', getPartition());
    wireWebview(wv, id);
    webviewWrap.appendChild(wv);
  }
  wv.loadURL(url);
  newtabPage.classList.remove('active');
  wv.classList.add('active');
}

function wireWebview(wv, id) {
  wv.addEventListener('page-title-updated', e => updateMeta(id, { title: e.title }));
  wv.addEventListener('page-favicon-updated', e => updateMeta(id, { favicon: e.favicons[0] }));
  wv.addEventListener('did-navigate', e => { updateMeta(id, { url: e.url }); updateNav(); });
  wv.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) { updateMeta(id, { url: e.url }); updateNav(); } });
  wv.addEventListener('did-start-loading', () => setLoading(id, true));
  wv.addEventListener('did-stop-loading', () => setLoading(id, false));
  wv.addEventListener('new-window', e => { e.preventDefault(); createTab(e.url); });
}

function updateMeta(id, info) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (info.title) tab.title = info.title;
  if (info.url) tab.url = info.url;
  if (info.favicon) tab.favicon = info.favicon;
  const el = document.querySelector(`.tab-item[data-id="${id}"]`);
  if (el) {
    if (info.title) el.querySelector('.tab-title').textContent = info.title;
    if (info.favicon) {
      const img = el.querySelector('.tab-fav'); const letter = el.querySelector('.tab-fav-letter');
      if (img) { img.src = info.favicon; img.style.display = ''; }
      if (letter) letter.style.display = 'none';
    }
  }
  if (id !== activeTabId && info.title) {
    const tabEl = document.querySelector(`.tab-item[data-id="${id}"]`);
    if (tabEl) tabEl.classList.add('unread');
  }
  if (id === activeTabId) updateUrlBar(tab);
}

function setLoading(id, v) {
  const tab = tabs.find(t => t.id === id); if (tab) tab.loading = v;
  const el = document.querySelector(`.tab-item[data-id="${id}"]`); if (el) el.classList.toggle('loading', v);
}

function renderTabEl(tab) {
  const el = document.createElement('div');
  el.className = 'tab-item'; el.dataset.id = tab.id;
  el.innerHTML = `
    <div class="tab-dot"></div><div class="tab-spinner"></div>
    ${tab.favicon ? `<img class="tab-fav" src="${tab.favicon}" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : `<img class="tab-fav" style="display:none" draggable="false">`}
    <div class="tab-fav-letter" ${tab.favicon ? 'style="display:none"' : ''}>${domainLetter(tab.url || 'about:blank')}</div>
    <span class="tab-title">${esc(tab.title)}</span>
    <button class="tab-close" title="Close"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>`;
  el.addEventListener('click', () => switchTab(tab.id));
  el.querySelector('.tab-close').addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
  (tab.pinned ? pinnedList : tabListEl).appendChild(el);
}

function updateCount() { tabCountEl.textContent = tabs.filter(t => !t.pinned).length; }
function updateUrlBar(tab) {
  urlText.textContent = (!tab || !tab.url) ? 'Search or Enter URL...' : prettyUrl(tab.url);
}
function updateNav() {
  if (!activeTabId) return;
  const wv = document.getElementById(`wv-${activeTabId}`);
  if (!wv) { btnBack.disabled = true; btnFwd.disabled = true; return; }
  try { btnBack.disabled = !wv.canGoBack(); btnFwd.disabled = !wv.canGoForward(); } catch { }
}

// ── Top Bar Delegation ────────────────────────────────
btnBack.addEventListener('click', () => { const wv = document.getElementById(`wv-${activeTabId}`); if (wv) wv.goBack(); });
btnFwd.addEventListener('click', () => { const wv = document.getElementById(`wv-${activeTabId}`); if (wv) wv.goForward(); });
btnReload.addEventListener('click', () => {
  const wv = document.getElementById(`wv-${activeTabId}`);
  if (wv) {
    wv.reload();
    btnReload.classList.add('spinning');
    setTimeout(() => btnReload.classList.remove('spinning'), 600);
  }
});
urlBar.addEventListener('click', e => {
  if (e.target.closest('.tb-url-action')) return;
  openCmd();
});

// ── Command Bar ───────────────────────────────────────
function openCmd() { cmdOverlay.classList.remove('hidden'); cmdInput.value = ''; cmdInput.focus(); renderSugs(''); }
function closeCmd() { cmdOverlay.classList.add('hidden'); }

function renderSugs(q) {
  q = q.toLowerCase().trim();
  let items = tabs.filter(t => t.title.toLowerCase().includes(q) || (t.url && t.url.toLowerCase().includes(q)));
  if (!items.length && !q) { cmdSugs.innerHTML = '<div class="cmd-hint">Type a URL or search term…</div>'; return; }
  if (!items.length) { cmdSugs.innerHTML = ''; return; }
  cmdSugs.innerHTML = items.map((t, i) => `
    <div class="sug-item${i === 0 ? ' active' : ''}" data-id="${t.id}">
      ${t.favicon ? `<img class="sug-fav" src="${t.favicon}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : `<img class="sug-fav" style="display:none">`}
      <div class="sug-fav-letter" ${t.favicon ? 'style="display:none"' : ''}>${domainLetter(t.url || '')}</div>
      <div class="sug-body"><span class="sug-title">${esc(t.title)}</span><span class="sug-url">${esc(t.url || '')}</span></div>
      <span class="sug-action">Switch to Tab →</span>
    </div>`).join('');
  cmdSugs.querySelectorAll('.sug-item').forEach(el => el.addEventListener('click', () => { switchTab(el.dataset.id); closeCmd(); }));
}

cmdInput.addEventListener('input', () => { renderSugs(cmdInput.value); });
cmdInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); const v = cmdInput.value.trim(); if (v) navigateTab(activeTabId, v); else { const a = cmdSugs.querySelector('.sug-item.active'); if (a) switchTab(a.dataset.id); } closeCmd(); }
  else if (e.key === 'Escape') closeCmd();
});
$('#cmd-backdrop').addEventListener('click', closeCmd);

// ── Keyboard Shortcuts ────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'l') { e.preventDefault(); openCmd(); }
  if (e.ctrlKey && e.key === 't') { e.preventDefault(); createTab(''); }
  if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); if (e.shiftKey) window.electronAPI.newIncognito(); else window.electronAPI.newWindow(); }
  if (e.ctrlKey && e.key === ',') { e.preventDefault(); openSettings(); }
  if (e.ctrlKey && e.key === 'p') { e.preventDefault(); const wv = document.getElementById(`wv-${activeTabId}`); if (wv) wv.print(); }
  if (e.ctrlKey && e.shiftKey && e.key === 'C') { e.preventDefault(); copyCurrentUrl(); }
  if (e.altKey && e.key === 'F4') { e.preventDefault(); window.electronAPI.close(); }
});

// ── Hub & Spatial UI ──────────────────────────────────
let hubOpen = false;
function toggleHub(v) {
  hubOpen = (v !== undefined) ? v : !hubOpen;
  const viewer = $('#main-viewer');
  viewer.classList.toggle('minimized', hubOpen);
  if (hubOpen) closeDownloads();
}


$('#hub').addEventListener('click', () => toggleHub(false));
$('#hub-btn-dl').addEventListener('click', () => { toggleHub(false); toggleDownloads(); });

// ── Window/Tab Controls ───────────────────────────────
$('#btn-close').addEventListener('click', () => { if (activeTabId) closeTab(activeTabId); });
$('#btn-min').addEventListener('click', () => toggleHub(true));
$('#btn-max').addEventListener('click', () => window.electronAPI.maximize());

// ── New Tab Search FIX ────────────────────────────────
document.addEventListener('keydown', e => {
  const ntInput = document.getElementById('nt-search-input');
  if (ntInput && document.activeElement === ntInput && e.key === 'Enter') {
    const v = ntInput.value.trim();
    if (v) navigateTab(activeTabId, v);
  }
});


// ── OS Background Controls ────────────────────────────
$('#os-btn-close').addEventListener('click', () => window.electronAPI.close());
$('#os-btn-min').addEventListener('click', () => window.electronAPI.minimize());
$('#os-btn-max').addEventListener('click', () => window.electronAPI.maximize());

// ── Sidebar Toggle ────────────────────────────────────
$('#btn-sb-toggle').addEventListener('click', () => { sidebarOpen = !sidebarOpen; sidebar.classList.toggle('collapsed', !sidebarOpen); });

// ── Section Collapse ──────────────────────────────────
document.querySelectorAll('.sb-hdr[data-collapse]').forEach(hdr => {
  hdr.addEventListener('click', () => { hdr.classList.toggle('collapsed'); const g = hdr.nextElementSibling; if (g) g.classList.toggle('collapsed-group'); });
});

// ── Incognito Detection ───────────────────────────────
window.electronAPI.onSetIncognito(v => { isIncognito = v; if (v) document.title = 'MAS Browser (Incognito)'; });

// ── Print from main process ───────────────────────────
window.electronAPI.onTriggerPrint(() => { const wv = document.getElementById(`wv-${activeTabId}`); if (wv) wv.print(); });

// ── New Tab Clock ─────────────────────────────────────
function updateClock() {
  const el = document.getElementById('nt-clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);

// Inject richer new tab page HTML once DOM is ready
newtabPage.innerHTML = `
  <div class="nt-inner">
    <div id="nt-clock" class="nt-clock"></div>
    <img src="logo.png" style="width:100px; height:100px; border-radius:20px; display:block; margin: 0 auto 16px; box-shadow: 0 12px 32px rgba(0,0,0,0.25);" alt="MAS Browser">
    <div class="nt-search" id="nt-search-wrap">
      <svg width="16" height="16" viewBox="0 0 16 16" style="opacity:.5;flex-shrink:0"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <input id="nt-search-input" class="nt-search-input" placeholder="Search or enter URL..." spellcheck="false" autocomplete="off">
    </div>
    <p class="nt-sub">Press <kbd>Ctrl+L</kbd> to focus the address bar</p>
  </div>`;
updateClock();

// New tab search bar
document.addEventListener('keydown', e => {
  const ntInput = document.getElementById('nt-search-input');
  if (ntInput && document.activeElement === ntInput && e.key === 'Enter') {
    const v = ntInput.value.trim();
    if (v) { navigateTab(activeTabId, v); ntInput.value = ''; }
  }
});

// ── Context Menu ──────────────────────────────────────
const ctxMenu = $('#ctx-menu');

function showCtxMenu(e, items) {
  e.preventDefault();
  const x = e.clientX, y = e.clientY;
  ctxMenu.innerHTML = items.map(it => {
    if (it.type === 'sep') return '<div class="ctx-sep"></div>';
    return `
      <div class="ctx-item${it.disabled ? ' disabled' : ''}" onclick="handleCtxClick('${it.id}')">
        ${it.icon || ''}
        <span>${esc(it.label)}</span>
        ${it.key ? `<span class="ctx-key">${it.key}</span>` : ''}
      </div>`;
  }).join('');

  ctxMenu.classList.remove('hidden');
  const mH = ctxMenu.offsetHeight, mW = ctxMenu.offsetWidth;
  ctxMenu.style.top = (y + mH > window.innerHeight ? y - mH : y) + 'px';
  ctxMenu.style.left = (x + mW > window.innerWidth ? x - mW : x) + 'px';
}

const ctxIcons = {
  back: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fwd: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reload: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 3v3.5H10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  print: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M4 5V2h8v3M4 11H2V7h12v4h-2M4 9h8v5H4z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>',
  source: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M5 4L2 8l3 4M11 4l3 4-3 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  inspect: '<svg width="14" height="14" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.2"/></svg>',
  newTab: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

window.handleCtxClick = (id) => {
  ctxMenu.classList.add('hidden');
  const wv = document.getElementById(`wv-${activeTabId}`);
  switch (id) {
    case 'back': if (wv) wv.goBack(); break;
    case 'fwd': if (wv) wv.goForward(); break;
    case 'reload': if (wv) wv.reload(); break;
    case 'view-source': if (wv) window.electronAPI.viewSource(wv.getURL()); break;
    case 'inspect': if (wv) wv.inspectElement(lastCtxPos.x, lastCtxPos.y); break;
    case 'print': if (wv) wv.print(); break;
    case 'new-tab': createTab(''); break;
    case 'close-tab': if (activeTabId) closeTab(activeTabId); break;
  }
};

let lastCtxPos = { x: 0, y: 0 };
document.addEventListener('contextmenu', e => {
  if (e.target.closest('#sidebar')) {
    showCtxMenu(e, [
      { id: 'new-tab', label: 'New Tab', key: 'Ctrl+T', icon: ctxIcons.newTab },
      { id: 'sep', type: 'sep' },
      { id: 'rename', label: 'Rename Space...', disabled: true },
      { id: 'theme', label: 'Edit Theme Color...', disabled: true },
    ]);
  }
});

document.addEventListener('click', () => ctxMenu.classList.add('hidden'));

window.electronAPI.onWebviewContextMenu((e, data) => {
  lastCtxPos = { x: data.x, y: data.y };
  const items = [
    { id: 'back', label: 'Back', key: 'Alt+←', icon: ctxIcons.back, disabled: !data.canGoBack },
    { id: 'fwd', label: 'Forward', key: 'Alt+→', icon: ctxIcons.fwd, disabled: !data.canGoForward },
    { id: 'reload', label: 'Reload', key: 'Ctrl+R', icon: ctxIcons.reload },
    { id: 'sep', type: 'sep' },
    { id: 'print', label: 'Print...', key: 'Ctrl+P', icon: ctxIcons.print },
    { id: 'sep', type: 'sep' },
    { id: 'view-source', label: 'View page source', key: 'Ctrl+U', icon: ctxIcons.source },
    { id: 'inspect', label: 'Inspect', icon: ctxIcons.inspect }
  ];
  const ev = { clientX: data.x, clientY: data.y, preventDefault: () => { } };
  showCtxMenu(ev, items);
});


// ── Boot ──────────────────────────────────────────────
applyTheme();
createTab('https://www.google.com');

