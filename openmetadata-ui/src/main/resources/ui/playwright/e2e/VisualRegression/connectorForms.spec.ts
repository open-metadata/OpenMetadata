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
import connectors from '../../fixtures/visual/connectors.json';
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
  withFullVisualTarget,
} from '../../utils/visualRegression';

for (const theme of VISUAL_THEMES) {
  test.describe(`Connection forms ${theme}`, { tag: '@Platform' }, () => {
    test.beforeEach(async ({ page }) => {
      await prepareVisualTheme(page, theme);
      await installVisualData(page);
    });
    for (const category of [
      ...new Set(connectors.map((item) => item.category)),
    ]) {
      const items = connectors.filter((item) => item.category === category);
      test(`${category} connector chooser`, async ({ page }) => {
        await gotoForScreenshot(page, `/connections/add-service/${category}`, {
          readyTestId: 'select-service',
        });
        await expectVisualScreenshot(
          page,
          `connections-${category}-chooser`,
          theme
        );
      });
      // Each connector owns its page and timing record. A failing form must not
      // prevent the rest of its category from being captured or sharded.
      for (const { connector, layout } of items) {
        test(`${category} ${connector} configuration form`, async ({
          page,
        }) => {
          await gotoForScreenshot(
            page,
            `/connections/add-service/${category}`,
            {
              readyTestId: 'select-service',
            }
          );
          await page.getByTestId(connector).click();
          await expect(page.getByTestId('service-name')).toBeVisible();
          await page.getByTestId('service-name').fill('visual_connection');
          await expect(
            page.getByTestId('connection-schema-loader')
          ).toBeHidden();
          const form = page.getByTestId('connection-grouped-form');
          const captureForm = (name: string) =>
            withFullVisualTarget(page, form, () =>
              expectVisualScreenshot(page, name, theme, {
                target: form,
                // A percentage budget on tall forms can accept missing field labels.
                maxDiffPixelRatio: 0,
              })
            );
          if (layout === 'unconfigured') {
            await expect(
              page.getByText('No Connection Configs available.', {
                exact: true,
              })
            ).toBeVisible();
            await expectVisualScreenshot(
              page,
              `connection-${category}-${connector}`,
              theme
            );
          } else {
            await expect(form).toBeVisible();
            await expect(
              form.locator(
                'input:visible, select:visible, textarea:visible, button:visible'
              )
            ).not.toHaveCount(0);
            await captureForm(`connection-${category}-${connector}`);
          }
          if (connector === items[0].connector) {
            // Form captures exclude the wizard's setup guide, test action and navigation.
            await expectVisualScreenshot(
              page,
              `connection-${category}-wizard`,
              theme
            );
          }
          if (layout !== 'unconfigured') {
            let expanded = false;
            for (const key of ['scope', 'advanced']) {
              const section = form.getByTestId(`connection-section-${key}`);
              if (await section.count()) {
                await section
                  .locator('button.connection-section-header')
                  .click();
                expanded = true;
              }
            }
            if (expanded)
              await captureForm(`connection-${category}-${connector}-expanded`);
            const keyPair = form.getByTestId('auth-tab-keypair');
            if (await keyPair.count()) {
              await keyPair.click();
              await captureForm(`connection-${category}-${connector}-keypair`);
            }
          }
        });
      }
    }
  });
}
