// Post-deployment checks in a real browser: client navigation, Fumadocs UI,
// typography, the 408 knowledge2 directory flow and static search.
//
// Every scenario runs in its own browser context, so independent scenarios run
// concurrently; all of them run even when one fails, and each failure prints
// that scenario's failed requests.
//
// Usage: CHROME_BIN=... NODE_PATH=<dir with puppeteer-core> node scripts/verify-deployment-browser.cjs <url>
const puppeteer = require('puppeteer-core');
const {
  KNOWLEDGE2_COURSES,
  verifyKnowledge2Course,
  verifyKnowledge2Overview,
} = require('./verify-knowledge2-navigation.cjs');

const NOT_FOUND = 'This page could not be found.';
const CONCURRENCY = Number(process.env.BROWSER_CHECK_CONCURRENCY) || 4;

/** Waits until the navigation's RSC payloads have arrived instead of sleeping. */
const settle = (page) => page.waitForNetworkIdle({ idleTime: 300, timeout: 30000 }).catch(() => {});

async function assertNoNotFound(page, context) {
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes(NOT_FOUND)) {
    throw new Error(`${context} visibly rendered the Next.js 404 page. Body: ${text.slice(0, 400)}`);
  }
}

async function homepage(page, base) {
  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 120000 });
  await assertNoNotFound(page, 'Homepage');
  return 'path=' + (await page.evaluate(() => location.pathname));
}

function homeLink(href) {
  return async (page, base) => {
    await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 120000 });
    await page.click(`a[href="${href}"]`);
    await page.waitForFunction(
      (expected, notFound) => location.pathname === expected || document.body.innerText.includes(notFound),
      { timeout: 120000 },
      href,
      NOT_FOUND,
    );
    await settle(page);
    const path = await page.evaluate(() => location.pathname);
    if (path !== href) throw new Error('Client navigation landed on unexpected path: ' + path + ' expected=' + href);
    await assertNoNotFound(page, 'Client navigation to ' + href);
    return href + ' -> ' + path;
  };
}

async function deepAlgorithmLink(page, base) {
  await page.goto(base + '/docs/algorithm/', { waitUntil: 'networkidle2', timeout: 120000 });
  const deepHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map((element) => element.getAttribute('href'))
      .filter((href) => href && href.startsWith('/docs/algorithm/') && href !== '/docs/algorithm/');
    return links.find((href) => href.endsWith('/')) ?? links[0] ?? null;
  });
  if (!deepHref) throw new Error('Algorithm index exposes no internal document link to verify.');
  await page.click(`a[href="${deepHref}"]`);
  await page.waitForFunction(
    (expected, notFound) =>
      location.pathname === expected ||
      location.pathname === expected.replace(/\/$/, '') ||
      document.body.innerText.includes(notFound),
    { timeout: 120000 },
    deepHref,
    NOT_FOUND,
  );
  await settle(page);
  const deepPath = await page.evaluate(() => location.pathname);
  if (deepPath.replace(/\/$/, '') !== deepHref.replace(/\/$/, '')) {
    throw new Error('Deep Fumadocs client navigation failed: ' + deepPath + ' expected=' + deepHref);
  }
  await assertNoNotFound(page, 'Deep Fumadocs client navigation');
  return deepHref + ' -> ' + deepPath;
}

async function codeTabs(page, base) {
  const codeTabsPath = '/docs/algorithm/04-hash-table/05-%E5%BF%AB%E4%B9%90%E6%95%B0/';
  await page.goto(base + codeTabsPath, { waitUntil: 'networkidle2', timeout: 120000 });
  const languageTabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="tab"]'))
      .map((element) => element.textContent?.trim())
      .filter(Boolean),
  );
  for (const language of ['C++', 'Java', 'Python', 'Go', 'JavaScript']) {
    if (!languageTabs.includes(language)) {
      throw new Error('Missing Fumadocs code tab "' + language + '" on ' + codeTabsPath);
    }
  }
  const clickedJava = await page.evaluate(() => {
    const target = Array.from(document.querySelectorAll('[role="tab"]')).find(
      (element) => element.textContent?.trim() === 'Java',
    );
    if (!(target instanceof HTMLElement)) return false;
    target.click();
    return true;
  });
  if (!clickedJava) throw new Error('Could not click Java Fumadocs code tab.');
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('[role="tab"]')).some(
        (element) => element.textContent?.trim() === 'Java' && element.getAttribute('aria-selected') === 'true',
      ),
    { timeout: 30000 },
  );
  return 'tabs=' + languageTabs.join(', ') + '; switched to Java';
}

