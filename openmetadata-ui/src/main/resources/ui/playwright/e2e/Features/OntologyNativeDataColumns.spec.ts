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
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

const APP_MODES = ['classic', 'ai'] as const;
const CAP = 5;
const WIDE_COLUMN_COUNT = 7;
const NARROW_VIEWPORT = { width: 1280, height: 800 };

test.use({ isolatedUserOptions: { isAdmin: true } });

const createOntology = async (api: APIRequestContext) => {
  const name = `pw_cols_${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        displayName: 'Column nodes',
        iri: `urn:${name}`,
        namespace: `urn:${name}:`,
      },
    }),
    'Create column nodes ontology'
  );
};

const createConcept = async (api: APIRequestContext, ontology: Ontology) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name: 'Prescription',
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    'Create Prescription'
  );

const createProperty = async (
  api: APIRequestContext,
  ontology: Ontology,
  concept: OntologyConcept,
  name: string
) =>
  okJson<OntologyProperty>(
    await api.post('/api/v1/ontologyProperties', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        iri: `${ontology.namespace}${name}`,
        kind: 'DATA',
        domain: [concept.iri],
        range: ['http://www.w3.org/2001/XMLSchema#string'],
      },
    }),
    `Create ${name}`
  );

const bindColumns = (
  api: APIRequestContext,
  concept: OntologyConcept,
  assetId: string,
  columns: Array<{ property: OntologyProperty; column: string }>
) =>
  api
    .put(`/api/v1/ontologyConcepts/${concept.id}/bindings`, {
      data: {
        expectedRevision: 0,
        asset: {
          assetType: 'table',
          assetId,
          columns: columns.map(({ property, column }) => ({
            propertyId: property.id,
            columnPath: [column],
          })),
        },
      },
    })
    .then((response) =>
      okJson<OntologyConceptBindingsResponse>(response, 'Bind columns')
    );

const setMode = async (page: Page, mode: (typeof APP_MODES)[number]) => {
  if (mode === 'ai') {
    await enableAiAppMode(page);
  } else {
    await disableAiAppMode(page);
  }
};

const openData = async (
  page: Page,
  ontology: Ontology,
  concept: OntologyConcept
) => {
  await page.goto(
    `/governance/ontology?ontology=${ontology.id}&concept=${concept.id}`
  );
  await page.getByTestId('ontology-graph-mode-data').click();
};

const cleanUp = async (
  api: APIRequestContext,
  ontology: Ontology,
  tables: TableClass[]
) => {
  await deleteFixtureEntity(
    api,
    `/api/v1/ontologies/${ontology.id}?recursive=true&hardDelete=true`
  );
  for (const table of tables) {
    await table.delete(api);
  }
};

const columnNodes = (page: Page) =>
  page
    .getByTestId('ontology-native-data-graph')
    .getByTestId('ontology-data-column');
const columnEdges = (page: Page) =>
  page
    .getByTestId('ontology-native-data-graph')
    .getByTestId('ontology-data-column-edge');
const columnNode = (page: Page, column: string) =>
  columnNodes(page).filter({ hasText: column });
const columnEdge = (page: Page, column: string) =>
  page
    .getByTestId('ontology-native-data-graph')
    .locator(
      `[data-testid="ontology-data-column-edge"][data-column="${column}"]`
    );
const openColumns = (page: Page) =>
  page.getByTestId(/^ontology-data-asset-columns-toggle-/);

const expectClearOfPanel = async (
  page: Page,
  panel: Locator,
  columns: string[]
) => {
  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();
  for (const column of columns) {
    const box = await columnNode(page, column).boundingBox();
    expect(box, `${column} has a box`).not.toBeNull();
    expect(
      (box?.x ?? 0) + (box?.width ?? 0),
      `${column} ends left of the panel`
    ).toBeLessThanOrEqual(panelBox?.x ?? 0);
    expect(box?.x ?? -1, `${column} starts on screen`).toBeGreaterThanOrEqual(
      0
    );
  }
};

test.describe(
  'Native ontology Data mode column nodes',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of APP_MODES) {
      test(`${mode}: each bound column is a node with an edge to its table, and selecting one shows its binding`, async ({
        isolatedUserPage: page,
      }) => {
        const api = await getWorkerAdminAPIContext();
        const ontology = await createOntology(api);
        const table = new TableClass({ name: `pw_cols_${uuid()}` });
        await table.create(api);
        try {
          const concept = await createConcept(api, ontology);
          const [first, second] = (table.entityResponseData.columns ?? []).map(
            (column) => column.name
          );
          const rx = await createProperty(api, ontology, concept, 'rxNumber');
          const dose = await createProperty(api, ontology, concept, 'doseMg');
          await bindColumns(api, concept, table.entityResponseData.id ?? '', [
            { property: rx, column: first },
            { property: dose, column: second },
          ]);
          await setMode(page, mode);
          await openData(page, ontology, concept);

          await expect(columnNodes(page)).toHaveCount(0);
          await expect(
            page.getByTestId('ontology-data-legend-column-binding')
          ).toContainText('Column binding');
          await openColumns(page).click();

          await expect(columnNodes(page)).toHaveCount(2);
          await expect(columnNode(page, first)).toContainText(first);
          await expect(columnNode(page, second)).toContainText(second);
          await expect(columnEdges(page)).toHaveCount(2);
          await expect(columnEdge(page, first)).toHaveCount(1);
          await expect(columnEdge(page, second)).toHaveCount(1);

          await columnNode(page, first).focus();
          await page.keyboard.press('Enter');

          const panel = page.getByTestId('ontology-data-column-panel');

          await expect(panel).toBeVisible();
          await expect(
            panel.getByTestId('ontology-data-column-panel-column')
          ).toContainText(first);
          await expect(
            panel.getByTestId('ontology-data-column-panel-property')
          ).toHaveText('rxNumber');
          await expect(
            panel.getByTestId('ontology-data-column-panel-asset')
          ).toContainText(
            table.entityResponseData.displayName ??
              table.entityResponseData.name ??
              ''
          );
          await expect(columnNode(page, first)).toHaveAttribute(
            'aria-pressed',
            'true'
          );

          await columnNode(page, second).click();

          await expect(
            panel.getByTestId('ontology-data-column-panel-column')
          ).toContainText(second);
          await expect(
            panel.getByTestId('ontology-data-column-panel-property')
          ).toHaveText('doseMg');
          await expect(columnNode(page, first)).toHaveAttribute(
            'aria-pressed',
            'false'
          );

          await panel
            .getByTestId('ontology-data-column-panel-asset-detail')
            .click();

          await expect(panel).toBeHidden();
          await expect(
            page.getByTestId('ontology-data-asset-panel')
          ).toBeVisible();

          await page.getByTestId('ontology-data-asset-panel-close').click();
          await openColumns(page).click();

          await expect(columnNodes(page)).toHaveCount(0);
          await expect(columnEdges(page)).toHaveCount(0);
        } finally {
          await cleanUp(api, ontology, [table]);
        }
      });
    }

    for (const mode of APP_MODES) {
      test(`${mode}: at 1280 by 800 the panel stays clear of the selected column and its siblings`, async ({
        isolatedUserPage: page,
      }) => {
        await page.setViewportSize(NARROW_VIEWPORT);
        const api = await getWorkerAdminAPIContext();
        const ontology = await createOntology(api);
        const table = new TableClass({ name: `pw_cols_${uuid()}` });
        await table.create(api);
        try {
          const concept = await createConcept(api, ontology);
          const [first, second, third] = (
            table.entityResponseData.columns ?? []
          ).map((column) => column.name);
          const properties = await Promise.all(
            ['rxNumber', 'doseMg', 'refills'].map((name) =>
              createProperty(api, ontology, concept, name)
            )
          );
          await bindColumns(
            api,
            concept,
            table.entityResponseData.id ?? '',
            [first, second, third].map((column, index) => ({
              property: properties[index],
              column,
            }))
          );
          await setMode(page, mode);
          await openData(page, ontology, concept);
          await openColumns(page).click();
          await expect(columnNodes(page)).toHaveCount(3);

          await columnNode(page, first).click();

          const panel = page.getByTestId('ontology-data-column-panel');

          await expect(panel).toBeVisible();
          await expectClearOfPanel(page, panel, [first, second, third]);

          await columnNode(page, second).click();

          await expect(
            panel.getByTestId('ontology-data-column-panel-column')
          ).toContainText(second);
          await expectClearOfPanel(page, panel, [first, second, third]);

          await columnNode(page, third).click();

          await expect(
            panel.getByTestId('ontology-data-column-panel-column')
          ).toContainText(third);
        } finally {
          await cleanUp(api, ontology, [table]);
        }
      });

      test(`${mode}: at 1280 by 800 the asset panel stays clear of the column lane`, async ({
        isolatedUserPage: page,
      }) => {
        await page.setViewportSize(NARROW_VIEWPORT);
        const api = await getWorkerAdminAPIContext();
        const ontology = await createOntology(api);
        const table = new TableClass({ name: `pw_cols_${uuid()}` });
        await table.create(api);
        try {
          const concept = await createConcept(api, ontology);
          const [first, second, third] = (
            table.entityResponseData.columns ?? []
          ).map((column) => column.name);
          const properties = await Promise.all(
            ['rxNumber', 'doseMg', 'refills'].map((name) =>
              createProperty(api, ontology, concept, name)
            )
          );
          await bindColumns(
            api,
            concept,
            table.entityResponseData.id ?? '',
            [first, second, third].map((column, index) => ({
              property: properties[index],
              column,
            }))
          );
          await setMode(page, mode);
          await openData(page, ontology, concept);
          await openColumns(page).click();
          await expect(columnNodes(page)).toHaveCount(3);

          await page
            .locator(
              `[data-testid^="ontology-data-asset-asset:"][data-testid$="${table.entityResponseData.id}"]`
            )
            .click();

          const panel = page.getByTestId('ontology-data-asset-panel');

          await expect(panel).toBeVisible();
          await expectClearOfPanel(page, panel, [first, second, third]);

          await columnNode(page, second).click();

          await expect(
            page
              .getByTestId('ontology-data-column-panel')
              .getByTestId('ontology-data-column-panel-column')
          ).toContainText(second);
        } finally {
          await cleanUp(api, ontology, [table]);
        }
      });
    }

    test('a table with more bound columns than the cap draws five and expands the rest from +N more', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      const anchor = new TableClass({ name: `pw_cols_anchor_${uuid()}` });
      await anchor.create(api);
      let wideId = '';
      try {
        const columnNames = Array.from(
          { length: WIDE_COLUMN_COUNT },
          (_, index) => `rx_col_${index}`
        );
        const wide = await okJson<{ id: string }>(
          await api.post('/api/v1/tables', {
            data: {
              name: `pw_cols_wide_${uuid()}`,
              databaseSchema:
                anchor.schemaResponseData.fullyQualifiedName ?? '',
              columns: columnNames.map((name) => ({
                name,
                dataType: 'VARCHAR',
                dataLength: 32,
              })),
            },
          }),
          'Create a wide table'
        );
        wideId = wide.id;
        const concept = await createConcept(api, ontology);
        const properties = await Promise.all(
          columnNames.map((name) =>
            createProperty(api, ontology, concept, `prop_${name}`)
          )
        );
        await bindColumns(
          api,
          concept,
          wide.id,
          columnNames.map((column, index) => ({
            property: properties[index],
            column,
          }))
        );
        await openData(page, ontology, concept);
        await openColumns(page).click();

        await expect(columnNodes(page)).toHaveCount(CAP);
        await expect(columnEdges(page)).toHaveCount(CAP);

        const more = page.getByTestId(/^ontology-data-column-more-/);

        await expect(more).toContainText(`${WIDE_COLUMN_COUNT - CAP} more`);
        await more.click();

        await expect(columnNodes(page)).toHaveCount(WIDE_COLUMN_COUNT);
        await expect(columnEdges(page)).toHaveCount(WIDE_COLUMN_COUNT);

        await page.getByTestId(/^ontology-data-column-fewer-/).click();

        await expect(columnNodes(page)).toHaveCount(CAP);
      } finally {
        if (wideId) {
          await deleteFixtureEntity(
            api,
            `/api/v1/tables/${wideId}?hardDelete=true`
          );
        }
        await cleanUp(api, ontology, [anchor]);
      }
    });
  }
);
