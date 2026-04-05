const { launchBrowser, openPopup, waitForScreen, assertScreen } = require('./helpers');

// Fixture: 5 bookmarks — 3 http (2 dead, 1 alive), 1 chrome://, 1 javascript:
const BOOKMARKS = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: '10', title: 'Google', url: 'https://google.com' },
          { id: '11', title: 'Dead Site 1', url: 'https://dead1.example' },
          { id: '12', title: 'Dead Site 2', url: 'https://dead2.example' },
          { id: '13', title: 'Chrome NTP', url: 'chrome://newtab' },
          { id: '14', title: 'JS Link', url: 'javascript:void(0)' },
        ],
      },
    ],
  },
];

const FETCH_RESPONSES = {
  'https://google.com': { status: 200 },
  'https://dead1.example': { status: 404 },
  'https://dead2.example': { status: 500 },
};

describe('Happy path', () => {
  let browser;

  beforeAll(async () => {
    browser = await launchBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('welcome screen is shown on open', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await assertScreen(page, 'screen-welcome');
    await page.close();
  });

  test('click start → scanning screen appears', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-scanning');
    await assertScreen(page, 'screen-scanning');
    await page.close();
  });

  test('scan completes → results screen with correct stats and table', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    // Stats text
    const statsText = await page.$eval('#stats', (el) => el.textContent);
    expect(statsText).toContain('Total bookmarks: 5');
    expect(statsText).toContain('Checked: 3');
    expect(statsText).toContain('Dead links found: 2');
    expect(statsText).toContain('2 bookmarks could not be checked');

    // Table has 2 rows
    const rowCount = await page.$$eval('#dead-list tr', (rows) => rows.length);
    expect(rowCount).toBe(2);

    // Both checkboxes checked by default
    const checkedCount = await page.$$eval(
      '#dead-list input[type="checkbox"]:checked',
      (cbs) => cbs.length
    );
    expect(checkedCount).toBe(2);

    // Delete button enabled and shows count
    const btnText = await page.$eval('#btn-delete', (el) => el.textContent);
    expect(btnText).toContain('(2)');
    const btnDisabled = await page.$eval('#btn-delete', (el) => el.disabled);
    expect(btnDisabled).toBe(false);

    await page.close();
  });

  test('uncheck one row → select-all unchecked, button shows (1)', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    // Uncheck the first row checkbox
    await page.click('#dead-list tr:first-child input[type="checkbox"]');

    const selectAllChecked = await page.$eval('#select-all', (el) => el.checked);
    expect(selectAllChecked).toBe(false);

    const btnText = await page.$eval('#btn-delete', (el) => el.textContent);
    expect(btnText).toContain('(1)');

    await page.close();
  });

  test('delete selected → completion screen with correct message', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');

    // Uncheck one — delete only 1
    await page.click('#dead-list tr:first-child input[type="checkbox"]');
    await page.click('#btn-delete');
    await waitForScreen(page, 'screen-completion');

    const msg = await page.$eval('#completion-message', (el) => el.textContent);
    expect(msg).toContain('Deleted 1 dead link.');
    expect(msg).not.toContain('dead links.'); // singular form

    // Correct bookmark was removed
    // eslint-disable-next-line no-undef
    const removedIds = await page.evaluate(() => window._removedIds);
    expect(removedIds).toHaveLength(1);

    await page.close();
  });

  test('delete all selected → completion message with plural form', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');
    await page.click('#btn-delete');
    await waitForScreen(page, 'screen-completion');

    const msg = await page.$eval('#completion-message', (el) => el.textContent);
    expect(msg).toContain('Deleted 2 dead links.');

    // eslint-disable-next-line no-undef
    const removedIds = await page.evaluate(() => window._removedIds);
    expect(removedIds).toHaveLength(2);
    expect(removedIds).toContain('11');
    expect(removedIds).toContain('12');

    await page.close();
  });

  test('completion screen auto-redirects to welcome after 3 seconds', async () => {
    const page = await openPopup(browser, {
      bookmarks: BOOKMARKS,
      fetchResponses: FETCH_RESPONSES,
    });
    await page.click('#btn-start');
    await waitForScreen(page, 'screen-results');
    await page.click('#btn-delete');
    await waitForScreen(page, 'screen-completion');

    // Wait for auto-redirect (3s + buffer)
    await waitForScreen(page, 'screen-welcome', 5000);
    await assertScreen(page, 'screen-welcome');

    await page.close();
  });
});
