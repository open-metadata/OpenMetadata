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
import { expect, test } from '../../support/fixtures/base';
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
