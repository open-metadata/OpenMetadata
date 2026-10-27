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

import { Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import {
  clickIgnoringToasts,
  getWorkerAdminAPIContext,
  uuid,
} from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

const EMPTY_LIST = { data: [], paging: { total: 0 } };

const hideCatalog = async (page: Page) => {
  const isCatalogList = (url: URL) => url.pathname === '/api/v1/ontologies';
  let created = false;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/ontologies'
    ) {
      created = true;
    }
  });
  await page.route(isCatalogList, async (route) => {
    if (route.request().method() === 'GET' && !created) {
      await route.fulfill({ json: EMPTY_LIST });
    } else {
      await route.fallback();
    }
  });

  return () => page.unroute(isCatalogList);
};

const openEmptyStudio = async (page: Page) => {
  const showCatalog = await hideCatalog(page);
  await page.goto('/governance/ontology');
  await expect(page.getByTestId('ontology-empty-state')).toBeVisible();

  return showCatalog;
};

const deleteOntology = async (ontology?: Ontology) => {
  if (ontology) {
    await deleteFixtureEntity(
      await getWorkerAdminAPIContext(),
      `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
    );
  }
};

const isOntologyCreate = (response: {
  url(): string;
  request(): { method(): string };
}) =>
  new URL(response.url()).pathname === '/api/v1/ontologies' &&
  response.request().method() === 'POST';

const TURTLE = (namespace: string) =>
  [
    '@prefix owl: <http://www.w3.org/2002/07/owl#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    `<${namespace}Customer> a owl:Class ; rdfs:label "Customer" .`,
    `<${namespace}Order> a owl:Class ; rdfs:label "Order" .`,
  ].join('\n');

test.describe(
  'Ontology Studio first run',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('shows the empty state with three options and only Library, Import and Tasks in the top bar', async ({
      isolatedUserPage: page,
    }) => {
      await openEmptyStudio(page);

      await expect(
        page.getByRole('heading', { name: 'No ontologies yet' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Install from library' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Import a file' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create from scratch' })
      ).toBeVisible();
      await expect(page.getByTestId('mode-tab-view')).toHaveCount(0);
      await expect(page.getByTestId('mode-tab-edit')).toHaveCount(0);
      await expect(
        page.getByTestId('ontology-publication-trigger')
      ).toHaveCount(0);
      await expect(page.getByTestId('ontology-library-trigger')).toBeVisible();
      await expect(
        page.getByTestId('ontology-import-export-trigger')
      ).toBeVisible();
      await expect(page.getByTestId('ontology-tasks-trigger')).toBeVisible();
    });

    test('leaves the empty state after installing from the library', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      let installed: Ontology | undefined;
      try {
        await openEmptyStudio(page);
        await page
          .getByRole('button', { name: 'Install from library' })
          .click();
        await expect(page.getByTestId('ontology-library')).toBeVisible();
        await page.getByTestId('ontology-pack-details-fibo').click();
        await page.getByTestId('ontology-module-foundations').click();
        await page.getByTestId('ontology-module-business-entities').click();
        await expect(
          page.getByTestId('ontology-pack-concept-count')
        ).toHaveText('8');

        const created = page.waitForResponse(isOntologyCreate);
        await page.getByTestId('ontology-library-native-install').click();
        installed = await okJson<Ontology>(
          await created,
          'Install into a new ontology'
        );
        await expect(page.getByTestId('ontology-pack-fibo')).toContainText(
          'Installed'
        );
        await page.keyboard.press('Escape');

        await expect(page.getByTestId('ontology-empty-state')).toHaveCount(0);
        await expect(page.getByTestId('mode-tab-view')).toBeVisible();
      } finally {
        await deleteOntology(installed);
      }
    });

    test('leaves the empty state after importing a Turtle file into a new ontology', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const namespace = `https://example.org/pw_first_run_${uuid()}/`;
      let imported: Ontology | undefined;
      try {
        const showCatalog = await openEmptyStudio(page);
        await page.getByRole('button', { name: 'Import a file' }).click();
        await expect(
          page.getByTestId('ontology-native-import-target')
        ).toContainText('New ontology');
        await page
          .getByTestId('ontology-native-import-file')
          .locator('input[type="file"]')
          .setInputFiles({
            name: 'customer.ttl',
            mimeType: 'text/turtle',
            buffer: Buffer.from(TURTLE(namespace)),
          });
        await expect(
          page.getByTestId('ontology-native-import-format')
        ).toHaveText('Turtle');

        const parsed = page.waitForResponse(
          (response) =>
            response.url().endsWith('/imports/preview') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-parse').click();
        expect((await parsed).status()).toBe(200);
        await expect(
          page.getByTestId('ontology-native-import-count-new-concepts')
        ).toContainText('2');
        await expect(page.getByTestId('ontology-empty-state')).toBeVisible();

        const created = page.waitForResponse(isOntologyCreate);
        await page.getByTestId('ontology-native-import-apply').click();
        imported = await okJson<Ontology>(
          await created,
          'Import into a new ontology'
        );
        await showCatalog();

        await expect(page).toHaveURL(
          new RegExp(`[?&]ontology=${imported.id}(?:&|$)`)
        );
        await expect(page.getByTestId('ontology-empty-state')).toHaveCount(0);
      } finally {
        await deleteOntology(imported);
      }
    });

    test('creates an ontology from scratch and lands in Edit with the New class panel', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const name = `pw_first_run_${uuid()}`;
      const prefix = `pw-first-run-${uuid()}`;
      let created: Ontology | undefined;
      try {
        const showCatalog = await openEmptyStudio(page);
        await page.getByRole('button', { name: 'Create from scratch' }).click();
        const submit = page.getByTestId('ontology-create-submit');
        await expect(submit).toBeDisabled();

        await page.getByTestId('ontology-create-name').fill('Finance Core');
        await expect(
          page.getByTestId('ontology-create-iri-preview')
        ).toHaveText(/\/onto\/financec#$/);
        await page.getByTestId('ontology-create-name').clear();
        await expect(submit).toBeDisabled();

        await page.getByTestId('ontology-create-name').fill(name);
        await page.getByTestId('ontology-create-prefix').fill(prefix);
        await expect(
          page.getByTestId('ontology-create-iri-preview')
        ).toHaveText(new RegExp(`/onto/${prefix}#$`));

        const response = page.waitForResponse(isOntologyCreate);
        await submit.click();
        created = await okJson<Ontology>(await response, 'Create from scratch');
        await showCatalog();

        expect(created.layer).toBe('L3');
        expect(created.namespace).toMatch(new RegExp(`/onto/${prefix}#$`));
        await expect(page).toHaveURL(
          new RegExp(`[?&]ontology=${created.id}(?:&|$)`)
        );
        await expect(page.getByTestId('mode-tab-edit')).toHaveAttribute(
          'aria-selected',
          'true'
        );
        await expect(
          page.getByTestId('ontology-new-class-panel')
        ).toBeVisible();
        await expect(
          page.getByText(new RegExp(`Created ontology ${name}`))
        ).toBeVisible();

        await page.getByTestId('ontology-new-class-close').click();
        await expect(page.getByTestId('ontology-empty-card')).toBeVisible();
        await page.getByTestId('ontology-empty-card-add-concept').click();
        await expect(
          page.getByTestId('ontology-new-class-panel')
        ).toBeVisible();
        await page.getByTestId('ontology-new-class-close').click();
        await page.getByTestId('ontology-add-concept').click();
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
        await expect(page.getByTestId('ontology-empty-card')).toHaveCount(0);
        await expect(page.getByTestId('ontology-new-class-panel')).toHaveCount(
          0
        );
        const concepts = await okJson<{ data: Array<{ iri: string }> }>(
          await api.get('/api/v1/ontologyConcepts', {
            params: { ontology: created.fullyQualifiedName },
          }),
          'Read the first class'
        );
        expect(concepts.data.map((concept) => concept.iri)).toEqual([
          `${created.namespace}Customer`,
        ]);
      } finally {
        await deleteOntology(created);
      }
    });
  }
);
