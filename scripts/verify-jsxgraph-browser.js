// Run against `npx next dev --port 3107` with:
// playwright-cli -s=jsxgraph open http://localhost:3107/docs/math/function-plot/
// playwright-cli -s=jsxgraph run-code --filename=scripts/verify-jsxgraph-browser.js
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1280, height: 900 });
  const hosts = page.locator('[id^="jsxgraph-"][aria-busy]');
  check(await hosts.count() === 5, 'Expected five independent document examples');
  const report = [];
  for (let index = 0; index < 5; index++) {
    await hosts.nth(index).scrollIntoViewIfNeeded();
    await page.waitForFunction((i) => {
      const host = document.querySelectorAll('[id^="jsxgraph-"][aria-busy]')[i];
      return host.querySelector('svg') && host.getAttribute('aria-busy') === 'false';
    }, index);
    const rendered = await hosts.nth(index).evaluate((host) => {
      const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
      return {
        id: host.id,
        curves: board.objectsList.filter((object) => object.elType === 'curve' || object.elType === 'implicitcurve').map((curve) => ({ type: curve.elType, samples: curve.numberPoints, path: curve.rendNode?.getAttribute('d')?.length ?? 0 })),
      };
    });
    check(rendered.curves.length > 0 && rendered.curves.every((curve) => curve.samples > 1 && curve.path > 10), `Missing curve paths in board ${index}`);
    report.push(rendered);
  }
  check(await page.locator('figure [role=alert]').count() === 0, 'Document showed a plotting error');

  const first = page.locator('figure').filter({ hasText: '二次函数与一次函数' });
  await first.scrollIntoViewIfNeeded();
  await first.getByRole('button', { name: '放大', exact: true }).click();
  const before = await hosts.first().evaluate((host) => {
    const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
    const curve = board.objectsList.find((object) => object.elType === 'curve');
    return { id: curve.id, y: curve.Y(2), box: board.getBoundingBox() };
  });
  const slider = page.getByRole('slider', { name: '开口系数 a' });
  await slider.focus();
  await slider.press('Home');
  const after = await hosts.first().evaluate((host) => {
    const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
    const curve = board.objectsList.find((object) => object.elType === 'curve');
    return { id: curve.id, y: curve.Y(2), box: board.getBoundingBox() };
  });
  check(before.y === 4 && after.y === -8, 'Slider did not update the actual function');
  check(before.id === after.id && JSON.stringify(before.box) === JSON.stringify(after.box), 'Slider recreated the curve or lost the viewport');
  await page.getByRole('button', { name: '重置参数', exact: true }).first().click();
  check(await slider.inputValue() === '1', 'Parameter reset failed');
  await first.getByRole('button', { name: '重置视图', exact: true }).click();

  // Drag the real JSXGraph glider and verify the coordinates change.
  const glider = await hosts.first().evaluate((host) => {
    const board = Object.values(window.JXG.boards).find((board) => board.container === host.id);
    const point = board.objectsList.find((object) => object.elType === 'glider');
    const rect = host.getBoundingClientRect();
    return { x: rect.x + point.coords.scrCoords[1], y: rect.y + point.coords.scrCoords[2], oldX: point.X() };
  });
  await page.mouse.move(glider.x, glider.y);
  await page.mouse.down();
  await page.mouse.move(glider.x + 35, glider.y - 35, { steps: 8 });
  await page.mouse.up();
  const movedX = await hosts.first().evaluate((host) => Object.values(window.JXG.boards).find((board) => board.container === host.id).objectsList.find((object) => object.elType === 'glider').X());
  check(Math.abs(movedX - glider.oldX) > 0.05, 'Glider did not respond to dragging');

  const radius = page.getByRole('slider', { name: '半径 r' });
  await radius.focus();
  await radius.press('Home');
  const circleValue = await hosts.nth(2).evaluate((host) => Object.values(window.JXG.boards).find((board) => board.container === host.id).objectsList.find((object) => object.elType === 'implicitcurve').f(2, 0));
  check(Math.abs(circleValue - 3.75) < 1e-8, 'Implicit equation did not update with its slider');

  // Resize and switch theme while boards exist. SVG must match the container.
  await page.setViewportSize({ width: 390, height: 844 });
  await hosts.first().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const host = document.querySelector('[id^="jsxgraph-"][aria-busy]');
    return Math.abs(Number(host.querySelector('svg').getAttribute('width')) - host.clientWidth) <= 1;
  });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile layout overflows horizontally');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
  await page.waitForFunction(() => Object.keys(window.JXG.boards).length === 5 && !document.querySelector('figure [role="alert"]') && [...document.querySelectorAll('[id^="jsxgraph-"][aria-busy]')].every((host) => host.querySelector('svg') && host.getAttribute('aria-busy') === 'false'));
  await page.screenshot({ path: '.playwright-cli/jsxgraph-mobile-dark.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
  await hosts.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.playwright-cli/jsxgraph-desktop.png' });

  // Client navigation frees all boards, and navigating back creates five hosts.
  await page.getByRole('link', { name: '数学总览', exact: true }).first().click();
  await page.waitForFunction(() => Object.keys(window.JXG.boards).length === 0);
  await page.goBack();
  await page.waitForSelector('[id^="jsxgraph-"][aria-busy] svg');
  check(await hosts.count() === 5, 'Document did not remount after navigation');
  return { checks: ['five rendered examples', 'live function parameters', 'viewport preserved', 'parameter reset', 'draggable glider', 'live implicit equation', 'mobile resize', 'dark mode', 'navigation cleanup and remount'], boards: report };
}
