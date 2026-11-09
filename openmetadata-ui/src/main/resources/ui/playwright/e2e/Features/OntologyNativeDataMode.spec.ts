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
import { APIRequestContext, Page } from '@playwright/test';
import { Ontology } from '../../../src/generated/entity/data/ontology';
import { OntologyConcept } from '../../../src/generated/entity/data/ontologyConcept';
import { OntologyProperty } from '../../../src/generated/entity/data/ontologyProperty';
import { OntologyRelease } from '../../../src/generated/entity/data/ontologyRelease';
import { DataType } from '../../../src/generated/entity/data/table';
import { Task } from '../../../src/generated/entity/tasks/task';
import { OntologyAssetConceptLinks } from '../../../src/generated/type/ontologyAssetConceptLinks';
import { OntologyConceptBindingsResponse } from '../../../src/generated/type/ontologyConceptBindingsResponse';
import { OntologyState } from '../../../src/generated/type/ontologyState';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/isolatedUser';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { getWorkerAdminAPIContext, uuid } from '../../utils/common';
import { selectOntologyOption } from '../../utils/ontologyStudio';
import { disableAiAppMode, enableAiAppMode } from '../Utils/appMode';

const MANY_ASSETS = 100;
const CREATE_BATCH = 10;
const GRAPH_RENDER_BUDGET_MS = 2_000;
const SCREENSHOTS = 'test-results/g17';
const APP_MODES = ['classic', 'ai'] as const;

test.use({ isolatedUserOptions: { isAdmin: true } });

interface Fixture {
  ontology: Ontology;
  tables: TableClass[];
}

const createOntology = async (api: APIRequestContext, reviewerId?: string) => {
  const name = `pw_g17_${uuid()}`;

  return okJson<Ontology>(
    await api.post('/api/v1/ontologies', {
      data: {
        name,
        displayName: 'LC Clinical',
        iri: `urn:${name}`,
        namespace: `urn:${name}:`,
        ...(reviewerId
          ? { reviewers: [{ id: reviewerId, type: 'user' }] }
          : {}),
      },
    }),
    'Create Data mode ontology'
  );
};

/** A reader sees an ontology only once a release is active, so publish one first. */
const publish = async (
  api: APIRequestContext,
  reviewerPage: Page,
  ontology: Ontology
) => {
  const state = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology revision'
  );
  const release = await okJson<OntologyRelease>(
    await api.post(`/api/v1/ontologies/${ontology.id}/releases`, {
      data: { expectedWorkingRevision: state.workingRevision },
    }),
    'Capture release'
  );
  const task = await okJson<Task>(
    await api.post('/api/v1/tasks', {
      data: {
        name: `Review ${release.fullyQualifiedName}`,
        category: 'Approval',
        type: 'RequestApproval',
        about: `<#E::ontologyRelease::${release.fullyQualifiedName}>`,
      },
    }),
    'Submit release review'
  );
  await expect
    .poll(async () => {
      const ready = await okJson<Task>(
        await api.get(`/api/v1/tasks/${task.id}`),
        'Read release review'
      );

      return ready.availableTransitions?.length;
    })
    .toBe(2);
  await reviewerPage.goto(`/tasks/${task.id}`);
  await reviewerPage.getByTestId('task-approve').click();
  await expect(reviewerPage.getByTestId('task-approve')).toBeHidden();
  const activated = await okJson<OntologyState>(
    await api.get(`/api/v1/ontologies/${ontology.id}/state`),
    'Read ontology state'
  );
  await okJson<OntologyState>(
    await api.put(`/api/v1/ontologies/${ontology.id}/activation`, {
      data: {
        releaseId: release.id,
        expectedActivationRevision: activated.activationRevision,
      },
    }),
    'Activate release'
  );

  return task.id;
};

