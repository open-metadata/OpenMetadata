/*
 *  Copyright 2024 Collate.
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
import { Table } from '../../../src/generated/entity/data/table';
import { IngestionPipeline } from '../../../src/generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/userPages';
import { performAdminLogin } from '../../utils/admin';
import { deleteFixtureEntity, okJson } from '../../utils/apiResponse';
import { clickIgnoringToasts, uuid } from '../../utils/common';
import { waitForSearchIndexed } from '../../utils/polling';

test.describe('BigQuery sharded table identity', { tag: '@Discovery' }, () => {
  let ordinary: TableClass;
  let service: DatabaseServiceClass;
  let family: Table;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      service = new DatabaseServiceClass(`pw.bq-service-${uuid()}`, {
        serviceType: 'BigQuery',
        connection: {
          config: {
            type: 'BigQuery',
            credentials: { gcpConfig: {} },
          },
        },
      });
      await service.create(apiContext);
      ordinary = new TableClass({ service });
      await ordinary.create(apiContext);
      const prefix = 'events_';
      family = await okJson<Table>(
        await apiContext.post('/api/v1/tables', {
          data: {
            name: `${prefix}yyyymmdd`,
            databaseSchema: ordinary.schemaResponseData.fullyQualifiedName,
            columns: [{ name: 'id', dataType: 'INT' }],
            tableType: 'Sharded',
            tableSharding: {
              prefix,
              suffixFormat: 'YYYYMMDD',
              shardCount: 2,
              firstShardDate: '2026-01-01',
              lastShardDate: '2026-01-02',
              representative: {
                databaseName: ordinary.databaseResponseData.name,
                schemaName: ordinary.schemaResponseData.name,
                tableName: `${prefix}20260102`,
                shardDate: '2026-01-02',
              },
            },
          },
        }),
        'Create sharded table'
      );
      const now = Date.now();
      for (const [index, tableName] of [
        undefined,
        'events_20260101',
        'events_20260102',
      ].entries()) {
        const profile = {
          timestamp: now - (3 - index) * 60 * 60 * 1000,
          executionSource: tableName
            ? {
                databaseName: ordinary.databaseResponseData.name,
                schemaName: ordinary.schemaResponseData.name,
                tableName,
              }
            : undefined,
        };
        await okJson(
          await apiContext.put(`/api/v1/tables/${family.id}/tableProfile`, {
            data: {
              tableProfile: { ...profile, rowCount: index + 1, columnCount: 1 },
              columnProfile: [
                {
                  ...profile,
                  name: 'id',
                  valuesCount: index + 1,
                  nullCount: 0,
                  uniqueCount: index + 1,
                },
              ],
            },
          }),
          'Create historical sharded profile'
        );
      }
      await waitForSearchIndexed(
        apiContext,
        family.fullyQualifiedName,
        'table_search_index'
      );
    } finally {
      await afterAction();
    }
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    try {
      if (family?.id) {
        await deleteFixtureEntity(
          apiContext,
          `/api/v1/tables/${family.id}?hardDelete=true&recursive=true`
        );
      }
      if (ordinary) {
        await ordinary.delete(apiContext);
      }
      if (service) {
        await service.delete(apiContext);
      }
    } finally {
      await afterAction();
    }
  });

  for (const enabled of [true, false]) {
    // Saving deploys the pipeline, so these cases need the Airflow-backed lane.
    test(`persists metadata grouping enabled=${enabled} @ingestion`, async ({
      adminPage,
      browser,
    }) => {
      test.slow();
      const serviceName = service.entity.name;
      const { apiContext, afterAction } = await performAdminLogin(browser);
      let pipeline: IngestionPipeline | undefined;
      try {
        await adminPage.goto(
          `/service/databaseServices/${encodeURIComponent(
            serviceName
          )}/add-ingestion/metadata`
        );
        await adminPage
          .getByRole('button', { name: /Scope & Behaviour/ })
          .click();
        const grouping = adminPage.getByRole('switch', {
          name: 'Group Sharded Tables',
        });
        await expect(grouping).toBeChecked();
        if (!enabled) {
          await adminPage
            .getByText('Group Sharded Tables', { exact: true })
            .click();
          await expect(grouping).not.toBeChecked();
        }
        await expect(
          adminPage.getByRole('combobox', {
            name: 'Exclude Patterns',
            exact: true,
          })
        ).toHaveCount(0);
        await clickIgnoringToasts(adminPage.getByTestId('next-button'));
        await adminPage.getByTestId('schedular-on-demand').click();
        const savedResponse = adminPage.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/services/ingestionPipelines') &&
            response.request().method() === 'POST'
        );
        const deployedResponse = adminPage.waitForResponse(
          (response) =>
            response.url().includes('/services/ingestionPipelines/deploy/') &&
            response.request().method() === 'POST'
        );
        await clickIgnoringToasts(adminPage.getByTestId('next-button'));
        pipeline = await okJson<IngestionPipeline>(
          await savedResponse,
          'Save BigQuery metadata grouping'
        );
        expect((await deployedResponse).ok()).toBeTruthy();
        const saved = await okJson<IngestionPipeline>(
          await apiContext.get(
            `/api/v1/services/ingestionPipelines/${pipeline.id}`
          ),
          'Read saved metadata grouping'
        );
        expect(saved.sourceConfig.config?.shardedTables).toEqual({
          enabled,
        });
        await adminPage.goto(
          `/service/databaseServices/${encodeURIComponent(
            serviceName
          )}/edit-ingestion/${encodeURIComponent(
            pipeline.fullyQualifiedName ?? ''
          )}/metadata`
        );
        await adminPage
          .getByRole('button', { name: /Scope & Behaviour/ })
          .click();
        if (enabled) {
          await expect(grouping).toBeChecked();
        } else {
          await expect(grouping).not.toBeChecked();
        }
      } finally {
        if (pipeline?.id) {
          await deleteFixtureEntity(
            apiContext,
            `/api/v1/services/ingestionPipelines/${pipeline.id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });
  }

  test('shows representative metadata and opens the family from an older physical name', async ({
    adminPage,
  }) => {
    await test.step('Inspect the representative widget', async () => {
      await adminPage.goto(
        `/table/${encodeURIComponent(family.fullyQualifiedName!)}`
      );
      await expect(adminPage.getByTestId('table-sharding')).toBeVisible();
      await expect(
        adminPage.getByRole('link', { name: 'events_20260102' })
      ).toHaveAttribute('href', /t=events_20260102/);
    });
    await test.step('Search the older physical name with independent suggestion pagination', async () => {
      const physical = family.fullyQualifiedName!.replace(
        'events_yyyymmdd',
        'events_20260101'
      );
      await adminPage.goto(
        `/explore/tables?search=${encodeURIComponent(physical)}&page=2`
      );
      const suggestions = adminPage.getByRole('region', {
        name: 'Matching sharded families',
      });
      await expect(suggestions).toBeVisible();
      await expect(suggestions).toBeInViewport();
      await suggestions
        .getByRole('link', { name: family.fullyQualifiedName })
        .click();
      await expect(adminPage.getByTestId('table-sharding')).toBeVisible();
    });
  });

  test('keeps physical sources with table and column history after rollover', async ({
    adminPage,
  }) => {
    const sourcePrefix = `${ordinary.databaseResponseData.name}.${ordinary.schemaResponseData.name}.`;
    await adminPage.goto(
      `/table/${encodeURIComponent(family.fullyQualifiedName ?? '')}`
    );
    await adminPage.getByTestId('profiler').click();
    await adminPage
      .getByRole('tab', { name: 'Table Profile', exact: true })
      .click();
    await expect(
      adminPage.getByTestId('latest-profile-execution-source')
    ).toContainText(`${sourcePrefix}events_20260102`);
    await expect(adminPage.getByTestId('operation-metrics')).toHaveCount(0);
    await expect(
      adminPage.getByText(
        'System metrics are not supported for sharded tables.'
      )
    ).toHaveCount(0);

    await test.step('Inspect an older table-profile point', async () => {
      const chart = adminPage.locator('#rowCount_graph svg');
      await expect(chart).toBeVisible();
      const bounds = await chart.boundingBox();
      if (!bounds) {
        throw new Error('Row-count chart has no visible bounds');
      }
      await chart.hover({
        position: { x: bounds.width / 2, y: bounds.height / 2 },
      });
      await expect(
        adminPage.getByTestId('historical-profile-execution-source')
      ).toHaveText(`Measured physical table${sourcePrefix}events_20260101`);
      await chart.hover({ position: { x: 60, y: bounds.height / 2 } });
      await expect(
        adminPage.getByTestId('historical-profile-execution-source')
      ).toContainText('Physical execution scope unavailable.');
    });

    await test.step('Inspect an older column-profile point', async () => {
      await adminPage
        .getByRole('tab', { name: 'Column Profile', exact: true })
        .click();
      await adminPage.getByRole('link', { name: 'id', exact: true }).click();
      await expect(
        adminPage.getByTestId('latest-profile-execution-source')
      ).toContainText(`${sourcePrefix}events_20260102`);
      const chart = adminPage.locator('#count_graph svg');
      await expect(chart).toBeVisible();
      const bounds = await chart.boundingBox();
      if (!bounds) {
        throw new Error('Column-count chart has no visible bounds');
      }
      await chart.hover({
        position: { x: bounds.width / 2, y: bounds.height / 2 },
      });
      await expect(
        adminPage.getByTestId('historical-profile-execution-source')
      ).toContainText(`${sourcePrefix}events_20260101`);
    });
  });

  test('omits the widget on an ordinary table', async ({ adminPage }) => {
    await ordinary.visitEntityPage(adminPage);
    await expect(
      adminPage.getByTestId('entity-header-display-name')
    ).toBeVisible();
    await expect(adminPage.getByTestId('table-sharding')).toHaveCount(0);
  });
});
