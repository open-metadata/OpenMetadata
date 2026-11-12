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
import { readFile } from 'fs/promises';
import { Status as InstallJobStatus } from '../../../src/generated/api/data/ontologyPackInstallJob';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import {
  selectOntologyOption,
  waitForPackInstallJob,
} from '../../utils/ontologyStudio';

test.use({ isolatedUserOptions: { isAdmin: true } });

const NS = (name: string) => `https://example.org/${name}/`;

const TURTLE = (ns: string) => `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<${ns}Invoice> a owl:Class ; rdfs:label "Invoice" .
<${ns}Payment> a owl:Class ; rdfs:label "Payment" .
<${ns}Receipt> a owl:Class ; rdfs:label "Receipt" ; rdfs:subClassOf <${ns}Payment> .
`;

const DATE_RANGE_TURTLE = (
  ns: string
) => `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
<${ns}Invoice> a owl:Class ; rdfs:label "Invoice" .
<${ns}issuedOn> a owl:DatatypeProperty ; rdfs:label "issued on" ; rdfs:domain <${ns}Invoice> ; rdfs:range xsd:date .
`;

const RULES_TURTLE = (
  ns: string
) => `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<${ns}Invoice> a owl:Class ; rdfs:label "Invoice" .
<${ns}Payment> a owl:Class ; rdfs:label "Payment" .
<${ns}Receipt> a owl:Class ; rdfs:label "Receipt" .
<${ns}Invoice> owl:disjointWith <${ns}Payment> .
`;

const CLASH_TURTLE = (
  ns: string
) => `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<${ns}Invoice> a owl:Class ; rdfs:label "Invoice" .
<${ns}Payment> a owl:Class ; rdfs:label "Payment" .
<${ns}Receipt> a owl:Class ; rdfs:label "Receipt" ; rdfs:subClassOf <${ns}Invoice>, <${ns}Payment> .
<${ns}Invoice> owl:disjointWith <${ns}Payment> .
`;

const FORMAT_FILES = (ns: string) => ({
  turtle: { name: 'billing.ttl', content: TURTLE(ns), label: 'Turtle' },
  rdfxml: {
    name: 'billing.rdf',
    label: 'RDF/XML',
    content: `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  <owl:Class rdf:about="${ns}Invoice"><rdfs:label>Invoice</rdfs:label></owl:Class>
  <owl:Class rdf:about="${ns}Payment"><rdfs:label>Payment</rdfs:label></owl:Class>
  <owl:Class rdf:about="${ns}Receipt"><rdfs:label>Receipt</rdfs:label><rdfs:subClassOf rdf:resource="${ns}Payment"/></owl:Class>
</rdf:RDF>`,
  },
  jsonld: {
    name: 'billing.jsonld',
    label: 'JSON-LD',
    content: JSON.stringify({
      '@context': {
        owl: 'http://www.w3.org/2002/07/owl#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      },
      '@graph': [
        {
          '@id': `${ns}Invoice`,
          '@type': 'owl:Class',
          'rdfs:label': 'Invoice',
        },
        {
          '@id': `${ns}Payment`,
          '@type': 'owl:Class',
          'rdfs:label': 'Payment',
        },
        {
          '@id': `${ns}Receipt`,
          '@type': 'owl:Class',
          'rdfs:label': 'Receipt',
          'rdfs:subClassOf': { '@id': `${ns}Payment` },
        },
      ],
    }),
  },
});

const createOntology = async (name: string) => {
  const api = await getWorkerAdminAPIContext();
  const ontology = await okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: { name, iri: `https://example.org/${name}`, namespace: NS(name) },
    }),
    'Create import review fixture'
  );

  return { api, ontology };
};

const conceptNames = async (
  api: Awaited<ReturnType<typeof getWorkerAdminAPIContext>>,
  ontology: Ontology
) => {
  const list = await okJson<{ data: OntologyConcept[] }>(
    await api.get('/api/v1/ontologyConcepts', {
      params: { ontology: ontology.fullyQualifiedName, limit: 100 },
    }),
    'List imported concepts'
  );

  return list.data.map(({ displayName, name }) => displayName ?? name).sort();
};

