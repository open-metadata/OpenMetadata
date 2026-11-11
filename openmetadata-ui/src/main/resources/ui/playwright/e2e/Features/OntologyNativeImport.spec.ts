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

import { APIRequestContext, Page, Route } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';

test.use({ isolatedUserOptions: { isAdmin: true } });

const CUSTOMER_RDF_XML = (namespace: string) =>
  `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  <owl:Class rdf:about="${namespace}Customer"><rdfs:label>Customer</rdfs:label></owl:Class>
  <owl:Class rdf:about="${namespace}Order"><rdfs:label>Order</rdfs:label></owl:Class>
</rdf:RDF>`;

const CSV_HEADER =
  'kind,iri,label,description,conceptType,parents,synonyms,mappings,propertyKind,domain,range,enumValues,unit,identifier,inverse,characteristics,propertyChain,disjointWith,superProperties,axiomType,property,target,literal,expressions,abstract,definitionSource,deprecated,replacedBy';

const csvOf = (namespace: string, label = 'Shop CSV') =>
  [
    CSV_HEADER,
    `ONTOLOGY,${namespace}shop,${label},,,,,,,,,,,,,,,,,,,,,,,,,`,
    `CONCEPT,${namespace}Party,Party,,OWL_CLASS,,,,,,,,,,,,,,,,,,,,,,,`,
    `CONCEPT,${namespace}Customer,Customer,,OWL_CLASS,${namespace}Party,,,,,,,,,,,,,,,,,,,true,${namespace}standard,true,${namespace}Party`,
  ].join('\r\n') + '\r\n';

const openImportTab = async (page: Page) => {
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-import-export-trigger').click();
  await page.getByTestId('ontology-native-import-tab').click();
};

const chooseFile = (page: Page, name: string, content: string) =>
  page
    .getByTestId('ontology-native-import-file')
    .locator('input[type="file"]')
    .setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(content),
    });

const createFixture = async (name: string) => {
  const api = await getWorkerAdminAPIContext();
  const namespace = `https://example.org/${name}/`;
  const reviewer = await okJson<{ id: string }>(
    await api.get('/api/v1/users/loggedInUser'),
    'Read native import reviewer'
  );
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        iri: `https://example.org/${name}`,
        namespace,
        reviewers: [{ id: reviewer.id, type: 'user' }],
      },
    }),
    'Create native import fixture'
  );

  return { api, namespace, ontology };
};

/** The ontology names the new-ontology import reads; the studio's own listing asks for fields. */
const isIdentityListing = (url: URL) =>
  url.pathname === '/api/v1/ontologies' && !url.searchParams.has('fields');

const unrelatedTitle = () => `Clash${uuid().replaceAll('-', '')}`;

const identityOfTitle = async (api: APIRequestContext, title: string) => {
  const { baseUri } = await okJson<{ baseUri: string }>(
    await api.get('/api/v1/rdf/status'),
    'Read the RDF base URI'
  );
  const iri = `${baseUri.replace(/\/+$/, '')}/onto/${title
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
    .slice(0, 8)}`;

  return {
    name: title.toLowerCase(),
    iri,
    namespace: `${iri}#`,
  };
};

const conceptTotal = async (api: APIRequestContext, ontologyName: string) =>
  (
    await okJson<{ paging: { total: number } }>(
      await api.get(
        `/api/v1/ontologyConcepts?ontology=${encodeURIComponent(
          ontologyName
        )}&limit=1`
      ),
      'Count the concepts of an ontology'
    )
  ).paging.total;

const startNewOntologyImport = async (
  page: Page,
  fixtureId: string,
  csv: string
) => {
  await page.goto(`/governance/ontology?ontology=${fixtureId}`);
  await openImportTab(page);
  await chooseFile(page, 'clash.csv', csv);
  await page.getByTestId('ontology-native-import-target').click();
  await page.getByRole('option', { name: /new ontology/i }).click();
  await page.getByTestId('ontology-native-import-parse').click();
  await expect(
    page.getByTestId('ontology-native-import-count-new-concepts')
  ).toContainText('2');
};

