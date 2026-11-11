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

import type { Ontology } from '../../../src/generated/entity/data/ontology';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext } from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

test('filters, previews, and keeps a native pack installed across reload', async ({
  isolatedUserPage: page,
}) => {
  test.slow();
  const api = await getWorkerAdminAPIContext();
  let installed: Ontology | undefined;
  try {
    await page.goto('/governance/ontology');
    await page.getByTestId('ontology-library-trigger').click();
    await page.getByTestId('ontology-library-filter-cross-industry').click();
    await expect(page.getByTestId('ontology-pack-sosa-ssn')).toBeVisible();
    await expect(page.getByTestId('ontology-pack-sosa-ssn')).toHaveCount(0);

    const firstSample = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/ontologyPacks/sosa-ssn/sample') &&
        response.request().method() === 'GET'
    );
    await page.getByTestId('ontology-pack-sosa-ssn').click();
    expect((await firstSample).ok()).toBe(true);
    await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
      '27'
    );
    await expect(page.getByTestId('ontology-pack-sample-node-0')).toBeVisible();
    await expect(page.getByTestId('ontology-pack-sample-edge-0')).toBeVisible();
    await expect(page.getByTestId('ontology-pack-detail')).toContainText(
      'Aligned to Semantic Sensor Network Ontology'
    );

    const smallerSample = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/ontologyPacks/sosa-ssn/sample') &&
        response.url().includes('moduleIds=sosa') &&
        response.request().method() === 'GET'
    );
    await page.getByTestId('ontology-module-ssn').click();
    expect((await smallerSample).ok()).toBe(true);
    await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
      '16'
    );
    await expect(
      page.getByTestId('ontology-pack-sample-node-15')
    ).toBeVisible();
    await expect(page.getByTestId('ontology-pack-sample-node-16')).toHaveCount(
      0
    );
    await page.getByTestId('ontology-module-ssn').click();
    await expect(page.getByTestId('ontology-pack-concept-count')).toHaveText(
      '27'
    );

    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/ontologies' &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('ontology-library-native-install').click();
    installed = await okJson<Ontology>(
      await created,
      'Create sensor pack target'
    );
    await expect(page.getByTestId('ontology-pack-sosa-ssn')).toContainText(
      'Installed'
    );

    const stored = await okJson<Ontology>(
      await api.get(`/api/v1/ontologies/${installed.id}`),
      'Read installed ontology'
    );
    expect(stored.layer).toBe('L1');
    expect(stored.installedPacks?.[0].packId).toBe('sosa-ssn');

    await page.reload();
    await page.getByTestId('ontology-library-trigger').click();
    await expect(page.getByTestId('ontology-pack-sosa-ssn')).toContainText(
      'Installed'
    );
    await page.getByTestId('ontology-pack-sosa-ssn').click();
    await expect(
      page.getByTestId(`ontology-library-installed-in-${installed.id}`)
    ).toContainText(installed.displayName ?? installed.name);
  } finally {
    if (installed) {
      await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${installed.id}?recursive=true&hardDelete=true`
      );
    }
  }
});
