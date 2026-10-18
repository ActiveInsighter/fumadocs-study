// Open /docs/408/knowledge/smart-ui-demo/ first, then run with Playwright CLI.
async (page) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(5).waitFor();
  assert(await page.locator('[data-smart-ui]').count() === 6, 'Expected six official component examples');
  const [quiz, plan, knowledge, overlays, choices, content] = [0, 1, 2, 3, 4, 5].map((i) => page.locator('[data-smart-ui]').nth(i));
  assert(await quiz.getByRole('button', { name: '查看解析', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'Official component CSS is missing');

  await quiz.getByRole('button', { name: '查看解析', exact: true }).click();
  await quiz.getByText('还没有选择答案', { exact: true }).waitFor();
  await quiz.getByRole('radio', { name: '两次', exact: true }).check();
  await quiz.getByText('再想一想', { exact: true }).waitFor();
  await quiz.getByRole('radio', { name: '三次', exact: true }).check();
  await quiz.getByText('答对了', { exact: true }).waitFor();
  await quiz.getByRole('tab', { name: 'JSON', exact: true }).click();
  assert((await quiz.locator('[data-slot="smart-ui-source"]').innerText()).includes('"Radio"'), 'Missing official Radio JSON');
  await quiz.getByRole('tab', { name: '预览', exact: true }).click();
  assert(await quiz.getByRole('radio', { name: '三次', exact: true }).isChecked(), 'JSON switch lost state');

  await plan.getByRole('textbox', { name: '计划名称', exact: true }).fill('TCP 专项复习');
  await plan.getByRole('textbox', { name: '复习笔记', exact: true }).fill('区分 SYN 与 FIN 消耗的序号。');
  await plan.getByRole('combobox').click();
  await page.getByRole('option', { name: '操作系统', exact: true }).click();
  await plan.getByRole('slider').press('ArrowRight');
  assert(await plan.getByRole('slider').getAttribute('aria-valuenow') === '50', 'Slider binding failed');
  await plan.locator('[data-slot=progress-indicator][style*="-50%"]').waitFor();
  await plan.getByRole('checkbox', { name: '今天的复习已完成', exact: true }).check();
  await plan.getByRole('switch').uncheck();
  assert(await plan.getByText('当前科目：操作系统；计划专注 50 分钟。', { exact: true }).isVisible(), 'Template state did not update');

  await knowledge.getByRole('tab', { name: '四次挥手', exact: true }).click();
  await knowledge.getByText('FIN，对端进入 LAST-ACK', { exact: true }).waitFor();
  await knowledge.getByRole('button', { name: '为什么要等待 2MSL？', exact: true }).click();
  await knowledge.getByText(/TIME-WAIT 允许重发最后的 ACK/).waitFor();

  await overlays.getByRole('button', { name: '查看学习建议', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '学习建议', exact: true });
  await dialog.waitFor();
  assert(await dialog.getByText(/先画出通信双方/).isVisible(), 'Dialog content missing');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  await overlays.getByRole('button', { name: '打开复习清单', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '复习清单', exact: true });
  await drawer.waitFor();
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await overlays.getByRole('button', { name: '什么是主动回忆？', exact: true }).click();
  await page.getByText('合上资料，用自己的话复述知识，再对照原文查漏补缺。', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await overlays.getByRole('button', { name: '安排下一步', exact: true }).click();
  await page.getByRole('menuitem', { name: '加入本周计划', exact: true }).click();
  await overlays.getByText('已选择：加入本周计划', { exact: true }).waitFor();
  await overlays.getByRole('button', { name: '展开：如何使用这份清单', exact: true }).click();
  await overlays.getByText('先解释概念，再做一道题，最后记录错误原因。', { exact: true }).waitFor();

  await choices.getByRole('button', { name: '标记为重点', exact: true }).click();
  assert(await choices.getByRole('button', { name: '标记为重点', exact: true }).getAttribute('aria-pressed') === 'true', 'Toggle failed');
  await choices.getByRole('radio', { name: '做题', exact: true }).check();
  await choices.getByRole('button', { name: '加练', exact: true }).click();
  await choices.getByRole('link', { name: '2', exact: true }).click();
  await choices.getByText('当前：做题 · 加练 · 第 2 页', { exact: true }).waitFor();
  await content.getByRole('button', { name: 'Next slide' }).click();
  assert(await content.getByRole('img', { name: '黑白线稿：笔记本与学习卡片' }).evaluate((img) => img.complete && img.naturalWidth > 0), 'Image missing');

  await quiz.getByRole('button', { name: '重置交互', exact: true }).click();
  assert(await quiz.getByRole('radio', { name: '三次', exact: true }).isChecked() === false, 'Reset failed');
  assert(await plan.getByRole('textbox', { name: '计划名称', exact: true }).inputValue() === 'TCP 专项复习', 'Reset leaked across blocks');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.screenshot({ path: 'reports/smart-ui-official-light.png', fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: 'reports/smart-ui-official-dark.png', fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
  for (const block of [quiz, plan, knowledge, overlays, choices, content]) {
    assert(await block.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'A mobile block clips its content');
  }
  await page.setViewportSize({ width: 375, height: 1100 });
  await plan.locator('[data-slot=card]').first().screenshot({ path: 'reports/smart-ui-official-mobile.png' });
  await page.setViewportSize({ width: 375, height: 812 });
  await overlays.getByRole('button', { name: '查看学习建议', exact: true }).click();
  await dialog.waitFor();
  assert(await dialog.evaluate((el) => el.getBoundingClientRect().right <= innerWidth && el.getBoundingClientRect().left >= 0), 'Mobile dialog overflows');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Light mobile page overflows');
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(5).waitFor();
  assert(await plan.getByRole('slider').getAttribute('aria-valuenow') === '45', 'Refresh did not restore initial state');
  assert(errors.length === 0, `Browser exceptions: ${errors.join('; ')}`);
  return { passed: true, examples: 6, components: 36, pageErrors: errors };
}
