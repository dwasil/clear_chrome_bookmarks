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
      '--disable-setuid-sandbox'
    ]
  });
}

async function getExtensionId(browser) {
  // Poll targets until the extension service worker appears
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const targets = await browser.targets();
    const sw = targets.find(
      t => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')
    );
    if (sw) return new URL(sw.url()).hostname;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Extension service worker not found within 5 seconds');
}

/**
 * Open a fresh popup page with mocked chrome.bookmarks and fetch.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {object} opts
 * @param {Array}  opts.bookmarks      - value returned by chrome.bookmarks.getTree()
 * @param {object} opts.fetchResponses - map of url → { status: number }
 * @param {Array}  [opts.removeFailIds] - bookmark IDs for which remove() should reject
 */
async function openPopup(browser, { bookmarks = [], fetchResponses = {}, removeFailIds = [] } = {}) {
  const extensionId = await getExtensionId(browser);
  const page = await browser.newPage();

  // Inject mocks before popup.js executes
  await page.evaluateOnNewDocument(
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
    },
    bookmarks,
    fetchResponses,
    removeFailIds
  );

  await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
  return page;
}

/** Wait until a screen element has the 'active' class. */
async function waitForScreen(page, screenId, timeout = 15000) {
  await page.waitForFunction(
    (id) => document.getElementById(id)?.classList.contains('active'),
    { timeout },
    screenId
  );
}

/** Assert that exactly one screen is active and it is the expected one. */
async function assertScreen(page, screenId) {
  const activeId = await page.evaluate(() => {
    const el = document.querySelector('.screen.active');
    return el ? el.id : null;
  });
  expect(activeId).toBe(screenId);
}

module.exports = { launchBrowser, openPopup, waitForScreen, assertScreen };
