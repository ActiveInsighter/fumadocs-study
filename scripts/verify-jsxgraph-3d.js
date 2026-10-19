async (page) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  const onError = (error) => errors.push(error.message);
  page.on('pageerror', onError);
  const target = new URL(page.url());
  target.hash = '';
  const figures = page.locator('figure[data-plot-mode="3d"]');
  const geometry = (figure) => figure.locator('[data-jsxgraph-board] svg').evaluate((svg) =>
    Array.from(svg.querySelectorAll('path')).filter((path) => path.getAttribute('d')?.length > 100).map((path) => path.getAttribute('d')).join('|'));
  const readout = (figure) => figure.getByText(/^P = /).innerText();
  const ready = async (figure) => {
    const host = figure.locator('[data-jsxgraph-board]');
    await host.scrollIntoViewIfNeeded();
    await host.locator('svg').waitFor();
    await figure.getByRole('button', { name: '绘制图像', exact: true }).waitFor();
    await host.evaluate((node) => new Promise((resolve) => {
      if (node.getAttribute('aria-busy') === 'false') { resolve(); return; }
      const observer = new MutationObserver(() => {
        if (node.getAttribute('aria-busy') === 'false') { observer.disconnect(); resolve(); }
      });
      observer.observe(node, { attributes: true, attributeFilter: ['aria-busy'] });
    }));
    return host;
  };
  const commit = async (input, value) => { await input.fill(String(value)); await input.press('Enter'); };
  const edit = async (figure, expressions) => {
    const inputs = figure.getByRole('textbox');
    for (let index = 0; index < expressions.length; index++) await inputs.nth(index).fill(expressions[index]);
    await figure.getByRole('button', { name: '绘制图像', exact: true }).click();
  };
  let touchContext;
  let cdp;
  try {
    assert(await figures.count() === 3, 'Expected the three documented 3D graph types.');
    const surface = figures.nth(0);
    const host = await ready(surface);
    const nativeSvg = await host.locator('svg').elementHandle();
    const x = surface.getByRole('spinbutton', { name: 'x 坐标数值', exact: true });
    const y = surface.getByRole('spinbutton', { name: 'y 坐标数值', exact: true });
    const accepted = await x.inputValue();
    const previousReadout = await readout(surface);
    await x.fill('');
    assert(await x.inputValue() === '', 'The coordinate field cannot hold an empty draft.');
    assert(await readout(surface) === previousReadout, 'An empty draft changed the graph.');
    await x.press('Escape');
    assert(await x.inputValue() === accepted, 'Escape failed to cancel the coordinate draft.');
    await commit(x, -1.2);
    await commit(y, 0);
    await x.fill('999');
    await x.press('Tab');
    assert(await x.inputValue() === '-1.2', 'An out-of-range coordinate replaced the accepted value.');

    const parameter = surface.getByRole('region', { name: '参数控制', exact: true }).locator('input[type="number"]').first();
    const min = await parameter.getAttribute('min');
    const beforeParameter = await geometry(surface);
    await commit(parameter, min);
    assert(await geometry(surface) !== beforeParameter, 'A numeric parameter edit did not change surface geometry.');
    await edit(surface, ['sin(x)*cos(y)']);
    assert((await readout(surface)).includes('-0.932'), 'Edited surface coordinates are incorrect.');
    const validGeometry = await geometry(surface);
    await edit(surface, ['sin(']);
    assert(await surface.getByRole('alert').count() === 1, 'An invalid expression produced no inline error.');
    assert(await geometry(surface) === validGeometry, 'An invalid expression discarded the accepted geometry.');
    await edit(surface, ['sin(x)*cos(y)']);
    assert(await surface.getByRole('alert').count() === 0, 'A valid redraw did not clear the error.');
    await surface.getByRole('button', { name: '适应图像', exact: true }).click();
    assert(await geometry(surface) !== validGeometry, 'Fit-to-image did not adjust the projection.');
    assert((await readout(surface)).includes('-0.932'), 'Fit-to-image changed the coordinate values.');
    for (const name of ['俯视 XY', '正视 XZ', '侧视 YZ', '立体视角']) {
      const before = await geometry(surface);
      const button = surface.getByRole('button', { name, exact: true });
      await button.click();
      assert(await button.getAttribute('aria-pressed') === 'true', `The ${name} button has no active state.`);
      assert(await geometry(surface) !== before, `The ${name} button did not change the camera.`);
    }
    const beforeDrag = await geometry(surface);
    await host.scrollIntoViewIfNeeded();
    const rect = await host.boundingBox();
    await page.mouse.move(rect.x + 20, rect.y + 40);
    await page.mouse.down();
    await page.mouse.move(rect.x + 120, rect.y + 110, { steps: 8 });
    await page.mouse.up();
    assert(await geometry(surface) !== beforeDrag, 'Dragging with the mouse did not rotate the scene.');
    const visibleFaces = () => host.locator('svg').evaluate((svg) => Array.from(svg.querySelectorAll('path')).filter((path) => path.getAttribute('fill')?.startsWith('hsl(') && path.style.visibility !== 'hidden').length);
    assert(await visibleFaces() > 0, 'The solid surface is missing.');
    await surface.getByRole('checkbox', { name: '显示曲面', exact: true }).uncheck();
    assert(await visibleFaces() === 0, 'The solid surface visibility switch failed.');
    await surface.getByRole('checkbox', { name: '显示曲面', exact: true }).check();
    assert(await visibleFaces() > 0, 'The solid surface did not return.');
    const density = surface.getByRole('slider', { name: '辅助网格密度', exact: false });
    const beforeDensity = await geometry(surface);
    await density.fill((await density.inputValue()) === '30' ? '16' : '30');
    assert(await geometry(surface) !== beforeDensity, 'The overlay mesh density did not update.');
    await surface.getByRole('checkbox', { name: '显示网格', exact: true }).uncheck();
    assert(await density.isDisabled(), 'The disabled mesh still accepts density changes.');
    await surface.getByRole('checkbox', { name: '显示网格', exact: true }).check();
    const plotToggle = surface.locator('[aria-label="三维图像与公式"] input[type="checkbox"]').first();
    await plotToggle.uncheck();
    assert(await visibleFaces() === 0, 'The graph visibility switch failed.');
    await plotToggle.check();
    assert(await host.locator('svg').evaluate((svg, original) => svg === original, nativeSvg), 'Controls recreated the native SVG scene.');

    const helix = figures.nth(1);
    await ready(helix);
    await edit(helix, ['cos(t)', 'sin(t)', 't']);
    await commit(helix.getByRole('spinbutton', { name: 't 坐标数值', exact: true }), 1);
    assert((await readout(helix)).includes('(0.5403, 0.8415, 1)'), 'The space curve evaluates the wrong coordinates.');
    await helix.getByRole('button', { name: '恢复公式', exact: true }).click();
    const torus = figures.nth(2);
    await ready(torus);
    await edit(torus, ['cos(u)', 'sin(u)', 'v']);
    await commit(torus.getByRole('spinbutton', { name: 'u 坐标数值', exact: true }), 1);
    await commit(torus.getByRole('spinbutton', { name: 'v 坐标数值', exact: true }), 1);
    assert((await readout(torus)).includes('(0.5403, 0.8415, 1)'), 'The parametric surface evaluates the wrong coordinates.');
    await torus.getByRole('button', { name: '恢复公式', exact: true }).click();

    touchContext = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const mobile = await touchContext.newPage();
    mobile.on('pageerror', onError);
    await mobile.goto(target.href, { waitUntil: 'domcontentloaded' });
    const touchFigure = mobile.locator('figure[data-plot-mode="3d"]').first();
    const touchHost = await ready(touchFigure);
    await edit(touchFigure, ['sin(x)*cos(y)']);
    await touchFigure.getByRole('button', { name: '适应图像', exact: true }).click();
    await touchHost.scrollIntoViewIfNeeded();
    const touchRect = await touchHost.boundingBox();
    const beforeTouch = await geometry(touchFigure);
    cdp = await touchContext.newCDPSession(mobile);
    const start = { x: touchRect.x + 20, y: touchRect.y + 40 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
    for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + step * 12, y: start.y + step * 7, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert(await geometry(touchFigure) !== beforeTouch, 'A real touchscreen drag did not rotate the 3D scene.');
    assert(await touchFigure.getByRole('button', { name: '立体视角', exact: true }).getAttribute('aria-pressed') === 'false', 'The camera preset remained selected after touch rotation.');
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'The 3D page overflows horizontally on mobile.');
    await mobile.screenshot({ path: '.playwright-cli/jsxgraph-3d-touch.png' });
    await touchFigure.getByRole('button', { name: '恢复公式', exact: true }).click();
    await touchFigure.getByRole('button', { name: '重置视图', exact: true }).click();
    await touchHost.scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: '.playwright-cli/jsxgraph-3d-initial.png' });
    assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
    return { graphTypes: 3, formulaValidation: true, parameterInput: true, coordinateDrafts: true, cameraViews: true, fitToImage: true, meshControls: true, mouseRotation: true, touchRotation: true, nativeScenePreserved: true, browserErrors: errors };
  } finally {
    page.off('pageerror', onError);
    if (cdp) await cdp.detach();
    if (touchContext) await touchContext.close();
  }
}
