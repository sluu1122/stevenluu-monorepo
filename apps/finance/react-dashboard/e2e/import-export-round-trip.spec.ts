import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * The scenario export/import round trip, driven through the real dialog.
 *
 * This is the second thing unit tests structurally cannot reach: the data
 * leaves the app as a downloaded file and comes back through a file input, so
 * the browser's own download and upload plumbing is part of the path. A unit
 * test can call `downloadExport` and `parseImportFile` and assert they agree,
 * and still miss a dialog that exports the wrong selection, a file that never
 * reaches disk, or an import that silently drops what it parsed.
 *
 * The round trip is closed deliberately: a scenario is DELETED between export
 * and import, so the assertion at the end can only pass if the data genuinely
 * survived the file. Exporting and re-importing without changing anything in
 * between would pass just as happily against an import that did nothing at all.
 */

/**
 * Read off the rows themselves rather than their per-row controls, which live
 * behind the sidebar's edit mode - the list has to be readable here without
 * entering it.
 */
function scenarioNames(page: Page) {
  return page.locator('[data-scenario-id]').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
}

/** Duplicate and delete are only rendered in edit mode. */
async function enterEditMode(page: Page) {
  const toggle = page.getByRole('button', { name: 'Edit scenarios' });
  if (await toggle.isVisible()) await toggle.click();
}

async function openImportExport(page: Page) {
  await page.getByRole('button', { name: 'Import / Export' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('scenario export/import', () => {
  test('a deleted scenario comes back from an exported file', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('/');

    // First load with empty storage seeds the demo bundle. Wait for that rather
    // than a fixed timeout, since everything below counts scenarios. Any
    // non-zero count means seeding finished - the demos are written as one
    // blob, so the list goes from empty to complete in a single step, and not
    // naming a number here keeps this from breaking when one is added.
    await expect.poll(() => scenarioNames(page).then((n) => n.length)).toBeGreaterThan(0);
    const before = await scenarioNames(page);

    // --- Export -----------------------------------------------------------
    await openImportExport(page);

    // Everything is selected when the dialog opens, so the count in the button
    // doubles as a check that the export tab saw every scenario.
    const exportButton = page.getByRole('button', { name: `Export (${before.length})` });
    await expect(exportButton).toBeEnabled();

    const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);

    // Through a real file on disk, not the in-memory blob - that round trip is
    // the point of this spec.
    const exportPath = testInfo.outputPath('scenarios-export.json');
    await download.saveAs(exportPath);
    expect(download.suggestedFilename(), 'export filename').toMatch(/^retirement-planner-all-scenarios-\d{4}-\d{2}-\d{2}\.json$/);

    const bundle = JSON.parse(readFileSync(exportPath, 'utf8'));
    expect(bundle.schemaVersion, 'bundle schemaVersion').toBeGreaterThan(0);
    expect(bundle.scenarios.map((s: { name: string }) => s.name).sort(), 'exported scenarios').toEqual([...before].sort());
    expect(Array.isArray(bundle.overrides), 'bundle carries overrides').toBe(true);

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // --- Delete one, so the import has something to prove ------------------
    const victim = before[0];
    await enterEditMode(page);
    await page.locator(`[aria-label="Delete ${victim}"]`).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect.poll(() => scenarioNames(page).then((n) => n.length), { message: 'scenario was not deleted' }).toBe(before.length - 1);
    expect(await scenarioNames(page)).not.toContain(victim);

    // --- Import the file back ---------------------------------------------
    await openImportExport(page);
    await page.getByRole('tab', { name: 'Import' }).click();

    // Merge is the default and is what this asserts: the survivors stay, the
    // deleted one returns. `setInputFiles` targets the hidden input directly,
    // which is the same path a user's file picker ends at.
    await page.locator('input[type="file"]').setInputFiles(exportPath);

    // The dialog closes itself on a successful import.
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect.poll(() => scenarioNames(page).then((n) => n.length), { message: 'import did not restore the scenario' }).toBe(before.length);

    // Compared as a set. A merge appends what it restores, so the recovered
    // scenario comes back last rather than in its original slot. List order is
    // insertion order and nothing depends on it today, so asserting the
    // sequence here would pin behaviour this spec is not about.
    expect((await scenarioNames(page)).sort(), 'restored set matches the original').toEqual([...before].sort());

    expect(consoleErrors, 'unexpected console errors').toEqual([]);
  });

  test('a malformed file is rejected with a reason and changes nothing', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect.poll(() => scenarioNames(page).then((n) => n.length)).toBeGreaterThan(0);
    const before = await scenarioNames(page);

    const badPath = testInfo.outputPath('not-a-bundle.json');
    // Valid JSON, wrong shape - so this exercises schema rejection rather than
    // the JSON.parse failure, which is the easier of the two to get right.
    writeFileSync(badPath, JSON.stringify({ schemaVersion: 10, scenarios: 'nope' }), 'utf8');

    await openImportExport(page);
    await page.getByRole('tab', { name: 'Import' }).click();
    await page.locator('input[type="file"]').setInputFiles(badPath);

    // Stays open and says why, rather than closing as though it worked.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('li').filter({ hasText: /scenarios/i }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    expect(await scenarioNames(page), 'a rejected import must not alter state').toEqual(before);
  });
});
