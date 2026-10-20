// Open /docs/math/function-plot/ (local or a branch preview) with playwright-cli,
// then run: playwright-cli -s=jsxgraph run-code --filename=scripts/verify-jsxgraph-browser.js
async (page) => {
  const passed = [];
  const check = (condition, message) => { if (!condition) throw new Error(`${message}. Passed: ${passed.join(', ')}`); };
  const text = async (locator) => (await locator.textContent()).replace(/\s+/g, ' ');
  const figure = (title) => page.locator('figure[data-plot-mode]').filter({ hasText: title });
  const ready = async (target) => {
    await target.scrollIntoViewIfNeeded();
    await target.locator('[data-jsxgraph-board][aria-busy="false"]').waitFor();
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload({ waitUntil: 'domcontentloaded' });

  const boards = page.locator('figure[data-plot-mode]');
  const count = await boards.count();
  for (let index = 0; index < count; index++) await ready(boards.nth(index));
  check(count === 7 && await page.locator('figure [role="alert"]').count() === 0, 'Every example board initializes');
  passed.push('seven boards');

  // 2D: drawing, error recovery, polar curves, probe readout and integral.
  const plane = figure('函数、导数与面积');
  await ready(plane);
  const expression = plane.getByRole('textbox', { name: '函数表达式' }).first();
  const draw = plane.getByRole('button', { name: '绘制', exact: true }).first();
  await expression.fill('sin(');
  await draw.click();
  check(await plane.getByRole('alert').count() === 1, 'Invalid formula is reported');
  await expression.fill('x^3/3-x');
  await draw.click();
  check(await plane.getByRole('alert').count() === 0, 'Valid formula recovers');
  const probe = plane.getByRole('spinbutton', { name: '取点 x' });
  await probe.fill('1.5');
  await probe.press('Enter');
  await page.waitForTimeout(200);
  const readout = await text(plane.getByRole('region', { name: '取点读数' }));
  check(readout.includes('-0.375') && readout.includes('1.25') && readout.includes('-0.2865'), `Probe and integral readouts are exact: ${readout}`);
  await plane.getByRole('button', { name: '添加图像' }).click();
  await plane.getByRole('button', { name: '极坐标 r = r(θ)' }).click();
  await plane.getByRole('textbox', { name: '极坐标方程' }).last().fill('1+cos(θ)');
  await plane.getByRole('button', { name: '绘制新图像' }).click();
  check(await plane.getByRole('button', { name: /^删除图像/ }).count() === 3 && await plane.getByRole('alert').count() === 0, 'Polar curve is added');
  await plane.getByRole('button', { name: '恢复示例' }).click();
  passed.push('2D editing');

  // 3D: quadric cross-sections and classification.
  const space = figure('单叶双曲面的截痕');
  await ready(space);
  const section = space.getByRole('region', { name: '截面' });
  check((await text(section)).includes('椭圆'), 'z = k cuts a one-sheet hyperboloid in an ellipse');
  await space.getByRole('button', { name: 'x = k' }).click();
  check((await text(section)).includes('双曲线'), 'x = k cuts it in a hyperbola');
  await space.getByRole('button', { name: '扫描截面' }).click();
  await page.waitForTimeout(800);
  await space.getByRole('button', { name: '暂停扫描' }).click();
  await space.getByRole('combobox').first().selectOption('ellipsoid');
  await space.getByRole('button', { name: '绘制', exact: true }).click();
  await space.getByRole('button', { name: 'z = k' }).click();
  check((await text(section)).includes('椭圆') && (await text(space)).includes('椭球面'), 'Quadric kind can be switched');
  const level = space.getByRole('spinbutton', { name: '截面位置 k' });
  await level.fill('2.9');
  await level.press('Enter');
  check((await text(section)).includes('空集'), 'A plane outside the ellipsoid misses it');
  passed.push('quadric sections');

  const saddle = figure('马鞍面与椭圆抛物面');
  await ready(saddle);
  check((await text(saddle.getByRole('region', { name: '截面' }))).includes('两条相交直线'), 'The saddle at z = 0 is two lines');
  const implicit = figure('一个参数串起三种曲面');
  await ready(implicit);
  const d = implicit.getByRole('spinbutton', { name: '常数 d 数值' });
  await d.fill('-1');
  await d.press('Enter');
  check(await implicit.getByRole('alert').count() === 0, 'Implicit surface follows its parameter');
  passed.push('implicit and saddle');

  for (const button of ['自动旋转', '自动旋转', '适应图像', '俯视 XY', '重置视图']) await space.getByRole('button', { name: button, exact: true }).click();
  check(errors.length === 0, `No page errors: ${errors.join(' | ')}`);
  passed.push('camera controls');
  return passed;
}
