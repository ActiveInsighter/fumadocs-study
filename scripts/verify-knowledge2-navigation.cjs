async function verifyKnowledge2Document(page, href, expectedHeading) {
  // Fumadocs prefetches other lectures after the current document is ready.
  // Wait for this document's content, not for every background request to end.
  await page.waitForFunction(
    (expected, title) => {
      if (document.body.innerText.includes('This page could not be found.')) return true;
      const body = document.querySelector('#docs-body');
      const heading = document.querySelector('article h1');
      return location.pathname === expected && heading?.textContent.trim() === title &&
        Boolean(body?.innerText.trim()) && body.getClientRects().length > 0;
    },
    { timeout: 60000 },
    href,
    expectedHeading,
  );
  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes('This page could not be found.')) {
    throw new Error('Knowledge2 navigation rendered a 404: ' + href);
  }
}

// Exercise the directory links users click, rather than only loading lecture URLs.
async function verifyKnowledge2Navigation(page, base) {
  const summary = '/docs/408/knowledge2/';
  const summaryHeading = '408 知识点总结 2（优化版）';
  const courses = [
    ['data-structure', '数据结构'],
    ['computer-organization', '计算机组成原理'],
    ['operating_system', '操作系统'],
    ['computer_network', '计算机网络'],
  ];
  const oldViewport = page.viewport();
  await page.setViewport({ width: 393, height: 852 });

  try {
    await page.goto(base + summary, { waitUntil: 'networkidle2', timeout: 120000 });
    await verifyKnowledge2Document(page, summary, summaryHeading);
    const summaryText = await page.evaluate(() => document.querySelector('article').innerText);
    if (!summaryText.includes('2026-10-07（1007 优化版）')) {
      throw new Error('Knowledge2 overview does not identify the imported 1007 release.');
    }
    const changedOn = require('node:child_process').execFileSync(
      'git', ['log', '-1', '--format=%cs', '--', 'content/docs/408/knowledge2/index.mdx'],
      { encoding: 'utf8' },
    ).trim();
    const expectedDate = new Date(changedOn + 'T12:00:00Z').toLocaleDateString('en-US');
    if (!summaryText.includes('Last updated on ' + expectedDate)) {
      throw new Error('Knowledge2 overview displays a stale update date; expected ' + expectedDate);
    }

    for (const [slug, title] of courses) {
      const course = summary + slug + '/';
      await page.goto(base + summary, { waitUntil: 'networkidle2', timeout: 120000 });
      await page.locator(`#docs-body a[href="${course}"]`).click();
      await verifyKnowledge2Document(page, course, title);
      const heading = await page.$eval('article h1', (element) => element.textContent.trim());
      if (heading !== title) throw new Error('Unexpected course heading: ' + heading);
      const lectures = await page.$$eval('#docs-body a[href]', (links, prefix) =>
        links.map((link) => ({ href: link.getAttribute('href'), title: link.textContent.trim() }))
          .filter(({ href }) => href?.startsWith(prefix) && href !== prefix), course,
      );
      if (lectures.length < 2) throw new Error('Course overview has no lecture navigation: ' + course);

      for (const lecture of [lectures[0], lectures.at(-1)]) {
        await page.locator(`#docs-body a[href="${lecture.href}"]`).click();
        await verifyKnowledge2Document(page, lecture.href, lecture.title);
        await page.goBack({ waitUntil: 'networkidle2', timeout: 120000 });
        await verifyKnowledge2Document(page, course, title);
      }
      await page.locator(`#docs-body a[href="${summary}"]`).click();
      await verifyKnowledge2Document(page, summary, summaryHeading);
      await page.locator('#nd-subnav button[aria-label="Open Sidebar"]').click();
      for (const folder of ['408 知识点总结 2（优化版）', title]) {
        const found = await page.evaluate((label) => {
          const button = Array.from(document.querySelectorAll('#nd-sidebar-mobile button'))
            .find((element) => element.textContent.trim() === label);
          if (!button) return false;
          if (button.getAttribute('aria-expanded') !== 'true') button.click();
          return true;
        }, folder);
        if (!found) throw new Error('Mobile sidebar is missing folder: ' + folder);
      }
      const sidebarLink = `#nd-sidebar-mobile a[href="${course}"]`;
      // Locator clicks wait for a stable, visible target during accordion animation.
      // https://pptr.dev/guides/page-interactions#clicking-an-element-using-locators
      await page.locator(sidebarLink).click();
      await verifyKnowledge2Document(page, course, title);
      await page.waitForSelector('#nd-subnav button[aria-label="Open Sidebar"]', { timeout: 30000 });
      console.log('[browser-check] mobile knowledge2 overview, lectures, back navigation and sidebar passed: ' + slug);
    }
  } finally {
    if (oldViewport) await page.setViewport(oldViewport);
  }
}

module.exports = { verifyKnowledge2Document, verifyKnowledge2Navigation };
