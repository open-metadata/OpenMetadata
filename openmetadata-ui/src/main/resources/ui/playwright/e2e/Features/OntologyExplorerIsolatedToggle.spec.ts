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
import { OntologyExplorerIsolatedToggleData as ToggleData } from '../../support/entity/OntologyExplorerDataClass';
import {
  createApiContext,
  disposeApiContext,
  navigateAndFilterByGlossary,
  readNodePositions,
  waitForNodeAbsent,
  waitForNodePresent,
} from '../../utils/ontologyExplorer';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createApiContext(browser);
  await ToggleData.setup(apiContext);
  await disposeApiContext(afterAction, apiContext);
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createApiContext(browser);
  await ToggleData.teardown(apiContext);
  await disposeApiContext(afterAction, apiContext);
});

test.describe('Ontology Explorer — isolated nodes toggle', () => {
  test('isolated term is visible by default (showIsolatedNodes = true)', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(
      page,
      ToggleData.toggleGlossary.responseData.id
    );

    const positions = await readNodePositions(page);

    expect(
      positions[ToggleData.toggleTermIso.responseData.id],
      'isolated term must be visible because showIsolatedNodes defaults to true'
    ).toBeDefined();
    expect(
      positions[ToggleData.toggleTermA.responseData.id],
      'connected term A must also be visible'
    ).toBeDefined();
    expect(
      positions[ToggleData.toggleTermB.responseData.id],
      'connected term B must also be visible'
    ).toBeDefined();
  });

  test('toggling isolated nodes OFF hides the isolated term', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(
      page,
      ToggleData.toggleGlossary.responseData.id
    );

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodeAbsent(page, ToggleData.toggleTermIso.responseData.id);

    const positions = await readNodePositions(page);

    expect(
      positions[ToggleData.toggleTermIso.responseData.id],
      'isolated term must be hidden after toggling showIsolatedNodes OFF'
    ).toBeUndefined();
    expect(
      positions[ToggleData.toggleTermA.responseData.id],
      'connected term A must still be visible'
    ).toBeDefined();
    expect(
      positions[ToggleData.toggleTermB.responseData.id],
      'connected term B must still be visible'
    ).toBeDefined();
  });

  test('toggling isolated nodes back ON restores the isolated term', async ({
    page,
  }) => {
    test.slow();
    await navigateAndFilterByGlossary(
      page,
      ToggleData.toggleGlossary.responseData.id
    );

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodeAbsent(page, ToggleData.toggleTermIso.responseData.id);

    await page.getByTestId('ontology-isolated-toggle').click();
    await waitForNodePresent(page, ToggleData.toggleTermIso.responseData.id);

    const positions = await readNodePositions(page);

    expect(
      positions[ToggleData.toggleTermIso.responseData.id],
      'isolated term must be restored after toggling showIsolatedNodes back ON'
    ).toBeDefined();
  });
});
