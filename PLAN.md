# Implementation Plan: Dead Bookmarks Finder Chrome Extension

## Overview
A Chrome extension (Manifest V3) that scans user bookmarks, identifies broken/dead links via HEAD requests, and allows batch deletion.

## Files to Create
- `manifest.json` - Extension manifest (V3)
- `popup.html` - Main popup UI (all 4 screens)
- `popup.js` - Application logic
- `styles.css` - Styling
- `icons/` - Extension icons (16x16, 48x48, 128x128)

---

## Step-by-Step Implementation

### Step 1: Create manifest.json
```json
{
  "manifest_version": 3,
  "name": "Dead Bookmarks Finder",
  "version": "1.0",
  "description": "Find and remove broken bookmark links",
  "permissions": ["bookmarks"],
  "host_permissions": ["<all_urls>"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### Step 2: Create popup.html
Structure with 4 screens (divs) that toggle visibility:
- `#screen-welcome` - Welcome screen with description + "Find dead bookmarks" button
- `#screen-scanning` - Progress bar + status text
- `#screen-results` - Statistics + table with checkboxes + "Delete" button
- `#screen-completion` - Success message, auto-redirect to welcome

### Step 3: Create styles.css
- Popup dimensions (~400x500px)
- Screen visibility toggling (`.screen.active`)
- Progress bar styling
- Table styling with checkboxes
- Button styling
- Statistics display

### Step 4: Create popup.js

#### 4.1 Screen Management
```javascript
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}
```

#### 4.2 Bookmark Fetching
```javascript
async function getAllBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks = [];

  function traverse(nodes) {
    for (const node of nodes) {
      if (node.url) bookmarks.push({ id: node.id, title: node.title, url: node.url });
      if (node.children) traverse(node.children);
    }
  }

  traverse(tree);
  return bookmarks;
}
```

#### 4.3 URL Checking (Iframe Method)
```javascript
async function checkUrl(url) {
  // Skip non-http URLs
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { status: 'skipped', reason: 'non-http' };
  }

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ status: 'dead', reason: 'timeout' });
    }, 10000);

    const cleanup = () => {
      clearTimeout(timeout);
      iframe.remove();
    };

    iframe.onload = () => {
      cleanup();
      resolve({ status: 'alive' });
    };

    iframe.onerror = () => {
      cleanup();
      resolve({ status: 'dead', reason: 'load-error' });
    };

    document.body.appendChild(iframe);
    iframe.src = url;
  });
}
```

#### 4.4 Scanning Process
```javascript
async function scanBookmarks() {
  showScreen('screen-scanning');
  const bookmarks = await getAllBookmarks();

  const results = { total: 0, checked: 0, dead: [], skipped: 0 };

  for (let i = 0; i < bookmarks.length; i++) {
    updateProgress(i, bookmarks.length);
    const result = await checkUrl(bookmarks[i].url);

    if (result.status === 'skipped') {
      results.skipped++;
    } else {
      results.checked++;
      if (result.status === 'dead') {
        results.dead.push(bookmarks[i]);
      }
    }
    results.total++;
  }

  showResults(results);
}
```

#### 4.5 Results Display
- Show statistics (total, checked, dead, skipped)
- Populate table with dead bookmarks (checkbox + title + url)
- Handle edge cases (no bookmarks, no dead links)

#### 4.6 Deletion Logic
```javascript
async function deleteSelectedBookmarks() {
  const checkboxes = document.querySelectorAll('#dead-list input:checked');
  let deleted = 0;

  for (const checkbox of checkboxes) {
    await chrome.bookmarks.remove(checkbox.dataset.id);
    deleted++;
  }

  showCompletion(deleted);
}
```

#### 4.7 Completion Screen
- Show "Deleted XX dead links" message
- Auto-redirect to welcome screen after 3 seconds

### Step 5: Create Icons
Create simple placeholder icons (16x16, 48x48, 128x128 PNG files) in `icons/` directory.

---

## Edge Cases Handling

| Scenario | Behavior |
|----------|----------|
| No bookmarks | Show "No bookmarks to process" + stats + Back button |
| No dead links | Show "No dead links found" + stats + Back button |
| Skipped URLs | Include in stats: "X bookmarks could not be checked" |
| Network errors | Treat as dead (timeout, connection refused, etc.) |

---

## Verification

1. Load extension in Chrome via `chrome://extensions` (Developer mode)
2. Click extension icon to open popup
3. Test with various bookmark scenarios:
   - Normal working URLs
   - Known dead URLs (e.g., `https://httpstat.us/404`)
   - `chrome://` and `javascript:` URLs
   - Empty bookmark folder
4. Verify deletion actually removes bookmarks
5. Check auto-redirect after deletion

---

## Notes on Iframe Method

**Trade-offs:**
- Sites with `X-Frame-Options: DENY` will fail to load even if alive (false positives)
- More memory-intensive than fetch (creates DOM elements)
- Slower for many bookmarks

**Mitigation:** Users can uncheck bookmarks they want to keep before deletion.
