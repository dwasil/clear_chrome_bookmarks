const { launchBrowser, openPopup, waitForScreen, assertScreen } = require('./helpers');

describe('Edge cases', () => {
  let browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  // ---------------------------------------------------------------------------
  // No bookmarks
  // ---------------------------------------------------------------------------
  test('no bookmarks → "No bookmarks to process", no table, no delete button', async () => {
    const page = await openPopup(browser, { bookmarks: [{ id: '0', title: '', children: [] }] });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    const msg = await page.$eval('#message', el => el.textContent);
    expect(msg).toBe('No bookmarks to process');

    const statsText = await page.$eval('#stats', el => el.textContent);
    expect(statsText).toContain('Total bookmarks: 0');

    const tableHidden = await page.$eval('#results-table-container', el => el.classList.contains('hidden'));
    expect(tableHidden).toBe(true);

    const btnVisible = await page.$eval('#btn-delete', el => el.style.display);
    expect(btnVisible).toBe('none');
    await page.close();
  });

  test('no bookmarks → Back button returns to welcome screen', async () => {
    const page = await openPopup(browser, { bookmarks: [{ id: '0', title: '', children: [] }] });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');
    await page.click('#btn-back');
    await assertScreen(page, 'screen-welcome');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // No dead links
  // ---------------------------------------------------------------------------
  test('all bookmarks alive → "No dead links found", no table, no delete button', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'A', url: 'https://a.example' },
          { id: '11', title: 'B', url: 'https://b.example' },
          { id: '12', title: 'C', url: 'https://c.example' }
        ]
      }]
    }];
    const fetchResponses = {
      'https://a.example': { status: 200 },
      'https://b.example': { status: 200 },
      'https://c.example': { status: 200 }
    };

    const page = await openPopup(browser, { bookmarks, fetchResponses });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    const msg = await page.$eval('#message', el => el.textContent);
    expect(msg).toBe('No dead links found');

    const tableHidden = await page.$eval('#results-table-container', el => el.classList.contains('hidden'));
    expect(tableHidden).toBe(true);

    const btnVisible = await page.$eval('#btn-delete', el => el.style.display);
    expect(btnVisible).toBe('none');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // All non-checkable URLs
  // ---------------------------------------------------------------------------
  test('all non-checkable URLs → skipped count shown, "No dead links found"', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'NTP',   url: 'chrome://newtab' },
          { id: '11', title: 'JS',    url: 'javascript:void(0)' },
          { id: '12', title: 'File',  url: 'file:///home/user' }
        ]
      }]
    }];

    const page = await openPopup(browser, { bookmarks });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    const statsText = await page.$eval('#stats', el => el.textContent);
    expect(statsText).toContain('Checked: 0');
    expect(statsText).toContain('3 bookmarks could not be checked');

    const msg = await page.$eval('#message', el => el.textContent);
    expect(msg).toBe('No dead links found');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // Cancel scan
  // ---------------------------------------------------------------------------
  test('cancel during scan → returns to welcome screen', async () => {
    const children = Array.from({ length: 20 }, (_, i) => ({
      id: String(100 + i), title: `Site ${i}`, url: `https://site${i}.example`
    }));
    const bookmarks = [{ id: '0', title: '', children: [{ id: '1', title: 'Bar', children }] }];

    // Slow fetch (400 ms per URL) gives enough time to cancel mid-scan
    const slowFetchResponses = Object.fromEntries(
      children.map(c => [c.url, { status: 200 }])
    );

    const page = await openPopup(browser, { bookmarks, fetchResponses: slowFetchResponses });

    // Override fetch to be slow after the page is loaded
    await page.evaluate(() => {
      globalThis.fetch = () => new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200 }), 400));
    });

    await page.click('#btn-start');
    await waitForScreen(page, 'screen-scanning');
    await page.click('#btn-cancel');
    await assertScreen(page, 'screen-welcome');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // Select-all / deselect-all
  // ---------------------------------------------------------------------------
  test('uncheck select-all → all rows unchecked, delete button disabled', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'Dead 1', url: 'https://d1.example' },
          { id: '11', title: 'Dead 2', url: 'https://d2.example' },
          { id: '12', title: 'Dead 3', url: 'https://d3.example' }
        ]
      }]
    }];
    const fetchResponses = {
      'https://d1.example': { status: 404 },
      'https://d2.example': { status: 404 },
      'https://d3.example': { status: 404 }
    };

    const page = await openPopup(browser, { bookmarks, fetchResponses });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    // All 3 checked by default
    let checked = await page.$$eval('#dead-list input[type="checkbox"]:checked', cbs => cbs.length);
    expect(checked).toBe(3);

    // Uncheck select-all
    await page.click('#select-all');
    checked = await page.$$eval('#dead-list input[type="checkbox"]:checked', cbs => cbs.length);
    expect(checked).toBe(0);

    const disabled = await page.$eval('#btn-delete', el => el.disabled);
    expect(disabled).toBe(true);

    // Re-check via select-all
    await page.click('#select-all');
    checked = await page.$$eval('#dead-list input[type="checkbox"]:checked', cbs => cbs.length);
    expect(checked).toBe(3);

    const btnText = await page.$eval('#btn-delete', el => el.textContent);
    expect(btnText).toContain('(3)');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // XSS in bookmark title/URL
  // ---------------------------------------------------------------------------
  test('XSS payload in bookmark title is escaped, not executed', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: '<img src=x onerror="window._xss=1">', url: 'https://xss.example' }
        ]
      }]
    }];
    const fetchResponses = { 'https://xss.example': { status: 404 } };

    const page = await openPopup(browser, { bookmarks, fetchResponses });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    // XSS must NOT have fired
    const xssFired = await page.evaluate(() => window._xss);
    expect(xssFired).toBeUndefined();

    // The raw text should be visible (not interpreted as HTML)
    const cellText = await page.$eval('#dead-list .bookmark-title', el => el.textContent);
    expect(cellText).toContain('<img');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // chrome.bookmarks.remove fails for one bookmark
  // ---------------------------------------------------------------------------
  test('remove fails for one bookmark → others deleted, count reflects successes', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'Dead 1', url: 'https://fail.example' },
          { id: '11', title: 'Dead 2', url: 'https://ok1.example' },
          { id: '12', title: 'Dead 3', url: 'https://ok2.example' }
        ]
      }]
    }];
    const fetchResponses = {
      'https://fail.example': { status: 404 },
      'https://ok1.example':  { status: 404 },
      'https://ok2.example':  { status: 404 }
    };

    const page = await openPopup(browser, { bookmarks, fetchResponses, removeFailIds: ['10'] });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');
    await page.click('#btn-delete');
    await waitForScreen(page, 'screen-completion');

    // 1 failed silently, 2 succeeded
    const msg = await page.$eval('#completion-message', el => el.textContent);
    expect(msg).toContain('Deleted 2 dead links.');

    const removedIds = await page.evaluate(() => window._removedIds);
    expect(removedIds).toHaveLength(2);
    expect(removedIds).not.toContain('10');
    await page.close();
  });

  // ---------------------------------------------------------------------------
  // 401 / 403 responses are treated as alive
  // ---------------------------------------------------------------------------
  test('401 and 403 responses are treated as alive (not dead)', async () => {
    const bookmarks = [{
      id: '0', title: '', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'Auth',      url: 'https://auth.example' },
          { id: '11', title: 'Forbidden', url: 'https://forbidden.example' }
        ]
      }]
    }];
    const fetchResponses = {
      'https://auth.example':      { status: 401 },
      'https://forbidden.example': { status: 403 }
    };

    const page = await openPopup(browser, { bookmarks, fetchResponses });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    const msg = await page.$eval('#message', el => el.textContent);
    expect(msg).toBe('No dead links found');
    await page.close();
  });
});
