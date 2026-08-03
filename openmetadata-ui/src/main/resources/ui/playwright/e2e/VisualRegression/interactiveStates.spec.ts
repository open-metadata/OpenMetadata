/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { expect, test } from '@playwright/test';
import {
  gotoForScreenshot,
  SCREENSHOT_OPTS,
} from '../../utils/visualRegression';

test('add-service connector config form (RJSF) matches baseline', async ({
  page,
}) => {
  await gotoForScreenshot(page, '/databaseServices/add-service');
  // Step 1 (Select Service Type): clicking a connector card advances
  // straight to step 2 (see AddServicePage.component.tsx
  // `handleServiceTypeClick`, which calls `setActiveServiceStep(2)`
  // unconditionally) — there is no intermediate "next" click here, unlike
  // the connection-config step later in the same wizard.
  await page.getByTestId('select-service').waitFor({ state: 'visible' });
  await page.getByTestId('Mysql').click();

  // Step 2 renders the service-name field and the RJSF connection config
  // form together on one screen (AddServicePage.component.tsx renders
  // `ServiceNameCard` and `ConnectionConfigForm` side by side for
  // `activeServiceStep === 2`).
  await page.getByTestId('service-name').waitFor({ state: 'visible' });
  await page.getByTestId('service-name').fill('pw_visual_mysql');
  await expect(page.getByTestId('connection-schema-loader')).toBeHidden({
    timeout: 10000,
  });
  await expect(page.getByTestId('connection-grouped-form')).toBeVisible();

  await expect(page).toHaveScreenshot('rjsf-mysql-connection-form.png', {
    ...SCREENSHOT_OPTS,
  });
});

test('delete confirmation modal matches baseline', async ({ page }) => {
  // `/glossary` auto-redirects to the first seeded glossary
  // (GlossaryPage.component.tsx navigates to `glossaries[0]` when no fqn is
  // present in the route) — the same stable seed data the `glossary`
  // static-page baseline (staticPages.spec.ts) already relies on, so no
  // name masking is required here either.
  await gotoForScreenshot(page, '/glossary');
  // The bare `/glossary` route client-side redirects to
  // `/glossary/<first-glossary-fqn>`, remounting GlossaryHeader in the
  // process. A click landed before that remount opens the dropdown on a
  // component instance that is about to be thrown away, leaving the menu
  // permanently closed — so wait for the redirected URL first, then retry
  // the open until the menu actually shows.
  await page.waitForURL('**/glossary/**');
  await page.getByTestId('entity-header-display-name').waitFor({
    state: 'visible',
  });

  await expect(async () => {
    await page.getByTestId('manage-button').click();

    await expect(page.getByTestId('delete-button')).toBeVisible({
      timeout: 2000,
    });
  }).toPass();

  // FREEZE_CSS (applied by gotoForScreenshot) sets `animation: none`, so
  // rc-motion never receives its animationend event and leaves the dropdown
  // overlay stuck with `pointer-events: none` — a trusted click falls
  // through to the element underneath. Dispatch the click directly on the
  // menu item instead (same pattern as playwright/utils/lineage.ts).
  await page.getByTestId('delete-button').dispatchEvent('click');
  await page.getByTestId('delete-modal').waitFor({ state: 'visible' });

  await expect(page).toHaveScreenshot('delete-modal.png', {
    ...SCREENSHOT_OPTS,
  });
});

test('explore entity summary panel (side panel) matches baseline', async ({
  page,
}) => {
  // ExploreV1.component.tsx auto-opens the summary panel for the first
  // search result as soon as results arrive (see the `searchResults`
  // useEffect), so the panel is already visible on plain `/explore` load —
  // that's what the static `explore` baseline (staticPages.spec.ts)
  // incidentally captures. This test exercises the panel as its own
  // composition context instead: it explicitly re-selects a *different*
  // result by clicking its card, then screenshots just the panel, isolating
  // the "Typography inside a side panel/drawer" styling context from the
  // rest of the Explore layout.
  await gotoForScreenshot(page, '/explore');
  const summaryPanel = page.getByTestId('entity-summary-panel-container');
  await summaryPanel.waitFor({ state: 'visible' });

  // Dispatch directly on the card container (not a physical click) so the
  // event bubbles to the Card's own onClick without also triggering the
  // nested `entity-link` <Link>, which would navigate away from Explore
  // instead of just updating the panel (same technique as the
  // delete-modal test above, and playwright/utils/lineage.ts).
  await page
    .locator('[data-testid^="table-data-card_"]')
    .nth(1)
    .dispatchEvent('click');
  await summaryPanel.waitFor({ state: 'visible' });
  // The panel's Lineage tab-content fetches asynchronously and renders a
  // spinner (`data-testid="loader"`, src/components/common/Loader) while
  // in flight — wait for it to clear so the baseline captures the settled
  // "No lineage connections found" state rather than a mid-load spinner.
  await summaryPanel.getByTestId('loader').waitFor({ state: 'detached' });

  await expect(summaryPanel).toHaveScreenshot(
    'explore-entity-summary-panel.png',
    SCREENSHOT_OPTS
  );
});

test('add team form (form inside modal) matches baseline', async ({ page }) => {
  // The highest-value coupling case for this migration: Typography/Input
  // labels rendered by an antd <Form> nested inside an antd <Modal> —
  // AddTeamForm.tsx (src/pages/TeamsPage/AddTeamForm.tsx), opened from the
  // `teams` static page (staticPages.spec.ts) via its "add-team" button.
  // The form itself is blank on open, but this asserts on the *modal*, not
  // the page. An earlier version screenshotted `page`, which also captured
  // the teams table behind the modal - and that table is full of
  // playwright-generated fixtures with random name suffixes
  // ("PW Data Consumer Team b4d7cdd9") plus a "Total Users" count that moves
  // as other specs create users. The baseline could never be stable, and the
  // resulting churn is indistinguishable from a real regression.
  //
  // Scoping to `.ant-modal` keeps the assertion on this test's actual
  // subject - the form inside the modal - and makes it immune to whatever
  // the page behind it happens to be showing.
  await gotoForScreenshot(page, '/settings/members/teams');
  await page.getByTestId('add-team').click();
  await page.getByTestId('name').waitFor({ state: 'visible' });
  await page.getByTestId('display-name').waitFor({ state: 'visible' });
  // The description field is a lazily-mounted RichTextEditor
  // (src/components/common/RichTextEditor/RichTextEditor.tsx); wait for it
  // so the screenshot doesn't race its async chunk load / toolbar mount.
  await page.getByTestId('editor').waitFor({ state: 'visible' });
  // antd autofocuses the first field (`name`) on modal open; a live text
  // caret keeps repainting every blink cycle, which stops the screenshot
  // assertion from ever seeing two identical frames in a row. `caret:
  // 'hide'` (in SCREENSHOT_OPTS) covers native <input>/<textarea> carets,
  // but blur explicitly too so nothing is left focused/blinking.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur()
  );

  // `.ant-modal-content`, not `.ant-modal`: the latter is antd's transparent
  // positioning wrapper, so screenshotting it captures whatever shows through
  // from the page behind rather than the dialog itself.
  await expect(page.locator('.ant-modal-content')).toHaveScreenshot(
    'add-team-form.png',
    SCREENSHOT_OPTS
  );
});
