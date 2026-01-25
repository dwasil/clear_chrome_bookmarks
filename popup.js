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

// State
let scanResults = null;
let scanCancelled = false;

// Screen Management
function showScreen(screenId) {
  Object.values(screens).forEach(screen => screen.classList.remove('active'));
  screens[screenId].classList.add('active');
}

// Get all bookmarks recursively
async function getAllBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) {
        bookmarks.push({ id: node.id, title: node.title, url: node.url });
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return bookmarks;
}

// Check if URL is valid for checking (http/https only)
function isCheckableUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

// Check single URL using fetch
async function checkUrl(url) {
  console.log('Checking URL:', url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeoutId);
    console.log('Response for', url, ':', response.status);

    // Consider 2xx and 3xx as alive
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return { status: 'alive', code: response.status };
    }

    return { status: 'dead', code: response.status };
  } catch (error) {
    console.log('Error checking', url, ':', error.message);

    // AbortError means timeout
    if (error.name === 'AbortError') {
      return { status: 'dead', reason: 'timeout' };
    }

    return { status: 'dead', reason: error.message };
  }
}

// Update progress UI
function updateProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  elements.progressBar.style.width = `${percent}%`;
  elements.scanProgress.textContent = `${current} / ${total}`;
}

// Scan all bookmarks
async function scanBookmarks() {
  console.log('Starting bookmark scan...');
  scanCancelled = false;
  showScreen('scanning');
  elements.scanStatus.textContent = 'Fetching bookmarks...';
  updateProgress(0, 0);

  const bookmarks = await getAllBookmarks();
  console.log('Found', bookmarks.length, 'bookmarks');

  if (bookmarks.length === 0) {
    showResults({
      total: 0,
      checked: 0,
      dead: [],
      skipped: 0
    });
    return;
  }

  elements.scanStatus.textContent = 'Checking URLs...';

  const results = {
    total: bookmarks.length,
    checked: 0,
    dead: [],
    skipped: 0
  };

  for (let i = 0; i < bookmarks.length; i++) {
    // Check if scan was cancelled
    if (scanCancelled) {
      console.log('Scan cancelled by user');
      return;
    }

    const bookmark = bookmarks[i];
    updateProgress(i + 1, bookmarks.length);

    if (!isCheckableUrl(bookmark.url)) {
      results.skipped++;
      continue;
    }

    const result = await checkUrl(bookmark.url);
    results.checked++;

    if (result.status === 'dead') {
      results.dead.push(bookmark);
    }
  }

  showResults(results);
}

// Display results
function showResults(results) {
  scanResults = results;
  showScreen('results');

  // Build stats HTML
  let statsHtml = `<p>Total bookmarks: ${results.total}</p>`;
  statsHtml += `<p>Checked: ${results.checked}</p>`;
  statsHtml += `<p class="dead-count">Dead links found: ${results.dead.length}</p>`;
  if (results.skipped > 0) {
    statsHtml += `<p class="skipped-count">${results.skipped} bookmarks could not be checked</p>`;
  }
  elements.stats.innerHTML = statsHtml;

  // Handle edge cases
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

  // Show table with dead bookmarks
  elements.message.textContent = '';
  elements.message.className = 'message';
  elements.resultsTableContainer.classList.remove('hidden');
  elements.btnDelete.style.display = '';
  elements.selectAll.checked = true;

  // Populate table
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update delete button state
function updateDeleteButton() {
  const checkedCount = elements.deadList.querySelectorAll('input[type="checkbox"]:checked').length;
  elements.btnDelete.disabled = checkedCount === 0;
  elements.btnDelete.textContent = checkedCount > 0
    ? `Delete selected bookmarks (${checkedCount})`
    : 'Delete selected bookmarks';
}

// Delete selected bookmarks
async function deleteSelectedBookmarks() {
  const checkboxes = elements.deadList.querySelectorAll('input[type="checkbox"]:checked');
  let deleted = 0;

  elements.btnDelete.disabled = true;
  elements.btnDelete.textContent = 'Deleting...';

  for (const checkbox of checkboxes) {
    try {
      await chrome.bookmarks.remove(checkbox.dataset.id);
      deleted++;
    } catch (error) {
      console.error('Failed to delete bookmark:', checkbox.dataset.id, error);
    }
  }

  showCompletion(deleted);
}

// Show completion screen
function showCompletion(deletedCount) {
  showScreen('completion');
  elements.completionMessage.textContent = `Deleted ${deletedCount} dead link${deletedCount !== 1 ? 's' : ''}. Keep your bookmarks clean regularly!`;

  // Auto-redirect to welcome after 3 seconds
  setTimeout(() => {
    showScreen('welcome');
  }, 3000);
}

// Event Listeners
elements.btnStart.addEventListener('click', scanBookmarks);

elements.btnCancel.addEventListener('click', () => {
  scanCancelled = true;
  showScreen('welcome');
});

elements.btnBack.addEventListener('click', () => {
  showScreen('welcome');
});

elements.btnDelete.addEventListener('click', deleteSelectedBookmarks);

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
