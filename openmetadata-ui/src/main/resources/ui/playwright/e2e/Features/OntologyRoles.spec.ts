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
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';

const ONTOLOGIES = '/api/v1/ontologies';

test.describe(
  'Ontology author role',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('a user with only the OntologyAuthor role creates an ontology and a concept in Studio', async ({
      freshUserPage: { page, user },
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const role = await okJson<{ id: string }>(
        await api.get('/api/v1/roles/name/OntologyAuthor'),
        'Read the OntologyAuthor role'
      );
      await okJson(
        await api.patch(`/api/v1/users/${user.responseData.id}`, {
          data: [
            {
              op: 'add',
              path: '/roles/-',
              value: { id: role.id, type: 'role' },
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }),
        'Assign OntologyAuthor'
      );

      const name = `pw_author_${uuid()}`;
      let ontology: Ontology | undefined;

      try {
        await page.goto('/governance/ontology');
        await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
        await page.getByTestId('ontology-scope-menu-trigger').click();
        await page.getByTestId('ontology-create').click();

        await page.getByTestId('ontology-create-name').fill(name);
        const created = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === ONTOLOGIES &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-create-submit').click();
        ontology = await okJson<Ontology>(
          await created,
          'Create an ontology as an author'
        );
        await expect(page).toHaveURL(
          new RegExp(`[?&]ontology=${ontology.id}(?:&|$)`)
        );

        await expect(
          page.getByTestId('ontology-new-class-panel')
        ).toBeVisible();
        await page.getByTestId('new-class-label').fill('Customer');
        const applied = page.waitForResponse(
          (candidate) =>
            candidate.url().includes('/ontologyChangeSets/') &&
            candidate.url().endsWith('/apply') &&
            candidate.request().method() === 'POST'
        );
        await clickIgnoringToasts(page.getByTestId('new-class-create'));
        expect((await applied).status()).toBe(200);

        const concepts = await okJson<{ data: OntologyConcept[] }>(
          await api.get('/api/v1/ontologyConcepts', {
            params: {
              ontology: ontology.fullyQualifiedName ?? name,
              limit: 10,
            },
          }),
          'List the concepts the author created'
        );
        expect(concepts.data.map((concept) => concept.name)).toContain(
          'Customer'
        );
      } finally {
        if (ontology) {
          await deleteFixtureEntity(
            api,
            `${ONTOLOGIES}/${ontology.id}?recursive=true&hardDelete=true`
          );
        }
      }
    });
  }
);
