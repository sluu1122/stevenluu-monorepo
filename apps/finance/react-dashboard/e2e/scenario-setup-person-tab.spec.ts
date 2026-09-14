import { test, expect, type Page } from '@playwright/test';

/**
 * The Scenario Setup person tabs surviving a scenario switch.
 *
 * This is the third thing unit tests structurally cannot reach. The failure
 * was not a wrong value anywhere - it was Radix being handed a `value` naming
 * a tab that no longer existed, so it selected nothing and rendered no
 * content. Every piece of state was individually correct; only the rendered
 * page was empty, and only in a browser.
 *
 * The bug: the open tab was tracked by PERSON ID. Ids are unique per scenario,
 * so switching scenarios left the id pointing at someone who wasn't in the new
 * one. The whole setup form vanished, with no error and no tab selected.
 *
 * Asserting that the tab strip is visible would not catch it - the triggers
 * kept rendering fine. What broke is the CONTENT below them, so that is what
 * is asserted.
 */

/** The sub-tab strip inside the setup form, not the app's top-level tabs. */
function subTabs(page: Page) {
  return page.locator('[role=tablist]').last().getByRole('tab');
}

/** Whichever sub-tab is currently selected, or nothing at all - which is the bug. */
function activeSubTab(page: Page) {
  return page.locator('[role=tablist]').last().locator('[role=tab][aria-selected="true"]');
}

async function openScenarioSetup(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: /scenario setup/i })).toBeVisible();
  await page.getByRole('tab', { name: /scenario setup/i }).first().click();
  // The demos seed on first load; wait for a two-person scenario to be up.
  await expect(subTabs(page).nth(2)).toBeVisible();
}

/** A person tab is genuinely open only if its cards rendered. */
async function expectPersonTabShowing(page: Page, name: RegExp) {
  await expect(activeSubTab(page)).toHaveText(name);
  await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
}

async function expectHouseholdShowing(page: Page) {
  await expect(activeSubTab(page)).toHaveText(/Household/);
  await expect(page.getByRole('heading', { name: 'Global Parameters' })).toBeVisible();
}

test.describe('Scenario Setup person tabs', () => {
  test('switching scenarios with a person tab open keeps showing a form', async ({ page }) => {
    await openScenarioSetup(page);

    await subTabs(page).nth(2).click();
    await expectPersonTabShowing(page, /Person 2/);

    // The demos are ordered cross-border, Canadian couple, US single, US
    // couple - so index 1 is the other two-person household.
    await page.locator('[data-scenario-id]').nth(1).click();

    // Before the fix this was a blank page: no tab selected, no cards at all.
    await expectPersonTabShowing(page, /Person 2/);
  });

  test('falls back to Household when the new scenario has fewer people', async ({ page }) => {
    await openScenarioSetup(page);

    await subTabs(page).nth(2).click();
    await expectPersonTabShowing(page, /Person 2/);

    // US Single Filer has one person, so position 2 cannot be honoured.
    await page.locator('[data-scenario-id]').nth(2).click();
    await expectHouseholdShowing(page);
  });
});
