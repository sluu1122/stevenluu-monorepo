import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * Guards the exact regression documented in this app's TODO under "Pinned to
 * recharts v2": with recharts v3, `ResponsiveContainer` measured its size
 * correctly but the dispatch into recharts' internal Redux store never
 * completed under a production React build, so every chart rendered blank.
 *
 * It threw no console error, and every unit test passed, so nothing caught it
 * before it shipped to the deployed site.
 *
 * The assertions below therefore check the one thing that actually broke:
 * that the data marks have real geometry on screen. Asserting that the <svg>
 * merely EXISTS would not have caught it - the surface was present, it just
 * had nothing drawn in it.
 */

/** A drawn chart is one whose area marks occupy real space. */
async function expectChartDrew(chart: Locator, name: string) {
  // The surface must have been laid out. ResponsiveContainer collapsing to
  // zero is a different failure mode than the Redux one, and worth separating.
  const surface = chart.locator('svg.recharts-surface');
  await expect(surface, `${name}: chart surface missing`).toBeVisible();

  const surfaceBox = await surface.boundingBox();
  expect(surfaceBox, `${name}: surface has no box`).not.toBeNull();
  expect(surfaceBox!.width, `${name}: surface collapsed horizontally`).toBeGreaterThan(200);
  expect(surfaceBox!.height, `${name}: surface collapsed vertically`).toBeGreaterThan(100);

  // The actual regression: marks absent despite a correctly sized surface.
  const areas = chart.locator('path.recharts-area-area');
  await expect
    .poll(() => areas.count(), { message: `${name}: no area marks drawn` })
    .toBeGreaterThan(0);

  // Geometry, not just presence - a blank chart can still emit a path whose
  // `d` degenerates to a point.
  //
  // Measured across ALL marks rather than the first one: in a stacked chart
  // the first series is whichever bucket sorts first, which is routinely an
  // account holding zero for the whole projection and so legitimately draws a
  // flat path. Requiring every band to have height would fail on correct
  // output; requiring at least one is what "this chart drew data" means.
  const boxes = await areas.evaluateAll((paths) =>
    paths.map((p) => {
      const b = p.getBoundingClientRect();
      return { width: b.width, height: b.height };
    }),
  );
  const tallest = Math.max(...boxes.map((b) => b.height));
  const widest = Math.max(...boxes.map((b) => b.width));
  expect(widest, `${name}: no area mark drew any width`).toBeGreaterThan(100);
  expect(tallest, `${name}: every area mark was flat - chart drew no data`).toBeGreaterThan(5);

  // Axis ticks prove the layout pass ran end to end rather than the marks
  // happening to paint against an unlaid-out axis.
  await expect(
    chart.locator('.recharts-cartesian-axis-tick').first(),
    `${name}: no axis ticks rendered`,
  ).toBeVisible();
}

async function openChartsTab(page: Page) {
  await page.goto('/');

  // First load with empty storage seeds the demo bundle, so no fixture setup
  // is needed - but that seeding is what makes a scenario exist, so wait for
  // the app to be past it before navigating.
  await expect(page.getByRole('tab', { name: /charts/i })).toBeVisible();
  await page.getByRole('tab', { name: /charts/i }).click();
}

test.describe('charts in a production build', () => {
  test('net worth and balance-by-bucket charts draw their data', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await openChartsTab(page);

    // Scoped to each card by its heading, so a failure names which chart broke
    // instead of reporting "some chart on the page".
    const netWorth = page.locator('div', { has: page.getByRole('heading', { name: /Net Worth Over Time/i }) }).last();
    const byBucket = page.locator('div', { has: page.getByRole('heading', { name: /Balance by Account Bucket/i }) }).last();

    await expectChartDrew(netWorth, 'Net Worth Over Time');
    await expectChartDrew(byBucket, 'Balance by Account Bucket');

    // The original regression was silent, so this is a secondary signal rather
    // than the primary assertion - but a chart library failing loudly in a
    // production bundle is worth failing on too.
    expect(consoleErrors, 'unexpected console errors').toEqual([]);
  });
});