const seedDraft = async (
  ontology: Ontology,
  api: Awaited<ReturnType<typeof getWorkerAdminAPIContext>>
) => {
  for (const name of ['Invoice', 'Payment', 'Receipt']) {
    await okJson(
      await api.post('/api/v1/ontologyConcepts', {
        data: {
          name,
          displayName: name,
          iri: `${NS(ontology.name)}${name}`,
          ontology: ontology.fullyQualifiedName,
          conceptType: 'OWL_CLASS',
        },
      }),
      `Create seed concept ${name}`
    );
  }
};

const openImport = async (page: Page, ontology: Ontology) => {
  await page.goto(`/governance/ontology?ontology=${ontology.id}`);
  await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
  await page.getByTestId('ontology-import-export-trigger').click();
  await page.getByTestId('ontology-native-import-tab').click();
};

const chooseFile = (page: Page, name: string, content: string | Buffer) =>
  page
    .getByTestId('ontology-native-import-file')
    .locator('input[type="file"]')
    .setInputFiles({
      name,
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(content),
    });

const parseFile = async (page: Page, name: string, content: string) => {
  await chooseFile(page, name, content);
  await page.getByTestId('ontology-native-import-parse').click();
  await expect(page.getByTestId('ontology-native-import-items')).toBeVisible();
};

const applyImport = async (page: Page) => {
  const applied = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/ontologyChangeSets/') &&
      response.url().endsWith('/apply') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('ontology-native-import-apply').click();
  expect((await applied).ok()).toBeTruthy();
};

const itemRow = (page: Page, label: string) =>
  page
    .locator('[data-testid^="ontology-native-import-item-concept"]')
    .filter({ hasText: label });

const remove = (
  api: Awaited<ReturnType<typeof getWorkerAdminAPIContext>>,
  id: string
) =>
  deleteFixtureEntity(
    api,
    `/api/v1/ontologies/${id}?recursive=true&hardDelete=true`
  );