const createConcept = async (
  api: APIRequestContext,
  ontology: Ontology,
  name: string
) =>
  okJson<OntologyConcept>(
    await api.post('/api/v1/ontologyConcepts', {
      data: {
        name,
        ontology: ontology.fullyQualifiedName,
        conceptType: 'OWL_CLASS',
      },
    }),
    `Create ${name}`
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

const createTables = async (
  api: APIRequestContext,
  count: number,
  prefix = 'pw_data_mode'
) => {
  const tables: TableClass[] = [];
  for (let start = 0; start < count; start += CREATE_BATCH) {
    const batch = Array.from(
      { length: Math.min(CREATE_BATCH, count - start) },
      () => new TableClass({ name: `${prefix}_${uuid()}` })
    );
    await Promise.all(batch.map((table) => table.create(api)));
    tables.push(...batch);
  }

  return tables;
};

const bindTable = async (
  api: APIRequestContext,
  concept: OntologyConcept,
  table: TableClass,
  revision: number,
  columns: Array<{ property: OntologyProperty; column: string }> = []
) =>
  okJson<OntologyConceptBindingsResponse>(
    await api.put(`/api/v1/ontologyConcepts/${concept.id}/bindings`, {
      data: {
        expectedRevision: revision,
        asset: {
          assetType: 'table',
          assetId: table.entityResponseData.id,
          columns: columns.map(({ property, column }) => ({
            propertyId: property.id,
            columnPath: [column],
          })),
        },
      },
    }),
    `Bind a table to ${concept.name}`
  );

const bindTables = async (
  api: APIRequestContext,
  concept: OntologyConcept,
  tables: TableClass[]
) => {
  let revision = 0;
  for (const table of tables) {
    revision = (await bindTable(api, concept, table, revision)).revision;
  }
};

const cleanUp = async (api: APIRequestContext, fixture: Fixture) => {
  await deleteFixtureEntity(
    api,
    `/api/v1/ontologies/${fixture.ontology.id}?recursive=true&hardDelete=true`
  );
  for (const table of fixture.tables) {
    await table.delete(api);
  }
};

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
  concept?: OntologyConcept
) => {
  await page.goto(
    `/governance/ontology?ontology=${ontology.id}${
      concept ? `&concept=${concept.id}` : ''
    }`
  );
  await page.getByTestId('ontology-graph-mode-data').click();
};

const assetRow = (page: Page, table: TableClass) =>
  page
    .getByTestId('ontology-native-data-graph')
    .locator(
      `[data-testid^="ontology-data-asset-asset:"][data-testid$="${table.entityResponseData.id}"]`
    );

const labelOf = (table: TableClass) =>
  table.entityResponseData.displayName ?? table.entityResponseData.name;

const readBindings = async (api: APIRequestContext, concept: OntologyConcept) =>
  okJson<OntologyConceptBindingsResponse>(
    await api.get(`/api/v1/ontologyConcepts/${concept.id}/bindings`),
    `Read ${concept.name} bindings`
  );

