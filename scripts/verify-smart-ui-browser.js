// Open /docs/408/knowledge/smart-ui-demo/, then use Playwright CLI run-code.
async (page) => {
  const errors = [];
  const layouts = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(2).waitFor();
  assert(await page.locator('[data-smart-ui]').count() === 4, 'Expected three lessons and an optional component gallery');
  const [quiz, tcp, plan, gallery] = [0, 1, 2, 3].map((i) => page.locator('[data-smart-ui]').nth(i));
  const markdownTable = await page.evaluate(() => {
    const container = document.createElement('div');
    const table = container.appendChild(document.createElement('table'));
    const cell = table.insertRow().insertCell();
    cell.textContent = '普通 Markdown 表格保留原有横向滚动';
    document.querySelector('#docs-body').appendChild(container);
    const result = { cell: getComputedStyle(cell).whiteSpace, wrapper: getComputedStyle(container).overflowX };
    container.remove();
    return result;
  });
  assert(markdownTable.cell === 'nowrap' && markdownTable.wrapper === 'auto', 'Ordinary Markdown table behavior changed');
  assert(!await gallery.isVisible(), 'Secondary controls should be collapsed initially');
  assert(await quiz.getByRole('button', { name: '检查答案', exact: true }).isDisabled(), 'Empty answers should not submit');
  assert(await quiz.getByRole('button', { name: '检查答案', exact: true }).evaluate((el) => getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'), 'Official CSS missing');
  await quiz.getByText('不同行，互不影响', { exact: true }).click();
  await quiz.getByRole('button', { name: '检查答案', exact: true }).click();
  await quiz.getByText('再检查一次“行号”的计算', { exact: true }).waitFor();
  await quiz.getByText('同一行，属于冲突块', { exact: true }).click();
  assert(!await quiz.getByText('再检查一次“行号”的计算', { exact: true }).isVisible(), 'Old feedback remained after changing the answer');
  await quiz.getByRole('button', { name: '检查答案', exact: true }).click();
  await quiz.getByText('判断正确：都映射到第 3 行', { exact: true }).waitFor();
  await quiz.getByRole('button', { name: '查看推导', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '从地址推到 Cache 行号', exact: true });
  await dialog.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });

  await quiz.getByRole('tab', { name: 'JSON', exact: true }).click();
  const source = quiz.locator('[data-slot="smart-ui-source"]');
  assert((await source.innerText()).includes('"Radio"'), 'Official Radio missing from JSON');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await source.getByRole('button', { name: '复制 JSON', exact: true }).click();
  await source.getByRole('button', { name: '已复制 JSON', exact: true }).waitFor();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(JSON.parse(copied).elements.question.type === 'Radio', 'Copied JSON is not the spec');
  await quiz.getByRole('tab', { name: '预览', exact: true }).click();
  assert(await quiz.getByRole('radio', { name: '同一行，属于冲突块', exact: true }).isChecked(), 'JSON switch lost state');

  await tcp.getByRole('tab', { name: '四次挥手', exact: true }).click();
  assert(await tcp.locator('tbody tr').count() === 4, 'Expected four release messages');
  await tcp.getByText(/主动关闭方发送最后一个 ACK 后进入 TIME-WAIT/).waitFor();
  await tcp.getByRole('button', { name: '为什么要等待 2MSL？', exact: true }).click();
  await tcp.getByText(/若最后的 ACK 丢失/).waitFor();

  await plan.getByRole('textbox', { name: '这次想解决的问题', exact: true }).fill('解释 TIME-WAIT，并独立完成一道题');
  await plan.getByRole('combobox').click();
  await page.getByRole('option', { name: '操作系统', exact: true }).click();
  await plan.getByRole('checkbox', { name: '合上资料，复述一次概念', exact: true }).check();
  await plan.getByText('1 / 3 已完成，按自己的节奏继续。', { exact: true }).waitFor();
  await plan.locator('[data-slot=progress-indicator][style*="-67%"], [data-slot=progress-indicator][style*="-66%"] ').waitFor();
  await plan.getByRole('checkbox', { name: '独立完成一道相关练习', exact: true }).check();
  await plan.getByRole('checkbox', { name: '回看错误，写下一个易错点', exact: true }).check();
  await plan.getByText('3 / 3 已完成，可以结束这一轮复习了。', { exact: true }).waitFor();
  await plan.getByRole('slider').press('ArrowRight');
  assert(await plan.getByRole('slider').getAttribute('aria-valuenow') === '35', 'Duration did not change');
  await page.waitForFunction(() => document.querySelector('[data-slot=progress-indicator]')?.style.transform === 'translateX(0%)');
  await quiz.getByRole('button', { name: '重置交互', exact: true }).click();
  assert(await quiz.getByRole('button', { name: '检查答案', exact: true }).isDisabled(), 'Quiz reset failed');
  assert(await plan.getByRole('textbox').inputValue() === '解释 TIME-WAIT，并独立完成一道题', 'Reset leaked into another block');

  // Inspect inner overflow rather than just the page: this catches the Android
  // one-pixel tab scrollbar and a table hidden inside its own scroll container.
  async function checkLayout(width, fontSize = '16px') {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate((size) => document.documentElement.style.fontSize = size, fontSize);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}/${fontSize}`);
    const tabs = await page.locator('[data-smart-ui] [data-slot=tabs-list]:visible').evaluateAll((nodes) => nodes.map((el) => ({
      w: el.clientWidth, h: el.clientHeight, sw: el.scrollWidth, sh: el.scrollHeight,
      x: getComputedStyle(el).overflowX, y: getComputedStyle(el).overflowY,
    })));
    for (const tab of tabs) {
      assert(!['auto', 'scroll'].includes(tab.y) && tab.sh <= tab.h, `Vertical tab overflow at ${width}/${fontSize}: ${JSON.stringify(tab)}`);
      assert(tab.sw <= tab.w + 1, `Horizontal tab overflow at ${width}/${fontSize}`);
    }
    for (const phase of ['三次握手', '四次挥手']) {
      await tcp.getByRole('tab', { name: phase, exact: true }).click();
      const table = await tcp.locator('table:visible').evaluate((el) => ({
        width: el.getBoundingClientRect().width, parent: el.parentElement.clientWidth,
        cells: [...el.querySelectorAll('th,td,caption')].map((cell) => ({
          whiteSpace: getComputedStyle(cell).whiteSpace, width: cell.clientWidth, scroll: cell.scrollWidth,
        })),
      }));
      assert(table.width <= table.parent + 1, `TCP table wider than viewport at ${width}/${fontSize}`);
      assert(table.cells.every((cell) => cell.whiteSpace !== 'nowrap' && cell.scroll <= cell.width + 1), `Unreadable TCP cell at ${width}/${fontSize}`);
    }
    layouts.push({ width, fontSize, tabLists: tabs.length });
  }
  for (const width of [320, 360, 393, 430, 768, 1440]) await checkLayout(width);
  for (const width of [320, 393]) await checkLayout(width, '20px');
  await page.evaluate(() => document.documentElement.style.fontSize = '');

  await page.getByText('展开组件体验区', { exact: true }).click();
  await gallery.waitFor();
  await gallery.getByRole('radio', { name: '做题', exact: true }).check();
  await gallery.getByRole('button', { name: '加练', exact: true }).click();
  await gallery.getByRole('button', { name: '标记为重点', exact: true }).click();
  await gallery.getByRole('switch').uncheck();
  await gallery.getByRole('textbox', { name: '记下易错点', exact: true }).fill('FIN 也占用一个序号。');
  await gallery.getByRole('button', { name: '安排下一次复习', exact: true }).click();
  await page.getByRole('menuitem', { name: '明天', exact: true }).click();
  await gallery.getByText('当前：做题 · 加练；下次复习：明天。', { exact: true }).waitFor();
  await gallery.getByRole('button', { name: '打开学习提示', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '给下一次复习的提示', exact: true });
  await drawer.getByText('FIN 也占用一个序号。', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  await gallery.getByRole('button', { name: '查看复习方法', exact: true }).click();
  await page.getByText('先回忆、再验证；先解释原因，再记忆结论。', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await gallery.getByRole('button', { name: '展开写作参考', exact: true }).click();
  await gallery.getByRole('link', { name: '官方组件与属性说明', exact: true }).waitFor();
  await gallery.getByRole('button', { name: '预览加载状态样式', exact: true }).click();
  await gallery.getByRole('button', { name: '显示加载状态', exact: true }).click();
  await gallery.getByText('加载状态外观预览', { exact: true }).waitFor();
  await gallery.getByRole('button', { name: '结束预览', exact: true }).click();
  assert(!await gallery.getByText('加载状态外观预览', { exact: true }).isVisible(), 'Loading preview cannot stop');
  await gallery.getByRole('button', { name: 'Next slide', exact: true }).click();
  await gallery.getByRole('link', { name: '2', exact: true }).click();
  for (const width of [320, 393]) {
    await checkLayout(width, '20px');
    assert(await gallery.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `Gallery clips content at ${width}`);
  }
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.getByText('展开组件体验区', { exact: true }).click();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.classList.remove('dark'); window.scrollTo(0, 0); });
  await page.screenshot({ path: 'reports/smart-ui-refactor-light.png', fullPage: true });
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({ path: 'reports/smart-ui-refactor-dark.png', fullPage: true });
  await page.setViewportSize({ width: 393, height: 1200 });
  await tcp.getByRole('tab', { name: '三次握手', exact: true }).click();
  await tcp.screenshot({ path: 'reports/smart-ui-refactor-mobile-dark.png' });
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await tcp.screenshot({ path: 'reports/smart-ui-refactor-mobile-light.png' });
  await quiz.getByRole('button', { name: '查看推导', exact: true }).click();
  await dialog.waitFor();
  assert(await dialog.evaluate((el) => el.getBoundingClientRect().right <= innerWidth && el.getBoundingClientRect().left >= 0), 'Mobile dialog overflows');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.locator('[data-smart-ui-ready="true"]').nth(2).waitFor();
  await plan.getByText('0 / 3 已完成，按自己的节奏继续。', { exact: true }).waitFor();
  assert(errors.length === 0, `JavaScript errors: ${errors.join('; ')}`);
  return { passed: true, mainExamples: 3, optionalExamples: 1, availableComponents: 36, layouts, pageErrors: errors };
}
