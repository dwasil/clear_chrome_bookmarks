const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../..');

async function launchBrowser() {
  return puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });
}

async function getExtensionId(browser) {
  // Poll targets until the extension service worker appears
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const targets = await browser.targets();
    const sw = targets.find(
      (t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')
    );
    if (sw) return new URL(sw.url()).hostname;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Extension service worker not found within 5 seconds');
}

/**
 * Open a fresh popup page with mocked chrome.bookmarks, fetch, storage, and runtime.
 *
 * Because scanning runs in the background service worker (a separate JS context),
 * we mock chrome.runtime.sendMessage to intercept START_SCAN / CANCEL_SCAN /
 * DELETE_BOOKMARKS messages and simulate background logic inline using the
 * already-mocked chrome.bookmarks and fetch. This keeps the tests self-contained.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {object} opts
 * @param {Array}  opts.bookmarks      - value returned by chrome.bookmarks.getTree()
 * @param {object} opts.fetchResponses - map of url → { status: number }
 * @param {Array}  [opts.removeFailIds] - bookmark IDs for which remove() should reject
 */
async function openPopup(
  browser,
  { bookmarks = [], fetchResponses = {}, removeFailIds = [] } = {}
) {
  const extensionId = await getExtensionId(browser);
  const page = await browser.newPage();

  // Inject mocks before popup.js executes
  await page.evaluateOnNewDocument(
    /* eslint-disable no-undef */
    (bTree, fResponses, failIds) => {
      // --- chrome.bookmarks mocks ---
      chrome.bookmarks.getTree = () => Promise.resolve(bTree);

      window._removedIds = [];
      chrome.bookmarks.remove = (id) => {
        if (failIds.includes(id)) {
          return Promise.reject(new Error('Cannot remove bookmark'));
        }
        window._removedIds.push(id);
        return Promise.resolve();
      };

      // --- fetch mock ---
      globalThis.fetch = (url /*, options*/) => {
        const config = fResponses[url];
        const status = config ? config.status : 200;
        const ok = status >= 200 && status <= 399;
        return Promise.resolve({ ok, status });
      };

      // --- chrome.storage.local mock ---
      // Ensures restoreState() always sees clean state and shows the welcome screen,
      // regardless of what Chrome's real storage contains from a previous test run.
      chrome.storage.local.get = () => Promise.resolve({});
      chrome.storage.local.set = () => Promise.resolve();

      // --- chrome.runtime mock ---
      // Captures the popup's onMessage listener so we can call it directly
      // to simulate responses from the background service worker.
      let _popupListener = null;
      let _scanCancelled = false;

      chrome.runtime.onMessage.addListener = (fn) => {
        _popupListener = fn;
      };

      // Inline re-implementation of background.js scan/delete logic,
      // using the mocked chrome.bookmarks and fetch above.
      chrome.runtime.sendMessage = async (msg) => {
        if (msg.type === 'START_SCAN') {
          _scanCancelled = false;

          // Yield via a macrotask so Puppeteer's polling can observe the
          // scanning screen before the (instantaneous) mock scan completes.
          await new Promise((r) => setTimeout(r, 100));

          const tree = await chrome.bookmarks.getTree();
          const allBookmarks = [];
          function traverse(nodes) {
            for (const node of nodes) {
              if (node.url) allBookmarks.push({ id: node.id, title: node.title, url: node.url });
              if (node.children) traverse(node.children);
            }
          }
          traverse(tree);

          if (allBookmarks.length === 0) {
            _popupListener &&
              _popupListener({
                type: 'SCAN_COMPLETE',
                results: { total: 0, checked: 0, dead: [], skipped: 0 },
              });
            return;
          }

          const results = { total: allBookmarks.length, checked: 0, dead: [], skipped: 0 };

          for (let i = 0; i < allBookmarks.length; i++) {
            if (_scanCancelled) {
              return; // SCAN_CANCELLED already sent by the CANCEL_SCAN handler
            }

            const bookmark = allBookmarks[i];
            _popupListener &&
              _popupListener({
                type: 'SCAN_PROGRESS',
                current: i + 1,
                total: allBookmarks.length,
              });

            if (!bookmark.url.startsWith('http://') && !bookmark.url.startsWith('https://')) {
              results.skipped++;
              continue;
            }

            try {
              const resp = await globalThis.fetch(bookmark.url, { method: 'HEAD' });
              results.checked++;
              const status = resp.status;
              const alive = resp.ok || status === 401 || status === 403;
              if (!alive) results.dead.push(bookmark);
            } catch {
              results.checked++;
              results.dead.push(bookmark);
            }
          }

          _popupListener && _popupListener({ type: 'SCAN_COMPLETE', results });
        } else if (msg.type === 'CANCEL_SCAN') {
          _scanCancelled = true;
          _popupListener && _popupListener({ type: 'SCAN_CANCELLED' });
        } else if (msg.type === 'DELETE_BOOKMARKS') {
          let deleted = 0;
          for (const id of msg.ids) {
            try {
              await chrome.bookmarks.remove(id);
              deleted++;
            } catch {
              /* ignore remove failures */
            }
          }
          _popupListener && _popupListener({ type: 'DELETE_COMPLETE', deleted });
        }
      };
    } /* eslint-enable no-undef */,
    bookmarks,
    fetchResponses,
    removeFailIds
  );

  await page.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: 'domcontentloaded',
  });
  return page;
}

/** Wait until a screen element has the 'active' class. */
async function waitForScreen(page, screenId, timeout = 15000) {
  await page.waitForFunction(
    /* eslint-disable-next-line no-undef */
    (id) => document.getElementById(id)?.classList.contains('active'),
    { timeout },
    screenId
  );
}

/** Assert that exactly one screen is active and it is the expected one. */
async function assertScreen(page, screenId) {
  const activeId = await page.evaluate(
    /* eslint-disable-next-line no-undef */ () => {
      const el = document.querySelector('.screen.active');
      return el ? el.id : null;
    }
  );
  expect(activeId).toBe(screenId);
}

module.exports = { launchBrowser, openPopup, waitForScreen, assertScreen };
