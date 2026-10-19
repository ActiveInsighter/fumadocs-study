// Open the local test page or the deployed branch preview with playwright-cli,
// then run: playwright-cli -s=jsxgraph run-code --filename=scripts/verify-jsxgraph-browser.js
async (page) => {
  const checks = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  async function step(name, run) {
    try { await run(); checks.push(name); }
    catch (error) { throw new Error(`${name}: ${error.message}. Passed: ${checks.join(', ')}`); }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const hosts = page.locator('[data-jsxgraph-board]');
  const first = page.locator('figure[data-plot-mode="2d"]').filter({ hasText: '函数工作台' });
  const boardState = () => hosts.first().evaluate((host) => {
    const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
    const curve = board.objectsList.find((object) => object.elType === 'curve' && object.visProp.strokecolor === '#2563eb');
    return { boardId: board.id, curveId: curve.id, y: curve.Y(2), box: board.getBoundingBox(), point: board.objectsList.find((object) => object.elType === 'glider')?.X() };
  });
  await step('six rendered 2D and 3D examples', async () => {
    assert(await hosts.count() === 6, 'Expected six examples');
    for (let index = 0; index < 6; index++) {
      await hosts.nth(index).scrollIntoViewIfNeeded();
      await page.waitForFunction((i) => {
        const host = document.querySelectorAll('[data-jsxgraph-board]')[i];
        return host.querySelector('svg') && host.getAttribute('aria-busy') === 'false';
      }, index);
    }
    assert(await page.locator('figure [role="alert"]').count() === 0, 'A board could not initialize');
    const views = await page.evaluate(() => Object.values(window.JXG.boards).flatMap((board) => board.objectsList.filter((element) => element.elType === 'view3d')).length);
    assert(views === 3, 'Expected three real View3D scenes');
  });
  await step('numeric parameters and preserved zoom', async () => {
    await first.scrollIntoViewIfNeeded();
    await first.getByRole('button', { name: '放大', exact: true }).click();
    const before = await boardState();
    const number = first.getByRole('spinbutton', { name: '形状系数 a 数值' });
    await number.fill('2');
    await number.press('Enter');
    const after = await boardState();
    assert(after.y === 8, 'Number input did not update the actual function');
    assert(before.boardId === after.boardId && before.curveId === after.curveId && JSON.stringify(before.box) === JSON.stringify(after.box), 'Parameter update discarded geometry or viewport');
    await first.getByRole('button', { name: '重置参数', exact: true }).click();
  });
  await step('formula drawing and error recovery', async () => {
    const expression = first.getByRole('textbox', { name: '函数表达式' }).first();
    await expression.fill('sin(x)');
    await first.getByRole('button', { name: '绘制', exact: true }).first().click();
    assert(Math.abs((await boardState()).y - Math.sin(2)) < 1e-8, 'Draw button did not apply the formula');
    const accepted = await boardState();
    await expression.fill('sin(');
    await first.getByRole('button', { name: '绘制', exact: true }).first().click();
    await first.getByRole('alert').waitFor();
    assert((await boardState()).curveId === accepted.curveId, 'Invalid formula destroyed the valid curve');
    await expression.fill('a*x^2');
    await first.getByRole('button', { name: '绘制', exact: true }).first().click();
    assert(await first.getByRole('alert').count() === 0 && (await boardState()).y === 4, 'Valid edit did not recover');
  });
  await step('add, hide, and delete equations', async () => {
    await first.getByRole('button', { name: '添加图像', exact: true }).click();
    await first.getByLabel('图像类型').selectOption('implicit');
    await first.getByRole('textbox', { name: '隐式方程' }).fill('x^2+y^2=1');
    await first.getByRole('button', { name: '绘制新图像', exact: true }).click();
    const count = await first.getByRole('button', { name: /删除图像/ }).count();
    assert(count === 3, 'New implicit equation was not added');
    await first.getByRole('checkbox', { name: '图像 3', exact: true }).uncheck();
    const hidden = await hosts.first().evaluate((host) => Object.values(window.JXG.boards).find((board) => board.container === host.id).objectsList.find((element) => element.elType === 'implicitcurve').evalVisProp('visible'));
    assert(hidden === false, 'Visibility checkbox did not hide the real equation');
    await first.getByRole('button', { name: '删除图像 3', exact: true }).click();
    assert(await first.getByRole('button', { name: /删除图像/ }).count() === 2, 'Delete button failed');
    await first.getByRole('button', { name: '清空', exact: true }).click();
    assert(await first.getByRole('button', { name: /删除图像/ }).count() === 0, 'Clear button left curves behind');
    await first.getByRole('button', { name: '恢复示例', exact: true }).click();
    assert(await first.getByRole('button', { name: /删除图像/ }).count() === 2, 'Example restore failed');
  });
  await step('probe number input and tangent switch', async () => {
    const pointX = first.getByRole('spinbutton', { name: '取点 x', exact: true });
    await pointX.fill('0.5');
    await pointX.press('Tab');
    await page.waitForFunction(() => {
      const board = Object.values(window.JXG.boards)[0];
      return board.objectsList.some((element) => element.elType === 'glider' && Math.abs(element.X() - 0.5) < 0.01);
    });
    await first.getByRole('checkbox', { name: '显示切线' }).uncheck();
    const tangentVisible = await hosts.first().evaluate((host) => Object.values(window.JXG.boards).find((board) => board.container === host.id).objectsList.find((element) => element.elType === 'tangent').evalVisProp('visible'));
    assert(tangentVisible === false, 'Tangent switch failed');
  });
  await step('parameter animation can pause', async () => {
    await first.getByRole('button', { name: '播放 形状系数 a', exact: true }).click();
    await page.waitForFunction(() => Number(document.querySelector('input[aria-label="形状系数 a 数值"]').value) !== 1);
    await first.getByRole('button', { name: '暂停 形状系数 a', exact: true }).click();
    const value = await first.getByRole('spinbutton', { name: '形状系数 a 数值' }).inputValue();
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert(await first.getByRole('spinbutton', { name: '形状系数 a 数值' }).inputValue() === value, 'Paused animation kept running');
    await first.getByRole('button', { name: '重置参数', exact: true }).click();
  });
  await step('pan tool and theme preserve the scene', async () => {
    await first.getByRole('button', { name: '平移', exact: true }).click();
    const pan = await hosts.first().evaluate((host) => Object.values(window.JXG.boards).find((board) => board.container === host.id).attr.pan.needshift);
    assert(pan === false, 'Pan tool still requires a modifier');
    await first.getByRole('button', { name: '取点', exact: true }).first().click();
    const before = await boardState();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    const after = await boardState();
    assert(before.boardId === after.boardId && before.curveId === after.curveId && JSON.stringify(before.box) === JSON.stringify(after.box), 'Theme discarded the drawing or view');
  });
  await step('fullscreen and SVG export', async () => {
    await first.getByRole('button', { name: '全屏', exact: true }).click();
    await first.getByRole('button', { name: '退出全屏', exact: true }).waitFor();
    await first.getByRole('button', { name: '退出全屏', exact: true }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), first.getByRole('button', { name: '导出 SVG', exact: true }).click()]);
    assert(download.suggestedFilename().endsWith('.svg'), 'No SVG was exported');
    await download.saveAs('.playwright-cli/refactor-export.svg');
  });
  await step('mobile canvas dimensions and page scrolling mode', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await hosts.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const host = document.querySelector('[data-jsxgraph-board]');
      return Math.abs(Number(host.querySelector('svg').getAttribute('width')) - host.clientWidth) <= 1;
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page overflows');
    const scrolling = await hosts.first().evaluate((host) => ({ touch: host.style.touchAction, browser: Object.values(window.JXG.boards).find((board) => board.container === host.id).attr.browserpan }));
    assert(scrolling.touch === 'pan-y' && scrolling.browser === true, 'Point mode captures page scrolling');
    await page.screenshot({ path: '.playwright-cli/refactor-mobile.png' });
  });
  await step('3D camera controls and editable surfaces', async () => {
    const surface = page.locator('figure[data-plot-mode="3d"]').filter({ hasText: '二元函数的三维曲面' });
    await surface.scrollIntoViewIfNeeded();
    await surface.getByRole('button', { name: '俯视 XY', exact: true }).click();
    const read = () => surface.locator('[data-jsxgraph-board]').evaluate((host) => {
      const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
      const view = board.objectsList.find((element) => element.elType === 'view3d');
      return { boardId: board.id, az: view.az_slide.Value(), el: view.el_slide.Value(), count: board.objectsList.length };
    });
    const top = await read();
    assert(Math.abs(top.el - Math.PI / 2) < 0.001, 'Top-view button did not move the camera');
    await surface.getByRole('textbox', { name: 'z(x,y)' }).fill('sin(x)*cos(y)');
    await surface.getByRole('button', { name: '绘制图像', exact: true }).click();
    const after = await read();
    assert(top.boardId === after.boardId && top.count === after.count, 'Editing the surface rebuilt the scene');
    await surface.getByRole('button', { name: '适应图像', exact: true }).click();
    await surface.getByRole('checkbox', { name: '显示网格', exact: true }).uncheck();
    await surface.getByRole('checkbox', { name: '显示曲面', exact: true }).uncheck();
    await surface.getByRole('checkbox', { name: '显示曲面', exact: true }).check();
    await surface.getByRole('button', { name: '立体视角', exact: true }).click();
    await page.screenshot({ path: '.playwright-cli/refactor-3d-mobile.png' });
  });
  await step('navigation disposes and remounts boards', async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('link', { name: '数学总览', exact: true }).first().click();
    await page.waitForFunction(() => Object.keys(window.JXG.boards).length === 0);
    await page.goBack();
    await page.waitForSelector('[data-jsxgraph-board] svg');
    assert(await hosts.count() === 6, 'Examples did not remount after returning');
  });
  return { checks };
}