test.describe(
  'Native ontology import review',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('lists every item as New, then as Already exists on a second import', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await expect(
          page.getByTestId('ontology-native-import-group-CONCEPT')
        ).toContainText('Invoice');
        await expect(itemRow(page, 'Invoice')).toContainText('New');
        await applyImport(page);

        await page.getByTestId('ontology-import-export-trigger').click();
        await page.getByTestId('ontology-native-import-tab').click();
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await expect(itemRow(page, 'Invoice')).toContainText('Already exists');
        await expect(itemRow(page, 'Payment')).toContainText('Already exists');
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toBeDisabled();
        expect(await conceptNames(api, ontology)).toEqual([
          'Invoice',
          'Payment',
          'Receipt',
        ]);
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('imports only the items left ticked', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await itemRow(page, 'Payment')
          .locator('[data-testid^="ontology-native-import-item-check-"]')
          .click();
        await itemRow(page, 'Receipt')
          .locator('[data-testid^="ontology-native-import-item-check-"]')
          .click();
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 1 selected');
        await applyImport(page);

        expect(await conceptNames(api, ontology)).toEqual(['Invoice']);
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('unticking a concept also unticks the relationship that uses it and keeps it unticked', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);
      const link = page
        .getByTestId('ontology-native-import-group-RELATIONSHIP')
        .getByTestId(/^ontology-native-import-item-axiom:/);
      const linkCheck = link.getByRole('checkbox');

      try {
        await openImport(page, ontology);
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 4 selected');

        await itemRow(page, 'Payment')
          .locator('[data-testid^="ontology-native-import-item-check-"]')
          .click();

        await expect(
          page.getByTestId('ontology-native-import-unticked-notice')
        ).toHaveText('Also unticked 1 relationship that uses Payment');
        await expect(linkCheck).not.toBeChecked();
        await expect(linkCheck).toBeDisabled();
        await expect(link).toContainText('Needs Payment, which is not ticked');
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 2 selected');

        await itemRow(page, 'Payment')
          .locator('[data-testid^="ontology-native-import-item-check-"]')
          .click();

        await expect(
          page.getByTestId('ontology-native-import-unticked-notice')
        ).toBeHidden();
        await expect(linkCheck).not.toBeChecked();
        await expect(linkCheck).toBeEnabled();
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 3 selected');
        await applyImport(page);

        expect(await conceptNames(api, ontology)).toEqual([
          'Invoice',
          'Payment',
          'Receipt',
        ]);
        const axioms = await okJson<{
          data: { ontology?: { id: string } }[];
        }>(
          await api.get('/api/v1/ontologyAxioms', {
            params: { ontology: ontology.fullyQualifiedName, limit: 1000 },
          }),
          'List imported axioms'
        );

        expect(
          axioms.data.filter((axiom) => axiom.ontology?.id === ontology.id)
        ).toHaveLength(0);
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('a rule unticks with the concept it names', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'rules.ttl', RULES_TURTLE(NS(ontology.name)));

        await itemRow(page, 'Invoice')
          .locator('[data-testid^="ontology-native-import-item-check-"]')
          .click();

        await expect(
          page.getByTestId('ontology-native-import-unticked-notice')
        ).toHaveText('Also unticked 1 rule that uses Invoice');
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 2 selected');
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('skips and reports a datatype range it cannot hold, and imports the rest', async ({
      isolatedUserPage: page,
    }) => {
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(
          page,
          'dates.ttl',
          DATE_RANGE_TURTLE(NS(ontology.name))
        );

        const skipped = page.getByTestId('ontology-native-import-skipped');
        await expect(skipped).toContainText('Skipped statements: 1');
        await skipped.locator('summary').click();
        await expect(skipped).toContainText('Unsupported structure');
        await expect(skipped).toContainText('rdf-schema#range');
        await expect(skipped).toContainText(`${NS(ontology.name)}issuedOn`);

        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toHaveText('Import 2 selected');
        await applyImport(page);

        expect(await conceptNames(api, ontology)).toEqual(['Invoice']);
      } finally {
        await remove(api, ontology.id);
      }
    });

    for (const format of ['turtle', 'rdfxml', 'jsonld'] as const) {
      test(`imports a ${format} file into a new ontology`, async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        const { api, ontology } = await createOntology(`pw_review_${uuid()}`);
        const created: string[] = [];
        const file = FORMAT_FILES(NS('src'))[format];

        try {
          await openImport(page, ontology);
          await chooseFile(page, file.name, file.content);
          await expect(
            page.getByTestId('ontology-native-import-format')
          ).toHaveText(file.label);
          await page.getByTestId('ontology-native-import-target').click();
          await page.getByRole('option', { name: /new ontology/i }).click();
          await page.getByTestId('ontology-native-import-parse').click();
          await expect(itemRow(page, 'Invoice')).toContainText('New');

          const create = page.waitForResponse(
            (response) =>
              response.url().endsWith('/api/v1/ontologies') &&
              response.request().method() === 'POST'
          );
          await page.getByTestId('ontology-native-import-apply').click();
          const made = await okJson<Ontology>(
            await create,
            'Create imported ontology'
          );
          created.push(made.id);

          expect(made.iri).toMatch(/^https:\/\//);
          expect(made.name).toMatch(/^[a-z0-9-]+$/);
          await expect(page).toHaveURL(new RegExp(`ontology=${made.id}`));
          expect(await conceptNames(api, made)).toEqual([
            'Invoice',
            'Payment',
            'Receipt',
          ]);
        } finally {
          for (const id of created) {
            await remove(api, id);
          }
          await remove(api, ontology.id);
        }
      });
    }

    test('imports a CSV into a new ontology', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);
      const source = await createOntology(`pw_review_${uuid()}`);
      const created: string[] = [];

      try {
        await seedDraft(source.ontology, source.api);
        await okJson(
          await source.api.post('/api/v1/ontologyConcepts', {
            data: {
              name: 'Settlement',
              iri: `${NS(source.ontology.name)}c7f3a`,
              ontology: source.ontology.fullyQualifiedName,
              conceptType: 'OWL_CLASS',
            },
          }),
          'Create a concept without a display name'
        );
        const csv = await source.api.get(
          `/api/v1/ontologies/${source.ontology.id}/export`,
          { params: { format: 'csv' } }
        );
        expect(csv.ok()).toBeTruthy();
        expect(await csv.text()).toContain(
          `${NS(source.ontology.name)}c7f3a,Settlement,`
        );

        await openImport(page, ontology);
        await chooseFile(page, 'billing.csv', await csv.text());
        await expect(
          page.getByTestId('ontology-native-import-format')
        ).toHaveText('CSV');
        await page.getByTestId('ontology-native-import-target').click();
        await page.getByRole('option', { name: /new ontology/i }).click();
        await page.getByTestId('ontology-native-import-parse').click();
        await expect(itemRow(page, 'Invoice')).toContainText('New');
        await expect(itemRow(page, 'Receipt')).toContainText('New');
        await expect(itemRow(page, 'Settlement')).toContainText('New');

        const create = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/ontologies') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-native-import-apply').click();
        const made = await okJson<Ontology>(
          await create,
          'Create imported ontology'
        );
        created.push(made.id);

        expect(made.iri).toMatch(/^https:\/\//);
        await expect
          .poll(() => conceptNames(api, made))
          .toEqual(['Invoice', 'Payment', 'Receipt', 'Settlement']);
      } finally {
        for (const id of created) {
          await remove(api, id);
        }
        await remove(api, ontology.id);
        await remove(source.api, source.ontology.id);
      }
    });

    test('lists rules in their own group, counts them, and imports them when ticked', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'rules.ttl', RULES_TURTLE(NS(ontology.name)));

        const group = page.getByTestId('ontology-native-import-group-RULE');
        await expect(group).toContainText('Rules (1)');
        await expect(
          group.locator('[data-testid^="ontology-native-import-item-status-"]')
        ).toHaveText(['New']);
        await expect(
          page.getByTestId('ontology-native-import-items-found')
        ).toContainText('4 items found');
        await expect(
          page.getByTestId('ontology-native-import-selection-summary')
        ).toContainText('4 of 4 items selected');

        const check = group.getByTestId(
          'ontology-native-import-group-check-RULE'
        );
        await check.click();
        await expect(
          page.getByTestId('ontology-native-import-selection-summary')
        ).toContainText('3 of 4 items selected');
        await check.click();
        await applyImport(page);

        const axioms = await okJson<{ data: { axiomType: string }[] }>(
          await api.get('/api/v1/ontologyAxioms', {
            params: { ontology: ontology.fullyQualifiedName, limit: 100 },
          }),
          'List imported rules'
        );
        expect(axioms.data.map(({ axiomType }) => axiomType)).toContain(
          'DISJOINT_WITH'
        );
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('refuses a file that is not an ontology and one that is too large', async ({
      isolatedUserPage: page,
    }) => {
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await chooseFile(page, 'notes.ttl', 'this is not rdf at all');
        await page.getByTestId('ontology-native-import-parse').click();
        await expect(page.getByRole('alert')).toBeVisible();
        await expect(
          page.getByTestId('ontology-native-import-apply')
        ).toBeDisabled();

        await chooseFile(
          page,
          'huge.ttl',
          Buffer.alloc(10 * 1024 * 1024 + 1, 'a')
        );
        await expect(
          page.getByTestId('ontology-native-import-parse')
        ).toBeDisabled();
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('lists a disjointness clash on its rule and names both concepts', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_review_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'clash.ttl', CLASH_TURTLE(NS(ontology.name)));

        const group = page.getByTestId('ontology-native-import-group-RULE');
        await expect(group).toBeVisible();
        await expect(
          group
            .locator('[data-testid^="ontology-native-import-item-warning-"]')
            .filter({
              hasText: 'Receipt has disjoint ancestors Invoice and Payment',
            })
        ).not.toHaveCount(0);
      } finally {
        await remove(api, ontology.id);
      }
    });
  }
);

