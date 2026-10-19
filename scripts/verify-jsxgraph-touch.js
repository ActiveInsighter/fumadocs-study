// Open the JSXGraph document, then run with:
// playwright-cli -s=jsxgraph run-code --filename=scripts/verify-jsxgraph-touch.js
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const browser = page.context().browser();
  check(browser, 'This check needs a Chromium browser context');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const mobile = await context.newPage();
  const report = {};
  try {
    await mobile.goto(page.url(), { waitUntil: 'domcontentloaded' });
    const host = mobile.locator('[data-jsxgraph-board]').first();
    const figure = mobile.locator('figure[data-plot-mode="2d"]').first();
    await host.scrollIntoViewIfNeeded();
    await mobile.waitForFunction(() => {
      const host = document.querySelector('[data-jsxgraph-board]');
      return host?.querySelector('svg') && host.getAttribute('aria-busy') === 'false';
    });
    const client = await context.newCDPSession(mobile);
    const state = () => host.evaluate((element) => {
      const board = Object.values(window.JXG.boards).find((board) => board.container === element.id);
      const rect = element.getBoundingClientRect();
      return {
        scrollY: window.scrollY, box: board.getBoundingBox(), touchAction: getComputedStyle(element).touchAction,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
    const center = async () => {
      await host.evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await mobile.waitForTimeout(150);
    };
    const swipe = async (dx, dy) => {
      const { rect } = await state();
      const x = rect.x + rect.width * 0.8, y = rect.y + rect.height * 0.65;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 10; step++) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 10, y: y + dy * step / 10 }] });
        await mobile.waitForTimeout(16);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await mobile.waitForTimeout(200);
    };

    await figure.locator('[aria-label$="工具栏"]').getByRole('button', { name: '取点', exact: true }).click();
    await center();
    const beforeScroll = await state();
    await swipe(0, -110);
    const afterScroll = await state();
    report.scroll = {
      before: beforeScroll.scrollY, after: afterScroll.scrollY, touchAction: beforeScroll.touchAction,
      touchPoints: await mobile.evaluate(() => navigator.maxTouchPoints),
    };
    check(afterScroll.scrollY - beforeScroll.scrollY > 30, `Point mode trapped native touch scrolling: ${JSON.stringify(report.scroll)}`);

    await figure.getByRole('button', { name: '平移', exact: true }).click();
    await center();
    const beforePan = await state();
    await swipe(-70, 0);
    const afterPan = await state();
    report.pan = { before: beforePan.box, after: afterPan.box, touchAction: beforePan.touchAction, scrollDelta: afterPan.scrollY - beforePan.scrollY };
    check(Math.abs(beforePan.box[0] - afterPan.box[0]) > 0.1, 'Touch drag did not pan the coordinates');
    check(Math.abs(report.pan.scrollDelta) <= 1, 'Panning also scrolled the document');

    const numeric = figure.locator('input[type="number"][aria-label$=" 数值"]').first();
    const range = figure.getByRole('slider').first();
    const numericLabel = await numeric.getAttribute('aria-label');
    const label = numericLabel.replace(/ 数值$/, '');
    const min = Number(await numeric.getAttribute('min'));
    const max = Number(await numeric.getAttribute('max'));
    const step = Number(await numeric.getAttribute('step'));
    const initial = Number(await numeric.inputValue());
    const upperStop = Number((min + Math.floor((max - min) / step + 1e-10) * step).toPrecision(12));
    const liveValue = async () => Number(await range.inputValue());
    const waitForChange = async (previous) => {
      await mobile.waitForFunction(({ label, previous }) => {
        const input = [...document.querySelectorAll('input[type="number"]')].find((input) => input.getAttribute('aria-label') === label);
        return input && input.value !== '' && Number(input.value) !== previous;
      }, { label: numericLabel, previous });
    };
    const play = () => figure.getByRole('button', { name: `播放 ${label}`, exact: true });
    const pause = () => figure.getByRole('button', { name: `暂停 ${label}`, exact: true });

    await numeric.fill(String(max + 10));
    await numeric.press('Enter');
    check(await liveValue() === upperStop && Number(await numeric.inputValue()) === upperStop, 'Out-of-range number did not clamp to the last slider step');
    await numeric.fill('');
    await numeric.press('Enter');
    check(await liveValue() === upperStop && Number(await numeric.inputValue()) === upperStop, 'Clearing a number lost the accepted value');
    const expectedStep = Number((min + step).toPrecision(12));
    await numeric.fill(String(min + 1.26 * step));
    await numeric.press('Enter');
    check(Math.abs(await liveValue() - expectedStep) < step * 1e-7, 'Number input did not snap to its minimum-anchored step');
    await numeric.fill(String(max));
    await numeric.press('Escape');
    check(Math.abs(await liveValue() - expectedStep) < step * 1e-7, 'Escape committed an unfinished edit');

    await play().click();
    await waitForChange(expectedStep);
    await pause().click();
    const paused = await liveValue();
    await mobile.waitForTimeout(300);
    check(await liveValue() === paused && await play().isVisible(), 'Animation continued after pause');

    await play().click();
    await waitForChange(paused);
    await numeric.focus();
    const focused = await liveValue();
    await mobile.waitForTimeout(300);
    check(await liveValue() === focused && await play().isVisible(), 'Number entry did not pause the animation');
    await numeric.press('Enter');

    await play().click();
    await waitForChange(focused);
    await figure.getByRole('button', { name: '重置参数', exact: true }).click();
    await mobile.waitForTimeout(300);
    check(await liveValue() === initial && await play().isVisible(), 'Reset parameters left the animation running');

    await play().click();
    await waitForChange(initial);
    await figure.getByRole('button', { name: '恢复示例', exact: true }).click();
    await mobile.waitForTimeout(300);
    check(await liveValue() === initial && await play().isVisible(), 'Restore example left the old animation running');
    report.parameters = ['number bounds', 'empty draft', 'step rounding', 'Escape cancellation', 'pause', 'focus pause', 'parameter reset', 'example reset'];
    return report;
  } finally {
    await context.close();
  }
}
