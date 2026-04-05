// background.js — service worker
// Handles all scanning and deletion logic independently of the popup lifecycle.

let scanCancelled = false;

// Keep-alive: handling an alarm prevents Chrome from terminating the SW mid-scan
chrome.alarms.onAlarm.addListener(() => {});

// ── Bookmark helpers ──────────────────────────────────────────────────────────

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

function isCheckableUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

async function checkUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    if (
      response.ok ||
      response.status === 401 ||
      response.status === 403 ||
      (response.status >= 200 && response.status <= 399)
    ) {
      return { status: 'alive', code: response.status };
    }

    return { status: 'dead', code: response.status };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { status: 'dead', reason: 'timeout' };
    }
    return { status: 'dead', reason: error.message };
  }
}

// ── Messaging ─────────────────────────────────────────────────────────────────

// Sends a message to the popup if it's open; silently ignores if it's closed.
async function broadcastToPopup(msg) {
  try {
    await chrome.runtime.sendMessage(msg);
  } catch {
    // Popup not open — state is in storage, popup will read it on next open
  }
}

// ── Scan ──────────────────────────────────────────────────────────────────────

async function scanBookmarks() {
  scanCancelled = false;

  // Prevent SW termination during long scans (alarm every ~24 seconds)
  chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });

  await chrome.storage.local.set({
    scanStatus: 'scanning',
    scanProgress: { current: 0, total: 0 },
    scanResults: null,
  });

  const bookmarks = await getAllBookmarks();

  if (bookmarks.length === 0) {
    await finishScan({ total: 0, checked: 0, dead: [], skipped: 0 });
    return;
  }

  await chrome.storage.local.set({
    scanProgress: { current: 0, total: bookmarks.length },
  });

  const results = { total: bookmarks.length, checked: 0, dead: [], skipped: 0 };

  for (let i = 0; i < bookmarks.length; i++) {
    if (scanCancelled) {
      chrome.alarms.clear('keepalive');
      await chrome.storage.local.set({ scanStatus: 'idle' });
      await broadcastToPopup({ type: 'SCAN_CANCELLED' });
      return;
    }

    const bookmark = bookmarks[i];
    const progress = { current: i + 1, total: bookmarks.length };

    await chrome.storage.local.set({ scanProgress: progress });
    await broadcastToPopup({
      type: 'SCAN_PROGRESS',
      current: progress.current,
      total: progress.total,
    });

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

  await finishScan(results);
}

async function finishScan(results) {
  chrome.alarms.clear('keepalive');
  await chrome.storage.local.set({ scanStatus: 'done', scanResults: results });
  await broadcastToPopup({ type: 'SCAN_COMPLETE', results });
}

// ── Deletion ──────────────────────────────────────────────────────────────────

async function deleteBookmarks(ids) {
  let deleted = 0;

  for (const id of ids) {
    try {
      await chrome.bookmarks.remove(id);
      deleted++;
    } catch (error) {
      console.error('Failed to delete bookmark:', id, error);
    }
  }

  await chrome.storage.local.set({ scanStatus: 'idle', scanResults: null });
  await broadcastToPopup({ type: 'DELETE_COMPLETE', deleted });
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'START_SCAN') scanBookmarks();
  if (msg.type === 'CANCEL_SCAN') scanCancelled = true;
  if (msg.type === 'DELETE_BOOKMARKS') deleteBookmarks(msg.ids);
});
