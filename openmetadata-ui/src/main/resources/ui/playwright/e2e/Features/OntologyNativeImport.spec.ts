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

import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

test.describe(
  'Native ontology import and working review',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('previews, applies, and captures an imported definition', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_native_import_${uuid()}`;
      const namespace = `https://example.org/${name}/`;
      const ontology = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { name, iri: `https://example.org/${name}`, namespace },
        }),
        'Create native import fixture'
      );
      const rdf = `<${namespace}Customer> a <http://www.w3.org/2002/07/owl#Class> .`;

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
        await page.getByTestId('ontology-import-export-trigger').click();
        await page.getByTestId('ontology-native-import-tab').click();
        await page.locator('input[type="file"]').setInputFiles({
          name: 'customer.nt',
          mimeType: 'application/n-triples',
          buffer: Buffer.from(rdf),
        });
        await expect(
          page.getByTestId('ontology-native-import-preview')
        ).toContainText('Customer');

        const applied = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/ontologyChangeSets/') &&
            response.url().endsWith('/apply') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        expect((await applied).status()).toBe(200);
        await expect(
          page.getByTestId('ontology-publication-trigger')
        ).toContainText('(1)');

        await page.getByTestId('ontology-publication-trigger').click();
        await expect(
          page.getByTestId('ontology-publication-modal')
        ).toContainText('Customer');
        await expect(
          page.getByTestId('ontology-publication-modal')
        ).toContainText('1 Pending Changes');
        const state = await okJson<OntologyState>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read working ontology state'
        );
        expect(state.activeReleaseId).toBeUndefined();

        const capture = page.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/api/v1/ontologies/${ontology.id}/releases`) &&
            response.request().method() === 'POST'
        );
        await page
          .getByRole('button', { name: 'Capture release', exact: true })
          .click();
        const response = await capture;
        expect(response.ok()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual({
          expectedActivationRevision: state.activationRevision,
          expectedWorkingRevision: state.workingRevision,
        });
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });
  }
);
