// DOM Elements
const screens = {
  welcome: document.getElementById('screen-welcome'),
  scanning: document.getElementById('screen-scanning'),
  results: document.getElementById('screen-results'),
  completion: document.getElementById('screen-completion')
};

const elements = {
  btnStart: document.getElementById('btn-start'),
  btnBack: document.getElementById('btn-back'),
  btnDelete: document.getElementById('btn-delete'),
  btnCancel: document.getElementById('btn-cancel'),
  selectAll: document.getElementById('select-all'),
  scanStatus: document.getElementById('scan-status'),
  scanProgress: document.getElementById('scan-progress'),
  progressBar: document.getElementById('progress-bar'),
  stats: document.getElementById('stats'),
  message: document.getElementById('message'),
  deadList: document.getElementById('dead-list'),
  resultsTableContainer: document.getElementById('results-table-container'),
  completionMessage: document.getElementById('completion-message')
};

// ── Screen Management ─────────────────────────────────────────────────────────

function showScreen(screenId) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenId].classList.add('active');

  if (screenId === 'results') {
    document.body.classList.add('wide');
  } else {
    document.body.classList.remove('wide');
  }
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function updateProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  elements.progressBar.style.width = `${percent}%`;
  elements.scanProgress.textContent = `${current} / ${total}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateDeleteButton() {
  const checkedCount = elements.deadList.querySelectorAll('input[type="checkbox"]:checked').length;
  elements.btnDelete.disabled = checkedCount === 0;
  elements.btnDelete.textContent = checkedCount > 0
    ? `Delete selected bookmarks (${checkedCount})`
    : 'Delete selected bookmarks';
}

function showResults(results) {
  showScreen('results');

  let statsHtml = `<p>Total bookmarks: ${results.total}</p>`;
  statsHtml += `<p>Checked: ${results.checked}</p>`;
  statsHtml += `<p class="dead-count">Dead links found: ${results.dead.length}</p>`;
  if (results.skipped > 0) {
    statsHtml += `<p class="skipped-count">${results.skipped} bookmarks could not be checked</p>`;
  }
  elements.stats.innerHTML = statsHtml;

  if (results.total === 0) {
    elements.message.textContent = 'No bookmarks to process';
    elements.message.className = 'message info';
    elements.resultsTableContainer.classList.add('hidden');
    elements.btnDelete.style.display = 'none';
    return;
  }

  if (results.dead.length === 0) {
    elements.message.textContent = 'No dead links found';
    elements.message.className = 'message success';
    elements.resultsTableContainer.classList.add('hidden');
    elements.btnDelete.style.display = 'none';
    return;
  }

  elements.message.textContent = '';
  elements.message.className = 'message';
  elements.resultsTableContainer.classList.remove('hidden');
  elements.btnDelete.style.display = '';
  elements.selectAll.checked = true;

  elements.deadList.innerHTML = '';
  results.dead.forEach(bookmark => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-id="${bookmark.id}" checked></td>
      <td>
        <span class="bookmark-title">${escapeHtml(bookmark.title || 'Untitled')}</span>
        <span class="bookmark-url" title="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.url)}</span>
      </td>
    `;
    elements.deadList.appendChild(tr);
  });

  updateDeleteButton();
}

function showCompletion(deletedCount) {
  showScreen('completion');
  elements.completionMessage.textContent = `Deleted ${deletedCount} dead link${deletedCount !== 1 ? 's' : ''}. Keep your bookmarks clean regularly!`;

  setTimeout(() => {
    showScreen('welcome');
  }, 3000);
}

// ── Background message listener ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SCAN_PROGRESS')   updateProgress(msg.current, msg.total);
  if (msg.type === 'SCAN_COMPLETE')   showResults(msg.results);
  if (msg.type === 'SCAN_CANCELLED')  showScreen('welcome');
  if (msg.type === 'DELETE_COMPLETE') showCompletion(msg.deleted);
});

// ── State restoration on popup open ──────────────────────────────────────────

async function restoreState() {
  const { scanStatus, scanProgress, scanResults } = await chrome.storage.local.get([
    'scanStatus', 'scanProgress', 'scanResults'
  ]);

  if (scanStatus === 'scanning') {
    elements.scanStatus.textContent = 'Checking URLs...';
    if (scanProgress) updateProgress(scanProgress.current, scanProgress.total);
    showScreen('scanning');
  } else if (scanStatus === 'done' && scanResults) {
    showResults(scanResults);
  } else {
    showScreen('welcome');
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

elements.btnStart.addEventListener('click', () => {
  elements.scanStatus.textContent = 'Fetching bookmarks...';
  updateProgress(0, 0);
  showScreen('scanning');
  chrome.runtime.sendMessage({ type: 'START_SCAN' });
});

elements.btnCancel.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CANCEL_SCAN' });
});

elements.btnBack.addEventListener('click', () => {
  showScreen('welcome');
});

elements.btnDelete.addEventListener('click', () => {
  const checkboxes = elements.deadList.querySelectorAll('input[type="checkbox"]:checked');
  const ids = Array.from(checkboxes).map(cb => cb.dataset.id);
  elements.btnDelete.disabled = true;
  elements.btnDelete.textContent = 'Deleting...';
  chrome.runtime.sendMessage({ type: 'DELETE_BOOKMARKS', ids });
});

elements.selectAll.addEventListener('change', (e) => {
  const checkboxes = elements.deadList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = e.target.checked);
  updateDeleteButton();
});

elements.deadList.addEventListener('change', (e) => {
  if (e.target.type === 'checkbox') {
    const checkboxes = elements.deadList.querySelectorAll('input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    elements.selectAll.checked = allChecked;
    updateDeleteButton();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

restoreState();