async function formatting(page, base) {
  const formattingPath = '/docs/408/knowledge2/operating_system/05-io-management/02-buffer-allocation-spooling/';
  await page.goto(base + formattingPath, { waitUntil: 'networkidle2', timeout: 120000 });
  const check = await page.evaluate(() => {
    const body = document.querySelector('#docs-body');
    if (!(body instanceof HTMLElement)) return { error: 'Missing #docs-body' };

    const expectedStrong = [
      '缓冲区（Buffer）',
      '磁盘高速缓存（Disk Cache）',
      '循环缓冲（Circular Buffer）',
      '缓冲池（Buffer Pool）',
      'DCT（Device Control Table，设备控制表）',
      'SPOOLing（Simultaneous Peripheral Operations On-Line）',
    ];
    const strongTexts = Array.from(body.querySelectorAll('strong')).map((element) => element.textContent?.trim() ?? '');
    const missingStrong = expectedStrong.filter((text) => !strongTexts.includes(text));
    const leakedMarkers = body.innerText.match(/\*\*[^*\n]+\*\*/g) ?? [];

    const table = body.querySelector('table');
    const wrapper = table?.parentElement;
    const head = table?.querySelector('th');
    if (!(table instanceof HTMLTableElement) || !(wrapper instanceof HTMLElement) || !(head instanceof HTMLTableCellElement)) {
      return { error: 'Missing Markdown table, wrapper, or table header', missingStrong, leakedMarkers };
    }

    const tableFontSize = getComputedStyle(table).fontSize;
    const originalHead = head.textContent ?? '';
    head.textContent = '超宽表头内容'.repeat(80);
    const headWhiteSpace = getComputedStyle(head).whiteSpace;
    const headerForcesOverflow = wrapper.scrollWidth > wrapper.clientWidth;
    head.textContent = originalHead;

    return { missingStrong, leakedMarkers, tableFontSize, headWhiteSpace, headerForcesOverflow };
  });
  if (check.error) throw new Error(check.error + ' ' + JSON.stringify(check));
  if (check.missingStrong.length > 0) {
    throw new Error('Missing rendered strong terms: ' + check.missingStrong.join(', '));
  }
  if (check.leakedMarkers.length > 0) {
    throw new Error('Raw Markdown strong markers leaked into the rendered page: ' + check.leakedMarkers.join(' | '));
  }
  if (check.tableFontSize !== '16px') throw new Error('Expected docs table font-size 16px, got ' + check.tableFontSize);
  if (check.headWhiteSpace !== 'nowrap') {
    throw new Error('Expected table header white-space nowrap, got ' + check.headWhiteSpace);
  }
  if (!check.headerForcesOverflow) throw new Error('Long table header content did not activate horizontal overflow.');
  return 'bold boundaries and table overflow typography: ' + JSON.stringify(check);
}

/** Verify the content-addressed ZBSearch files through the actual UI. */
async function search(page, base) {
  // Start on a page that cannot be the result, so the URL change proves navigation.
  const startPath = '/docs/408/knowledge2/operating_system/';
  await page.goto(base + startPath, { waitUntil: 'networkidle2', timeout: 120000 });
  await page.keyboard.down('Control');
  await page.keyboard.press('k');
  await page.keyboard.up('Control');
  await page.waitForSelector('[role="dialog"] input', { timeout: 30000 });
  await page.type('[role="dialog"] input', '二叉树');
  await page.waitForFunction(
    () => document.querySelector('[role="dialog"] [role="option"][aria-selected="true"]') !== null,
    { timeout: 60000 },
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    (start) => location.pathname !== start && location.pathname.startsWith('/docs/') && !document.querySelector('[role="dialog"] input'),
    { timeout: 60000 },
    startPath,
  );
  await settle(page);
  await assertNoNotFound(page, 'Search result navigation');
  return 'selected result -> ' + (await page.evaluate(() => location.pathname));
}

const SCENARIOS = [
  // The knowledge2 courses are the longest flows, so they start first.
  ...KNOWLEDGE2_COURSES.map((course) => [
    `knowledge2 ${course[0]}`,
    (page, base) => verifyKnowledge2Course(page, base, course).then(() => 'mobile overview, lectures, back navigation and sidebar'),
  ]),
  ['knowledge2 overview', (page, base) => verifyKnowledge2Overview(page, base).then(() => 'release and update date')],
  ['homepage', homepage],
  ...['/docs/politics/', '/docs/english/', '/docs/math/', '/docs/408/', '/blog/'].map((href) => [`home link ${href}`, homeLink(href)]),
  ['deep algorithm link', deepAlgorithmLink],
  ['code tabs', codeTabs],
  ['formatting', formatting],
  ['search', search],
];

async function runScenario(browser, base, [name, run]) {
  const started = Date.now();
  // A context per scenario gives each page its own visible window: background
  // tabs of one window run no requestAnimationFrame, which stalls locator clicks.
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  const network = [];
  page.on('response', (response) => {
    if (response.status() >= 400) network.push(`${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText ?? 'unknown';
    // Aborted requests are prefetches cancelled by navigation.
    if (reason !== 'net::ERR_ABORTED') network.push(`${reason} ${request.url()}`);
  });
  try {
    const detail = await run(page, base);
    console.log(`[browser-check] ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)}s) ${detail ?? ''}`);
    return null;
  } catch (error) {
    console.log(`[browser-check] FAIL ${name} (${((Date.now() - started) / 1000).toFixed(1)}s) ${error.message}`);
    for (const line of network.slice(-20)) console.log(`[browser-check]      ${line}`);
    return { name, error };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const base = (process.argv[2] ?? process.env.DEPLOYMENT_URL ?? '').replace(/\/$/, '');
  if (!base || !process.env.CHROME_BIN) {
    throw new Error('Usage: CHROME_BIN=... node scripts/verify-deployment-browser.cjs <deployment-url>');
  }
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_BIN,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const started = Date.now();
  const failures = [];
  try {
    let next = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (next < SCENARIOS.length) {
          const failure = await runScenario(browser, base, SCENARIOS[next++]);
          if (failure) failures.push(failure);
        }
      }),
    );
  } finally {
    await browser.close();
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failures.length > 0) {
    throw new Error(`${failures.length}/${SCENARIOS.length} browser scenarios failed in ${seconds}s: ${failures.map((failure) => failure.name).join(', ')}`);
  }
  console.log(`[browser-check] all ${SCENARIOS.length} scenarios passed in ${seconds}s`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