test.describe(
  'Native ontology import and working review',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('detects the format from content, counts a dry run, applies, and captures', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, namespace, ontology } = await createFixture(
        `pw_native_import_${uuid()}`
      );

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(
          page.getByTestId('ontology-publication-trigger')
        ).toContainText('(1)');
        await openImportTab(page);
        await chooseFile(page, 'customer.ttl', CUSTOMER_RDF_XML(namespace));
        await expect(
          page.getByTestId('ontology-native-import-format')
        ).toHaveText('RDF/XML');

        const preview = page.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/ontologies/${ontology.id}/imports/preview`) &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-parse').click();
        expect((await preview).status()).toBe(200);
        await expect(
          page.getByTestId('ontology-native-import-count-new-concepts')
        ).toContainText('2');
        await expect(
          page.getByTestId('ontology-native-import-draft-notice')
        ).toBeVisible();

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
        ).toContainText('(3)');

        await page.getByTestId('ontology-publication-trigger').click();
        await expect(
          page.getByTestId('ontology-publication-modal')
        ).toContainText('Customer');
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
        await page.getByTestId('ontology-capture-release').click();
        const response = await capture;
        expect(response.ok()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual({
          expectedActivationRevision: state.activationRevision,
          expectedWorkingRevision: state.workingRevision,
          expectedLatestReleaseRevision: state.lastReleaseRevision,
          versionBump: 'minor',
          releaseNotes: '',
        });
        expect(
          (await response.json()).semanticVersion,
          'a first release is v0.1.0'
        ).toBe('0.1.0');
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('imports a native CSV and folds parents into relations', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, namespace, ontology } = await createFixture(
        `pw_native_csv_${uuid()}`
      );

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await openImportTab(page);
        await chooseFile(page, 'shop.csv', csvOf(namespace));
        await expect(
          page.getByTestId('ontology-native-import-format')
        ).toHaveText('CSV');
        await page.getByTestId('ontology-native-import-parse').click();
        await expect(
          page.getByTestId('ontology-native-import-count-new-concepts')
        ).toContainText('2');
        await expect(
          page.getByTestId('ontology-native-import-count-relations')
        ).toContainText('1');

        const applied = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/ontologyChangeSets/') &&
            response.url().endsWith('/apply') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        expect((await applied).status()).toBe(200);
      } finally {
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('imports into a new ontology named from the file', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, namespace, ontology } = await createFixture(
        `pw_native_new_${uuid()}`
      );
      const created: string[] = [];

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await openImportTab(page);
        // The new ontology is named from the file's title, and an ontology left under the same
        // title answers the create with 409, so each run brings its own title.
        await chooseFile(
          page,
          'shop.csv',
          csvOf(namespace, `Shop CSV ${uuid()}`)
        );
        await page.getByTestId('ontology-native-import-target').click();
        await page.getByRole('option', { name: /new ontology/i }).click();
        await page.getByTestId('ontology-native-import-parse').click();
        await expect(
          page.getByTestId('ontology-native-import-count-new-concepts')
        ).toContainText('2');

        const create = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/ontologies') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        const createdOntology = await (await create).json();
        created.push(createdOntology.id);
        expect(created).toHaveLength(1);
        await expect(page).toHaveURL(new RegExp(`ontology=${created[0]}`));
      } finally {
        for (const id of created) {
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${id}?recursive=true`
          );
        }
        await deleteFixtureEntity(
          api,
          `/api/v1/ontologies/${ontology.id}?recursive=true`
        );
      }
    });

    test('keeps a new-ontology import out of an ontology that took the title first', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, namespace, ontology } = await createFixture(
        `pw_native_clash_${uuid()}`
      );
      const title = unrelatedTitle();
      const identity = await identityOfTitle(api, title);
      const holder = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { ...identity, displayName: title },
        }),
        'Create the ontology that already holds the title'
      );
      const created: string[] = [];
      const staleNames = (route: Route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ json: { data: [], paging: { total: 0 } } })
          : route.fallback();

      try {
        // The panel read the names before the holder existed; the stub keeps its list that old.
        await page.route(isIdentityListing, staleNames);
        await startNewOntologyImport(
          page,
          ontology.id,
          csvOf(namespace, title)
        );

        const refused = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/ontologies') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        expect((await refused).status()).toBe(409);
        await expect(page.getByRole('alert')).toContainText(
          `An ontology named ${title} already exists, so nothing was imported`
        );
        await expect(page).not.toHaveURL(new RegExp(`ontology=${holder.id}`));
        expect(
          await conceptTotal(api, holder.name),
          'the ontology that held the title received no concepts'
        ).toBe(0);

        await page.unroute(isIdentityListing, staleNames);
        const create = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/ontologies') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        const createdOntology = await okJson<Ontology>(
          await create,
          'Create the ontology with a free name'
        );
        created.push(createdOntology.id);
        expect(createdOntology.displayName).toBe(`${title} (2)`);
        await expect(page).toHaveURL(new RegExp(`ontology=${created[0]}`));
        await expect
          .poll(() => conceptTotal(api, createdOntology.name))
          .toBe(2);
        expect(await conceptTotal(api, holder.name)).toBe(0);
      } finally {
        for (const id of [...created, holder.id, ontology.id]) {
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${id}?recursive=true&hardDelete=true`
          );
        }
      }
    });

    test('names a new-ontology import around a soft-deleted ontology that holds the title', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, namespace, ontology } = await createFixture(
        `pw_native_gone_${uuid()}`
      );
      const title = unrelatedTitle();
      const identity = await identityOfTitle(api, title);
      const archived = await okJson<Ontology>(
        await api.post('/api/v1/ontologies', {
          data: { ...identity, displayName: title },
        }),
        'Create the ontology that will be archived'
      );
      await deleteFixtureEntity(
        api,
        `/api/v1/ontologies/${archived.id}?recursive=true`
      );
      const created: string[] = [];

      try {
        await startNewOntologyImport(
          page,
          ontology.id,
          csvOf(namespace, title)
        );
        const create = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/ontologies') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        const response = await create;
        expect(
          response.status(),
          'the free name is sent, not the archived one'
        ).toBe(201);
        const createdOntology = (await response.json()) as Ontology;
        created.push(createdOntology.id);
        expect(createdOntology.id).not.toBe(archived.id);
        expect(createdOntology.displayName).toBe(`${title} (2)`);
        await expect(page).toHaveURL(new RegExp(`ontology=${created[0]}`));
        await expect
          .poll(() => conceptTotal(api, createdOntology.name))
          .toBe(2);
      } finally {
        for (const id of [...created, archived.id, ontology.id]) {
          await deleteFixtureEntity(
            api,
            `/api/v1/ontologies/${id}?recursive=true&hardDelete=true`
          );
        }
      }
    });
  }
);