test.describe(
  'Native ontology Data mode',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of APP_MODES) {
      test(`${mode}: a clicked asset opens a panel inside Studio and Open asset is a separate action`, async ({
        isolatedUserPage: page,
      }) => {
        const api = await getWorkerAdminAPIContext();
        const ontology = await createOntology(api);
        const [table] = await createTables(api, 1, 'prescriptions');
        const fixture = { ontology, tables: [table] };
        try {
          const concept = await createConcept(api, ontology, 'Prescription');
          const property = await createProperty(
            api,
            ontology,
            concept,
            'rxNumber'
          );
          await bindTable(api, concept, table, 0, [
            {
              property,
              column: table.entityResponseData.columns?.[0].name ?? '',
            },
          ]);
          await setMode(page, mode);
          await openData(page, ontology, concept);

          const chipBox = await page
            .getByTestId('ontology-data-concept-chip')
            .boundingBox();
          const headerBox = await page
            .getByTestId(`ontology-data-cluster-${concept.id}`)
            .boundingBox();

          expect(chipBox).not.toBeNull();
          expect(headerBox).not.toBeNull();
          // The chip must sit wholly above, or wholly beside, the card header.
          expect(
            (chipBox?.y ?? 0) + (chipBox?.height ?? 0) <= (headerBox?.y ?? 0) ||
              (chipBox?.x ?? 0) + (chipBox?.width ?? 0) <= (headerBox?.x ?? 0)
          ).toBe(true);

          await assetRow(page, table).click();
          const panel = page.getByTestId('ontology-data-asset-panel');

          await expect(panel).toBeVisible();
          await expect(page).toHaveURL(/\/governance\/ontology/);
          await expect(
            panel.getByTestId('ontology-data-asset-panel-name')
          ).toContainText(labelOf(table));
          await expect(
            panel.getByTestId('ontology-data-asset-panel-columns')
          ).toContainText(table.entityResponseData.columns?.[0].name ?? '');
          await page.screenshot({
            path: `${SCREENSHOTS}/g17-panel-${mode}.png`,
          });

          await panel.getByTestId('ontology-data-asset-open').click();
          await expect(page).toHaveURL(
            new RegExp(`/table/${table.entityResponseData.fullyQualifiedName}`)
          );
        } finally {
          await cleanUp(api, fixture);
        }
      });
    }

    test('picking each concept in turn draws that concept and its assets only', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      const tables = await createTables(api, 2);
      try {
        const customer = await createConcept(api, ontology, 'Customer');
        const order = await createConcept(api, ontology, 'Order');
        await bindTable(api, customer, tables[0], 0);
        await bindTable(api, order, tables[1], 0);
        await openData(page, ontology);

        await expect(page.getByTestId('ontology-data-no-pick')).toBeVisible();
        for (const [concept, shown, hidden] of [
          [customer, tables[0], tables[1]],
          [order, tables[1], tables[0]],
        ] as const) {
          if (concept !== customer) {
            await page.getByTestId('ontology-data-concept-change').click();
          }
          await page
            .getByTestId(`ontology-data-concept-option-${concept.id}`)
            .click();

          await expect(assetRow(page, shown)).toBeVisible();
          await expect(assetRow(page, hidden)).toHaveCount(0);
          await expect(
            page.getByTestId('ontology-data-concept-chip')
          ).toContainText(concept.name);
          // Choosing a concept opens its inspector; the picker must be reopened after that settles.
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText(concept.name);
        }
        await page.screenshot({ path: `${SCREENSHOTS}/g17-picker.png` });
      } finally {
        await cleanUp(api, { ontology, tables });
      }
    });

    test('a concept with no assets explains itself and offers Link Asset', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      try {
        const concept = await createConcept(api, ontology, 'Lonely');
        await openData(page, ontology, concept);

        const empty = page.getByTestId('ontology-data-empty');

        await expect(empty).toContainText('No data linked to Lonely yet');
        await expect(
          empty.getByTestId('ontology-data-link-asset')
        ).toBeVisible();
        await expect(page.getByText(/0 of 0 properties bound/)).toHaveCount(0);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-empty.png` });
      } finally {
        await cleanUp(api, { ontology, tables: [] });
      }
    });

    test('linking a table from the picker and binding a column updates the graph and the API', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      const [table] = await createTables(api, 1);
      try {
        const concept = await createConcept(api, ontology, 'Customer');
        const property = await createProperty(api, ontology, concept, 'custId');
        await openData(page, ontology, concept);

        await page.getByTestId('ontology-data-link-asset').click();
        const picker = page.getByTestId('ontology-data-asset-picker');
        await picker
          .getByTestId('ontology-data-asset-search')
          .locator('input')
          .fill(table.entityResponseData.name);
        const option = picker.getByTestId(
          `ontology-data-asset-option-${table.entityResponseData.id}`
        );
        await expect(option).toBeVisible({ timeout: 30_000 });
        await option.click();
        await picker.getByTestId('ontology-data-asset-save').click();

        await expect(assetRow(page, table)).toBeVisible();
        const linked = await readBindings(api, concept);

        expect(linked.assets.map((asset) => asset.assetId)).toEqual([
          table.entityResponseData.id,
        ]);

        const column = table.entityResponseData.columns?.[0].name ?? '';
        await bindTable(api, concept, table, linked.revision, [
          { property, column },
        ]);
        await page.reload();
        await page.getByTestId('ontology-graph-mode-data').click();

        const toggle = page.getByTestId(/^ontology-data-asset-columns-toggle-/);
        await toggle.click();
        await expect(page.getByTestId('ontology-data-column')).toContainText(
          column
        );
        expect(
          (await readBindings(api, concept)).assets[0].columns[0].columnPath
        ).toEqual([column]);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-link.png` });
      } finally {
        await cleanUp(api, { ontology, tables: [table] });
      }
    });

    test('the link picker suggests assets with a reason and narrows by service', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      // Own services, because tables otherwise share one service per worker.
      const match = new TableClass({
        name: `prescription_orders_${uuid()}`,
        service: new DatabaseServiceClass(),
      });
      const other = new TableClass({
        name: `inventory_items_${uuid()}`,
        service: new DatabaseServiceClass(),
      });
      await match.create(api);
      await other.create(api);
      try {
        const concept = await createConcept(api, ontology, 'Prescription');
        await openData(page, ontology, concept);
        await page.getByTestId('ontology-data-link-asset').click();
        const picker = page.getByTestId('ontology-data-asset-picker');
        const matchId = match.entityResponseData.id;

        await expect(
          picker.getByTestId('ontology-data-asset-suggested-heading')
        ).toBeVisible({ timeout: 30_000 });
        await expect(
          picker.getByTestId(`ontology-data-asset-reason-${matchId}`)
        ).not.toBeEmpty();

        await picker
          .getByTestId('ontology-data-asset-search')
          .locator('input')
          .fill('inventory');
        await expect(
          picker.getByTestId(
            `ontology-data-asset-option-${other.entityResponseData.id}`
          )
        ).toBeVisible({ timeout: 30_000 });
        await expect(
          picker.getByTestId(`ontology-data-asset-option-${matchId}`)
        ).toHaveCount(0);

        await picker
          .getByTestId('ontology-data-asset-search')
          .locator('input')
          .fill('');
        await picker.getByTestId('ontology-data-asset-service-filter').click();
        await page
          .getByRole('option', {
            name: match.serviceResponseData.name,
            exact: true,
          })
          .click();
        await expect(
          picker.getByTestId(`ontology-data-asset-option-${matchId}`)
        ).toBeVisible();
        await expect(
          picker.getByTestId(
            `ontology-data-asset-option-${other.entityResponseData.id}`
          )
        ).toHaveCount(0);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-suggest.png` });
      } finally {
        await cleanUp(api, { ontology, tables: [match, other] });
      }
    });

    test('unlinking an asset with bound columns names both and Undo restores the binding', async ({
      isolatedUserPage: page,
    }) => {
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      const [table] = await createTables(api, 1);
      try {
        const concept = await createConcept(api, ontology, 'Customer');
        const property = await createProperty(api, ontology, concept, 'custId');
        const column = table.entityResponseData.columns?.[0].name ?? '';
        await bindTable(api, concept, table, 0, [{ property, column }]);
        await openData(page, ontology, concept);

        await assetRow(page, table).click();
        await page.getByTestId('ontology-data-asset-unlink').click();

        await expect(page.getByTestId('ontology-unlink-title')).toContainText(
          `${labelOf(table)} from Customer`
        );
        await expect(
          page.getByTestId('ontology-unlink-description')
        ).toContainText(column);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-unlink.png` });
        await page.getByTestId('ontology-unlink-confirm').click();

        await expect(assetRow(page, table)).toHaveCount(0);
        expect((await readBindings(api, concept)).assets).toEqual([]);

        await page.getByTestId('ontology-undo').click();

        await expect
          .poll(async () => {
            const restored = (await readBindings(api, concept)).assets;

            return restored.map((asset) => asset.columns.length);
          })
          .toEqual([1]);
      } finally {
        await cleanUp(api, { ontology, tables: [table] });
      }
    });

    for (const mode of APP_MODES) {
      test(`${mode}: the table page lists the linked concept, per column, and links back to Studio`, async ({
        isolatedUserPage: page,
      }) => {
        const api = await getWorkerAdminAPIContext();
        const ontology = await createOntology(api);
        const [table] = await createTables(api, 1, 'prescriptions');
        try {
          const concept = await createConcept(api, ontology, 'Prescription');
          const property = await createProperty(
            api,
            ontology,
            concept,
            'rxNumber'
          );
          const column = table.entityResponseData.columns?.[0];
          await bindTable(api, concept, table, 0, [
            { property, column: column?.name ?? '' },
          ]);
          await setMode(page, mode);

          const links = page.waitForResponse((response) =>
            response
              .url()
              .includes(
                `/api/v1/ontologyConcepts/boundTo/table/${table.entityResponseData.id}`
              )
          );
          await page.goto(
            `/table/${table.entityResponseData.fullyQualifiedName}`
          );
          const response = await links;
          const startedAt = Date.now();
          const probe = await api.get(
            `/api/v1/ontologyConcepts/boundTo/table/${table.entityResponseData.id}`
          );
          expect(probe.ok()).toBe(true);
          test.info().annotations.push({
            type: 'perf-bound-to-ms',
            description: String(Date.now() - startedAt),
          });
          const section = page.getByTestId('table-linked-concepts');

          expect(
            ((await response.json()) as OntologyAssetConceptLinks).links
          ).toHaveLength(1);
          await expect(
            section.getByTestId('table-linked-concept-link')
          ).toHaveText('Prescription');
          await expect(
            section.getByTestId('table-linked-concept-column')
          ).toContainText(column?.name ?? '');
          await page.screenshot({
            path: `${SCREENSHOTS}/g17-table-trace-${mode}.png`,
          });

          await page.goto(`/table/${column?.fullyQualifiedName ?? ''}`);
          await expect(page.getByTestId('table-linked-concepts')).toBeVisible();

          // useFqnDeepLink opens the column drawer in an effect once the columns
          // load, after the concepts section is already visible, in both modes.
          const drawer = page.locator('.column-detail-panel');
          await expect(drawer).toBeVisible();
          await drawer.getByTestId('close-button').click();
          await expect(drawer).toBeHidden();
          await section.getByTestId('table-linked-concept-link').click();
          await expect(page).toHaveURL(
            new RegExp(
              `/governance/ontology\\?ontology=${ontology.id}&concept=${concept.id}`
            )
          );
          await expect(
            page.getByTestId('ontology-concept-inspector')
          ).toContainText('Prescription');
        } finally {
          await cleanUp(api, { ontology, tables: [table] });
        }
      });
    }

    test('a 100-asset concept renders within budget and Load more reaches the rest', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api);
      const tables = await createTables(api, MANY_ASSETS);
      try {
        const concept = await createConcept(api, ontology, 'Customer');
        await bindTables(api, concept, tables);
        await openData(page, ontology);
        await page.getByTestId('ontology-data-concept-picker').click();

        const startedAt = Date.now();
        await page
          .getByTestId(`ontology-data-concept-option-${concept.id}`)
          .click();
        const cluster = page.getByTestId(`ontology-data-cluster-${concept.id}`);
        await expect(
          cluster.getByTestId('ontology-data-cluster-count')
        ).toContainText(String(MANY_ASSETS));
        const renderedMs = Date.now() - startedAt;
        test.info().annotations.push({
          type: 'perf-data-graph-ms',
          description: String(renderedMs),
        });
        expect(renderedMs).toBeLessThan(GRAPH_RENDER_BUDGET_MS);

        const rows = cluster.getByTestId(/^ontology-data-asset-asset:/);
        const before = await rows.count();
        await cluster
          .getByTestId(`ontology-load-more-assets-${concept.id}`)
          .click();
        await expect.poll(() => rows.count()).toBeGreaterThan(before);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-many.png` });
      } finally {
        await cleanUp(api, { ontology, tables });
      }
    });

    test('a DataConsumer reads Data mode but sees no write action', async ({
      isolatedUserPage: reviewerPage,
      isolatedUser: reviewer,
      freshUserPage: { page },
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const ontology = await createOntology(api, reviewer.responseData.id);
      const [table] = await createTables(api, 1);
      let taskId: string | undefined;
      try {
        const concept = await createConcept(api, ontology, 'Customer');
        const empty = await createConcept(api, ontology, 'Lonely');
        await bindTable(api, concept, table, 0);
        taskId = await publish(api, reviewerPage, ontology);
        await page.goto(
          `/governance/ontology?ontology=${ontology.id}&concept=${concept.id}&version=published`
        );
        await page.getByTestId('ontology-graph-mode-data').click();

        await assetRow(page, table).click();
        await expect(
          page.getByTestId('ontology-data-asset-panel')
        ).toBeVisible();
        await expect(
          page.getByTestId('ontology-data-asset-open')
        ).toBeVisible();
        await expect(
          page.getByTestId('ontology-data-asset-unlink')
        ).toHaveCount(0);
        await page.screenshot({ path: `${SCREENSHOTS}/g17-consumer.png` });

        await page.getByTestId('ontology-data-concept-change').click();
        await page
          .getByTestId(`ontology-data-concept-option-${empty.id}`)
          .click();
        await expect(page.getByTestId('ontology-data-empty')).toBeVisible();
        await expect(page.getByTestId('ontology-data-link-asset')).toHaveCount(
          0
        );
      } finally {
        if (taskId) {
          await deleteFixtureEntity(
            api,
            `/api/v1/tasks/${taskId}?hardDelete=true`
          );
        }
        await cleanUp(api, { ontology, tables: [table] });
      }
    });
  }
);

const PATIENT_COLUMNS = [
  'patient_id',
  'date_of_birth',
  'patient_name',
  'created_at',
];

/** A table whose column names match some of the properties of the Patient concept. */
const createPatientTable = async (api: APIRequestContext) => {
  const table = new TableClass({ name: `patients_${uuid()}` });
  table.entity.columns = PATIENT_COLUMNS.map((name) => ({
    name,
    dataType: DataType.Varchar,
    dataLength: 100,
    dataTypeDisplay: 'varchar',
  }));
  await table.create(api);

  return table;
};

const createPatientFixture = async (api: APIRequestContext) => {
  const ontology = await createOntology(api);
  const concept = await createConcept(api, ontology, 'Patient');
  const [patientId, dateOfBirth, patientName] = await Promise.all(
    ['patientId', 'dateOfBirth', 'patientName'].map((name) =>
      createProperty(api, ontology, concept, name)
    )
  );
  const table = await createPatientTable(api);

  return {
    concept,
    ontology,
    properties: { dateOfBirth, patientId, patientName },
    table,
  };
};

const boundColumns = async (api: APIRequestContext, concept: OntologyConcept) =>
  (await readBindings(api, concept)).assets
    .flatMap((asset) =>
      asset.columns.map((column) => [
        column.columnPath.join('.'),
        column.propertyId,
      ])
    )
    .sort(([left], [right]) => left.localeCompare(right));

const mappingRow = (page: Page, column: string) =>
  page.getByTestId(`ontology-column-mapping-row-${column}`);

const linkThroughPicker = async (page: Page, table: TableClass) => {
  await page.getByTestId('ontology-data-link-asset').click();
  const picker = page.getByTestId('ontology-data-asset-picker');
  await picker
    .getByTestId('ontology-data-asset-search')
    .locator('input')
    .fill(table.entityResponseData.name);
  const option = picker.getByTestId(
    `ontology-data-asset-option-${table.entityResponseData.id}`
  );
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await picker.getByTestId('ontology-data-asset-save').click();
};

test.describe(
  'Binding a table suggests a property for each of its columns',
  { tag: ['@Features', '@Governance'] },
  () => {
    for (const mode of APP_MODES) {
      test(`${mode}: linking a table lists its columns with suggested properties, and saving writes the checked rows`, async ({
        isolatedUserPage: page,
      }) => {
        test.slow();
        const api = await getWorkerAdminAPIContext();
        const { concept, ontology, properties, table } =
          await createPatientFixture(api);
        try {
          await setMode(page, mode);
          await openData(page, ontology, concept);
          await linkThroughPicker(page, table);

          const step = page.getByTestId('ontology-column-mapping-step');

          await expect(step).toContainText(
            'Bind columns to Patient’s properties'
          );
          for (const [column, property] of [
            ['patient_id', 'patient id'],
            ['date_of_birth', 'date of birth'],
            ['patient_name', 'patient name'],
          ]) {
            const row = mappingRow(page, column);

            await expect(row.getByRole('button')).toContainText(property);
            await expect(row).toContainText('Suggested');
            await expect(row.getByRole('checkbox')).toBeChecked();
          }
          await expect(mappingRow(page, 'created_at')).not.toContainText(
            'Suggested'
          );
          await expect(
            mappingRow(page, 'created_at').getByRole('checkbox')
          ).not.toBeChecked();
          await page.screenshot({ path: `${SCREENSHOTS}/f2-step-${mode}.png` });

          await mappingRow(page, 'patient_name')
            .getByTestId('ontology-column-mapping-check-patient_name')
            .click();
          await expect(
            mappingRow(page, 'patient_name').getByRole('checkbox')
          ).not.toBeChecked();
          await step.getByTestId('ontology-column-mapping-save').click();
          await expect(step).toBeHidden();

          await expect
            .poll(() => boundColumns(api, concept))
            .toEqual([
              ['date_of_birth', properties.dateOfBirth.id],
              ['patient_id', properties.patientId.id],
            ]);

          await page.goto(
            `/table/${table.entityResponseData.fullyQualifiedName}`
          );
          const linked = page
            .getByTestId('table-linked-concepts')
            .getByTestId('table-linked-concept-column');

          await expect(linked).toHaveCount(2);
          await expect(linked.filter({ hasText: 'patient_id' })).toHaveCount(1);
          await expect(linked.filter({ hasText: 'date_of_birth' })).toHaveCount(
            1
          );
          await expect(linked.filter({ hasText: 'patient_name' })).toHaveCount(
            0
          );
        } finally {
          await cleanUp(api, { ontology, tables: [table] });
        }
      });
    }

    test('skipping the step leaves the table linked with no column bindings', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const { concept, ontology, table } = await createPatientFixture(api);
      try {
        await openData(page, ontology, concept);
        await linkThroughPicker(page, table);
        await page.getByTestId('ontology-column-mapping-skip').click();

        await expect(
          page.getByTestId('ontology-column-mapping-step')
        ).toBeHidden();
        await expect(assetRow(page, table)).toBeVisible();

        const bindings = await readBindings(api, concept);

        expect(bindings.assets.map((asset) => asset.assetId)).toEqual([
          table.entityResponseData.id,
        ]);
        expect(await boundColumns(api, concept)).toEqual([]);
      } finally {
        await cleanUp(api, { ontology, tables: [table] });
      }
    });

    test('a table already linked can have its columns bound from its panel, changing a suggestion', async ({
      isolatedUserPage: page,
    }) => {
      test.slow();
      const api = await getWorkerAdminAPIContext();
      const { concept, ontology, properties, table } =
        await createPatientFixture(api);
      try {
        await bindTable(api, concept, table, 0);
        await openData(page, ontology, concept);
        await assetRow(page, table).click();
        await page.getByTestId('ontology-data-asset-bind-columns').click();

        const step = page.getByTestId('ontology-column-mapping-step');

        await expect(mappingRow(page, 'patient_id')).toContainText('Suggested');
        await selectOntologyOption(
          page,
          mappingRow(page, 'created_at').getByRole('button'),
          'patient name'
        );
        await expect(
          mappingRow(page, 'created_at').getByRole('checkbox')
        ).toBeChecked();
        await expect(mappingRow(page, 'created_at')).not.toContainText(
          'Suggested'
        );
        await page.screenshot({ path: `${SCREENSHOTS}/f2-step-panel.png` });
        await step.getByTestId('ontology-column-mapping-save').click();
        await expect(step).toBeHidden();

        await expect
          .poll(() => boundColumns(api, concept))
          .toEqual([
            ['created_at', properties.patientName.id],
            ['date_of_birth', properties.dateOfBirth.id],
            ['patient_id', properties.patientId.id],
            ['patient_name', properties.patientName.id],
          ]);
      } finally {
        await cleanUp(api, { ontology, tables: [table] });
      }
    });
  }
);