test.describe(
  'Native ontology draft export and round trip',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('previews the current draft in the chosen format and downloads it', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_draft_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await applyImport(page);

        await page.getByTestId('ontology-import-export-trigger').click();
        await expect(page.getByTestId('ontology-export-scope')).toContainText(
          'Current draft'
        );
        const preview = page.getByTestId('ontology-release-export-preview');
        await expect(preview).toContainText('Invoice');

        await page.getByTestId('ontology-release-format-skos').click();
        await expect(preview).toContainText('skos:');
        await page.getByTestId('ontology-release-format-csv').click();
        await expect(preview).toContainText('CONCEPT');
        await page.getByTestId('ontology-release-format-jsonld').click();
        await expect(preview).toContainText('@id');

        const download = page.waitForEvent('download');
        await page.getByTestId('ontology-run-release-export').click();
        expect((await download).suggestedFilename()).toMatch(/-draft\.jsonld$/);
      } finally {
        await remove(api, ontology.id);
      }
    });

    const ROUND_TRIP = {
      csv: { extension: 'csv', marker: 'Invoice' },
      jsonld: { extension: 'jsonld', marker: '@graph' },
      rdfxml: { extension: 'rdf', marker: 'rdf:RDF' },
      skos: { extension: 'ttl', marker: 'skos:' },
    } as const;

    for (const card of Object.keys(ROUND_TRIP) as (keyof typeof ROUND_TRIP)[]) {
      test(`a ${card} export of the draft imports again with the same concepts`, async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        const source = await createOntology(`pw_round_${uuid()}`);
        const target = await createOntology(`pw_round_${uuid()}`);

        try {
          await openImport(page, source.ontology);
          await parseFile(
            page,
            'billing.ttl',
            TURTLE(NS(source.ontology.name))
          );
          await applyImport(page);

          await page.getByTestId('ontology-import-export-trigger').click();
          await page.getByTestId(`ontology-release-format-${card}`).click();
          await expect(
            page.getByTestId('ontology-release-export-preview')
          ).toContainText(ROUND_TRIP[card].marker);
          const download = page.waitForEvent('download');
          await page.getByTestId('ontology-run-release-export').click();
          const path = await (await download).path();
          const exported = await readFile(path, 'utf8');

          await openImport(page, target.ontology);
          await chooseFile(
            page,
            `round.${ROUND_TRIP[card].extension}`,
            exported
          );
          await page.getByTestId('ontology-native-import-parse').click();
          await expect(itemRow(page, 'Invoice')).toContainText('New');
          await expect(itemRow(page, 'Receipt')).toContainText('New');
          await applyImport(page);

          expect(await conceptNames(source.api, target.ontology)).toEqual(
            await conceptNames(source.api, source.ontology)
          );
        } finally {
          await remove(source.api, source.ontology.id);
          await remove(target.api, target.ontology.id);
        }
      });
    }

    test('lists the draft and every release in the scope menu', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_scope_${uuid()}`);

      try {
        await seedDraft(ontology, api);
        const state = await okJson<{
          activationRevision: number;
          workingRevision: number;
          lastReleaseRevision: number;
        }>(
          await api.get(`/api/v1/ontologies/${ontology.id}/state`),
          'Read state'
        );
        await okJson(
          await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
            data: {
              expectedActivationRevision: state.activationRevision,
              expectedWorkingRevision: state.workingRevision,
              expectedLatestReleaseRevision: state.lastReleaseRevision,
              versionBump: 'major',
              releaseNotes: '',
            },
          }),
          'Capture release'
        );

        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await page.getByTestId('ontology-import-export-trigger').click();
        await page
          .getByTestId('ontology-export-scope')
          .getByRole('button')
          .click();
        await expect(
          page.getByRole('option', { name: /Current draft/ })
        ).toBeVisible();
        await expect(page.getByRole('option')).toHaveCount(2);
      } finally {
        await remove(api, ontology.id);
      }
    });
  }
);

test.describe(
  'Native ontology library install',
  { tag: ['@Features', '@Governance'] },
  () => {
    test('installs a pack into a new ontology with a readable name and https IRI, then into an existing one and refreshes Publish', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_lib_${uuid()}`);
      let installed: Ontology | undefined;

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
        await page.getByTestId('ontology-library-trigger').click();
        await page.getByTestId('ontology-pack-details-dcat').click();

        const created = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/v1/ontologies' &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-library-native-install').click();
        installed = await okJson<Ontology>(
          await created,
          'Install into a new ontology'
        );
        expect(installed.iri).toMatch(/^https:\/\//);
        expect(installed.name).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
        await expect(page.getByTestId('ontology-pack-dcat')).toContainText(
          'Installed'
        );
        await page.keyboard.press('Escape');

        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        const publish = page.getByTestId('ontology-publication-trigger');
        await expect(publish).toContainText('Publish (');
        const before = Number(
          /\((\d+)\)/.exec((await publish.textContent()) ?? '')?.[1]
        );
        await page.getByTestId('ontology-library-trigger').click();
        await page.getByTestId('ontology-pack-details-dcat').click();
        await selectOntologyOption(
          page,
          page.getByTestId('ontology-library-target'),
          ontology.name
        );
        await expect(
          page.getByTestId('ontology-library-pack-review')
        ).toContainText('New');
        const settled = waitForPackInstallJob(page, ontology.id);
        await page.getByTestId('ontology-library-native-install').click();
        expect((await settled).status).toBe(InstallJobStatus.Completed);
        await page.keyboard.press('Escape');

        // The 14 DCAT properties whose ranges sit outside the pack are skipped, not installed.
        await expect(publish).toHaveText(`Publish (${before + 48})`);
      } finally {
        await remove(api, ontology.id);
        if (installed) {
          await remove(api, installed.id);
        }
      }
    });

    test('a pack review lists its items as New and adds no clash to an ontology that already has one', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_packclash_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'clash.ttl', CLASH_TURTLE(NS(ontology.name)));
        await applyImport(page);
        await page.keyboard.press('Escape');
        await page.getByTestId('ontology-library-trigger').click();
        await page.getByTestId('ontology-pack-details-dcat').click();
        await selectOntologyOption(
          page,
          page.getByTestId('ontology-library-target'),
          ontology.name
        );

        const review = page.getByTestId('ontology-library-pack-review');
        await expect(review).toContainText('Dataset');
        const statuses = review.locator(
          '[data-testid^="ontology-native-import-item-status-"]'
        );
        await expect(statuses).toHaveCount(62);
        await expect(statuses.filter({ hasText: /^New$/ })).toHaveCount(48);
        await expect(statuses.filter({ hasText: /^Skipped$/ })).toHaveCount(14);
        await expect(
          review.locator(
            '[data-testid^="ontology-native-import-item-warning-"]'
          )
        ).toHaveCount(0);
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('a failed pack review shows an error, holds Install, and recovers on retry', async ({
      isolatedUserPage: page,
    }) => {
      const { api, ontology } = await createOntology(`pw_revfail_${uuid()}`);
      let failures = 1;

      try {
        await page.route('**/api/v1/ontologies/*/library/*/summary', (route) =>
          failures-- > 0
            ? route.fulfill({ status: 500, body: '{"message":"boom"}' })
            : route.continue()
        );
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
        await page.getByTestId('ontology-library-trigger').click();
        await page.getByTestId('ontology-pack-details-dcat').click();
        await selectOntologyOption(
          page,
          page.getByTestId('ontology-library-target'),
          ontology.name
        );

        await expect(
          page.getByTestId('ontology-library-pack-review-error')
        ).toBeVisible();
        await expect(
          page.getByTestId('ontology-library-native-install')
        ).toBeDisabled();

        await page.getByTestId('ontology-library-pack-review-retry').click();

        await expect(
          page.getByTestId('ontology-library-pack-review')
        ).toBeVisible();
        await expect(
          page.getByTestId('ontology-library-native-install')
        ).toBeEnabled();
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('choosing an existing ontology as the target keeps the selected modules', async ({
      isolatedUserPage: page,
    }) => {
      const { api, ontology } = await createOntology(`pw_mods_${uuid()}`);
      const modules = page.locator('[data-testid^="ontology-module-"]');
      const checkedModules = async () =>
        Promise.all(
          (await modules.all()).map(async (module) => [
            await module.getAttribute('data-testid'),
            await module.getByRole('checkbox').isChecked(),
          ])
        );

      try {
        await page.goto(`/governance/ontology?ontology=${ontology.id}`);
        await expect(page.getByTestId('ontology-studio-shell')).toBeVisible();
        await page.getByTestId('ontology-library-trigger').click();
        await page.getByTestId('ontology-pack-details-sosa-ssn').click();
        await expect.poll(() => modules.count()).toBeGreaterThan(1);
        await page.getByTestId('ontology-module-ssn').click();
        const initial = await checkedModules();

        expect(initial).toEqual([
          ['ontology-module-sosa', true],
          ['ontology-module-ssn', false],
        ]);

        await selectOntologyOption(
          page,
          page.getByTestId('ontology-library-target'),
          ontology.name
        );
        await expect(
          page.getByTestId('ontology-library-pack-review')
        ).toBeVisible();

        expect(await checkedModules()).toEqual(initial);
      } finally {
        await remove(api, ontology.id);
      }
    });

    test('exports a release from its row in SKOS', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const { api, ontology } = await createOntology(`pw_row_${uuid()}`);

      try {
        await openImport(page, ontology);
        await parseFile(page, 'billing.ttl', TURTLE(NS(ontology.name)));
        await applyImport(page);
        await page.getByTestId('ontology-publication-trigger').click();
        const captured = page.waitForResponse(
          (response) =>
            response
              .url()
              .endsWith(`/api/v1/ontologies/${ontology.id}/releases`) &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('ontology-capture-release').click();
        const release = await okJson<{ id: string }>(
          await captured,
          'Capture release'
        );

        const row = page.getByTestId(`ontology-release-export-${release.id}`);
        await row.click();
        const download = page.waitForEvent('download');
        await page.getByRole('menuitem', { name: /SKOS/ }).click();
        expect((await download).suggestedFilename()).toMatch(/\.ttl$/);
      } finally {
        await remove(api, ontology.id);
      }
    });
  }
);
