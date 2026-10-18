// Playwright CLI: playwright-cli -s=fumadocs-smart-ui run-code --filename=scripts/verify-smart-ui-browser.js
// Open the intended dev or static-preview URL in that browser session first.
async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const feedback = (scope, text) => scope.locator('[data-slot="smart-text"]').filter({ hasText: text });
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(3).waitFor();
  assert(await page.locator('[data-smart-ui]').count() === 4, 'Expected four rendered examples');
  const [quiz, cache, review, gallery] = [0, 1, 2, 3].map((index) => page.locator('[data-smart-ui]').nth(index));

  await quiz.getByRole('button', { name: '查看解析', exact: true }).click();
  await feedback(quiz, '先选择一个答案').waitFor();
  await quiz.getByRole('radio', { name: 'B. 分别映射', exact: false }).check();
  await feedback(quiz, '再想一想').waitFor();
  await quiz.getByRole('radio', { name: 'A. 都映射', exact: false }).check();
  await feedback(quiz, '答对了').waitFor();
  await quiz.getByRole('button', { name: '重置交互', exact: true }).click();
  await quiz.locator('input:checked').waitFor({ state: 'hidden' });
  assert(await quiz.locator('input:checked').count() === 0, 'Quiz did not reset');
  assert(!await feedback(quiz, '答对了').isVisible(), 'Feedback survived reset');

  assert(await cache.getByText('内存块 3 映射到 Cache 第 3 行，块内偏移 4 字节。', { exact: true }).isVisible(), 'Initial address result is incorrect');
  await cache.getByRole('button', { name: '地址 180：冲突块', exact: true }).click();
  await cache.getByText('内存块 11 映射到 Cache 第 3 行，块内偏移 4 字节。', { exact: true }).waitFor();
  await cache.getByRole('slider').press('ArrowRight');
  await cache.getByText('内存块 11 映射到 Cache 第 3 行，块内偏移 5 字节。', { exact: true }).waitFor();
  await cache.getByRole('button', { name: '地址 64：下一行', exact: true }).click();
  await cache.getByText('内存块 4 映射到 Cache 第 4 行，块内偏移 0 字节。', { exact: true }).waitFor();

  // The JSON tab keeps preview state alive and exposes a highlighted, copyable source view.
  await cache.getByRole('tab', { name: 'JSON' }).click();
  await cache.locator('[data-slot="smart-ui-source"]').waitFor();
  assert((await cache.locator('[data-slot="smart-ui-source"]').innerText()).includes('"MemoryAddress"'), 'JSON source is missing the component type');
  await cache.getByRole('tab', { name: '预览' }).click();
  assert(await cache.getByRole('slider').inputValue() === '64', 'Switching tabs lost preview state');

  for (const checkbox of await review.getByRole('checkbox').all()) await checkbox.check();
  await review.locator('progress[value="3"]').waitFor();
  assert(await feedback(review, '三个目标都完成了').isVisible(), 'Completion feedback missing');
  assert(await quiz.locator('input:checked').count() === 0, 'State leaked between examples');
  await review.getByRole('button', { name: '重置交互', exact: true }).click();
  await review.locator('progress[value="0"]').waitFor();
  assert(await cache.getByRole('slider').inputValue() === '64', 'Reset affected another example');

  await gallery.getByRole('button', { name: '设为 90%', exact: true }).click();
  assert(await gallery.getByRole('slider').inputValue() === '90', 'Gallery preset button failed');
  await gallery.getByRole('checkbox').uncheck();
  await gallery.locator('progress[value="0"]').waitFor();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'reports/smart-ui-desktop.png', fullPage: true });
  await gallery.scrollIntoViewIfNeeded();
  await quiz.screenshot({ path: 'reports/smart-ui-quiz-light.png' });
  await cache.screenshot({ path: 'reports/smart-ui-cache-light.png' });
  await gallery.screenshot({ path: 'reports/smart-ui-gallery-light.png' });
  await cache.getByRole('tab', { name: 'JSON' }).click();
  await cache.screenshot({ path: 'reports/smart-ui-json-light.png' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await cache.screenshot({ path: 'reports/smart-ui-json-dark.png' });
  await cache.getByRole('tab', { name: '预览' }).click();
  await cache.screenshot({ path: 'reports/smart-ui-cache-dark.png' });
  await gallery.screenshot({ path: 'reports/smart-ui-gallery-dark.png' });
  await page.screenshot({ path: 'reports/smart-ui-desktop-dark.png', fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));

  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows horizontally');
  await cache.screenshot({ path: 'reports/smart-ui-cache-mobile.png' });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await gallery.screenshot({ path: 'reports/smart-ui-gallery-dark-mobile.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dark mobile page overflows');

  const prompt = await page.request.get(new URL('/smart-ui/authoring-prompt.md', page.url()).href);
  assert(prompt.ok() && (await prompt.text()).includes('不是 JSONL patches'), 'Authoring prompt download failed');
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(3).waitFor();
  assert(await page.locator('[data-smart-ui]').nth(1).getByRole('slider').inputValue() === '52', 'Refresh did not restore initial state');
  assert(errors.length === 0, `Browser exceptions: ${errors.join('; ')}`);
  return { passed: true, examples: 4, pageErrors: errors };
}
