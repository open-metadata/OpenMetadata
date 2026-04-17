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
import { APIRequestContext, expect } from '@playwright/test';
import { get } from 'lodash';
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../../support/entity/DirectoryClass';
import { EntityDataClass } from '../../../support/entity/EntityDataClass';
import { FileClass } from '../../../support/entity/FileClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../../support/entity/StoredProcedureClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { WorksheetClass } from '../../../support/entity/WorksheetClass';
import {
  getApiContext,
  getDefaultAdminAPIContext,
  getEntityTypeSearchIndexMapping,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  connectEdgeBetweenNodesViaAPI,
  openImpactAnalysisTab,
  performZoomOut,
  rearrangeNodes,
  setLineageDepthAndVerify,
  visitLineageTab,
} from '../../../utils/lineage';
import { test } from '../../fixtures/pages';

type EntityClassUnion =
  | TableClass
  | ContainerClass
  | TopicClass
  | DashboardClass
  | MlModelClass
  | PipelineClass
  | StoredProcedureClass
  | SearchIndexClass
  | DashboardDataModelClass
  | ApiEndpointClass
  | MetricClass
  | DirectoryClass
  | FileClass
  | SpreadsheetClass
  | WorksheetClass;

// Contains list of entity supported
const allEntities = {
  table: TableClass,
  container: ContainerClass,
  topic: TopicClass,
  dashboard: DashboardClass,
  mlmodel: MlModelClass,
  pipeline: PipelineClass,
  storedProcedure: StoredProcedureClass,
  searchIndex: SearchIndexClass,
  dataModel: DashboardDataModelClass,
  apiEndpoint: ApiEndpointClass,
  metric: MetricClass,
  directory: DirectoryClass,
  file: FileClass,
  spreadsheet: SpreadsheetClass,
  worksheet: WorksheetClass,
};

test.describe('Lineage Filters', () => {
  const lineageEntity = new TableClass();
  const entities = Object.values(allEntities).map(
    (EntityClass) => new EntityClass()
  );
  const [depth1Entity, ...depth2ndEntities] = entities;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );

    await lineageEntity.create(apiContext);
    await Promise.all(entities.map((entity) => entity.create(apiContext)));

    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      {
        id: lineageEntity.entityResponseData.id,
        type: getEntityTypeSearchIndexMapping(lineageEntity.type),
      },
      {
        id: depth1Entity.entityResponseData.id,
        type: getEntityTypeSearchIndexMapping(depth1Entity.type),
      }
    );

    for (const entity of depth2ndEntities) {
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: depth1Entity.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(lineageEntity.type),
        },
        {
          id: entity.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(entity.type),
        }
      );
    }

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await lineageEntity.visitEntityPage(page);
    await visitLineageTab(page);
    await waitForAllLoadersToDisappear(page);
    await setLineageDepthAndVerify(page, 2, 2);
    await waitForAllLoadersToDisappear(page);
    await rearrangeNodes(page);
    await performZoomOut(page);
    await expect(
      page.getByTestId(
        `lineage-node-${lineageEntity.entityResponseData.fullyQualifiedName}`
      )
    ).toBeVisible();
  });

  const filterConfigs = [
    {
      filterName: 'Domains',
      filterTestId: 'Domains',
      setupMetadata: async (
        apiContext: APIRequestContext,
        entitiesToPatch: EntityClassUnion[]
      ) => {
        for (const entity of entitiesToPatch) {
          await entity.patch({
            apiContext,
            patchData: [
              {
                op: 'add',
                value: {
                  type: 'domain',
                  id: EntityDataClass.domain1.responseData.id,
                },
                path: '/domains/0',
              },
            ],
          });
        }
      },
      filterValue: EntityDataClass.domain1.responseData.displayName,
    },
    {
      filterName: 'Owners',
      filterTestId: 'Owners',
      setupMetadata: async (
        apiContext: APIRequestContext,
        entitiesToPatch: EntityClassUnion[]
      ) => {
        for (const entity of entitiesToPatch) {
          await entity.patch({
            apiContext,
            patchData: [
              {
                op: 'add',
                value: {
                  type: 'user',
                  id: EntityDataClass.user1.responseData.id,
                },
                path: '/owners/0',
              },
            ],
          });
        }
      },
      filterValue: EntityDataClass.user1.responseData.displayName,
    },
    {
      filterName: 'Tag',
      filterTestId: 'Tag',
      setupMetadata: async (
        apiContext: APIRequestContext,
        entitiesToPatch: EntityClassUnion[]
      ) => {
        for (const entity of entitiesToPatch) {
          await entity.patch({
            apiContext,
            patchData: [
              {
                op: 'add',
                value: [
                  {
                    tagFQN:
                      EntityDataClass.tag1.responseData.fullyQualifiedName,
                    source: 'Classification',
                    labelType: 'Manual',
                    state: 'Confirmed',
                  },
                ],
                path: '/tags',
              },
            ],
          });
        }
      },
      filterValue: EntityDataClass.tag1.responseData.fullyQualifiedName,
    },
    {
      filterName: 'Tier',
      filterTestId: 'Tier',
      setupMetadata: async (
        apiContext: APIRequestContext,
        entitiesToPatch: EntityClassUnion[]
      ) => {
        for (const entity of entitiesToPatch) {
          await entity.patch({
            apiContext,
            patchData: [
              {
                op: 'add',
                value: [
                  {
                    tagFQN:
                      EntityDataClass.tierTag1.responseData.fullyQualifiedName,
                    source: 'Classification',
                    labelType: 'Manual',
                    state: 'Confirmed',
                  },
                ],
                path: '/tags',
              },
            ],
          });
        }
      },
      filterValue: EntityDataClass.tierTag1.responseData.fullyQualifiedName,
    },
  ];

  filterConfigs.forEach(
    ({ filterName, filterTestId, setupMetadata, filterValue }) => {
      test(`Verify ${filterName} filter for Lineage`, async ({ page }) => {
        const { apiContext, afterAction } = await getApiContext(page);

        const entitiesToShow: EntityClassUnion[] = [
          lineageEntity,
          depth1Entity,
        ];
        const entitiesToHide: EntityClassUnion[] = [];

        depth2ndEntities.forEach((entity, index) => {
          if (index % 2 === 0) {
            entitiesToShow.push(entity);
          } else {
            entitiesToHide.push(entity);
          }
        });

        await setupMetadata(apiContext, entitiesToShow);

        await test.step('Verify filters working for Lineage tab', async () => {
          await page.reload();
          await waitForAllLoadersToDisappear(page);
          await setLineageDepthAndVerify(page, 2, 2);
          await waitForAllLoadersToDisappear(page);

          await page.getByTestId('filters-button').click();
          await page.getByTestId(`search-dropdown-${filterTestId}`).click();

          await page.getByTitle(filterValue).click();

          const lineageRes = page.waitForResponse(
            '/api/v1/lineage/getLineage?*'
          );
          await page.getByRole('button', { name: 'Update' }).click();
          await lineageRes;

          await rearrangeNodes(page);
          await performZoomOut(page);

          for (const entity of entitiesToShow) {
            await expect(
              page.getByTestId(
                `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
              )
            ).toBeVisible();
          }

          for (const entity of entitiesToHide) {
            await expect(
              page.getByTestId(
                `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
              )
            ).not.toBeVisible();
          }
        });

        await test.step('Verify filters working for Impact Analysis tab', async () => {
          // Navigate to Impact Analysis
          const impactAnalysisTab = page.getByRole('tab', {
            name: 'Impact Analysis',
          });

          await expect(impactAnalysisTab).toBeVisible();
          await impactAnalysisTab.scrollIntoViewIfNeeded();
          await impactAnalysisTab.click();
          await waitForAllLoadersToDisappear(page);

          await page.getByTestId('filters-button').click();
          await page.getByTestId(`search-dropdown-${filterTestId}`).click();

          await page
            .getByTestId('drop-down-menu')
            .getByTestId('loader')
            .waitFor({ state: 'hidden' });
          await page.getByTitle(filterValue).click();

          const lineageRes = page.waitForResponse(
            '/api/v1/lineage/getLineageByEntityCount?*'
          );
          await page.getByRole('button', { name: 'Update' }).click();
          await lineageRes;

          for (const entity of entitiesToShow) {
            if (
              entity.entityResponseData.fullyQualifiedName ===
              lineageEntity.entityResponseData.fullyQualifiedName
            ) {
              // for Impact analysis we won't render lineageEntity
              continue;
            }
            await expect(
              page.locator(
                `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
              )
            ).toBeVisible();
          }

          for (const entity of entitiesToHide) {
            await expect(
              page.locator(
                `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
              )
            ).not.toBeVisible();
          }
        });

        await afterAction();
      });
    }
  );

  test('Verify lineage filter panel toggle', async ({ page }) => {
    const filterBtn = page.locator('[aria-label="Filters"]');

    await filterBtn.click();
    await expect(
      page
        .getByTestId('lineage-details')
        .getByRole('button', { name: 'Domains' })
    ).toBeVisible();
    await expect(page.getByTestId('search-dropdown-Owners')).toBeVisible();
    await expect(page.getByTestId('search-dropdown-Tier')).toBeVisible();

    await filterBtn.click();
    await expect(
      page
        .getByTestId('lineage-details')
        .getByRole('button', { name: 'Domains' })
    ).not.toBeVisible();
    await expect(page.getByTestId('search-dropdown-Owners')).not.toBeVisible();
    await expect(page.getByTestId('search-dropdown-Tier')).not.toBeVisible();
  });

  test('Verify Impact Analysis service filter selection', async ({ page }) => {
    await openImpactAnalysisTab(page);
    await page.locator('[aria-label="Filters"]').click();

    for (let index = 0; index < depth2ndEntities.length; index++) {
      const entity = depth2ndEntities[index];

      if (entity.type === 'Metric') {
        continue;
      }
      await test.step(`Select service for ${entity.entityResponseData.fullyQualifiedName}`, async () => {
        await page.getByTestId('search-dropdown-Service').click();
        await page.getByTestId('drop-down-menu').getByTestId('loader').waitFor({
          state: 'hidden',
        });
        const serviceName = get(
          entity,
          entity.type === 'Metric'
            ? 'entityResponseData.name'
            : 'entityResponseData.service.name',
          ''
        );

        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/v1/search/aggregate`) &&
            response.request().method() === 'POST'
        );

        await page
          .getByTestId('drop-down-menu')
          .getByTestId('search-input')
          .fill(serviceName);
        await searchResponse;
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceName}-checkbox`)
          .waitFor();
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceName}-checkbox`)
          .click();

        const entitiesToShow = [entity];

        // service entity and base entity will be visible
        // rest of them will be hidden
        const entitiesToHide = depth2ndEntities.filter(
          (_, idx) => idx !== index
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await expect(page.getByRole('button', { name: 'Update' })).toBeHidden();

        for (const entity of entitiesToShow) {
          await expect(
            page.locator(
              `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
            )
          ).toBeVisible();
        }

        for (const entity of entitiesToHide) {
          await expect(
            page.locator(
              `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
            )
          ).not.toBeVisible();
        }

        // clear the filter after validation
        const clearAllBtn = page.getByRole('button', { name: /clear/i });
        await expect(clearAllBtn).toBeEnabled();

        await clearAllBtn.click();

        await waitForAllLoadersToDisappear(page);
      });
    }
  });

  test('Verify lineage service filter selection', async ({ page }) => {
    test.slow();
    await page.locator('[aria-label="Filters"]').click();

    for (let index = 0; index < depth2ndEntities.length; index++) {
      const entity = depth2ndEntities[index];

      if (entity.type === 'Metric') {
        continue;
      }
      await test.step(`Select service for ${entity.entityResponseData.fullyQualifiedName}`, async () => {
        await page.getByTestId('search-dropdown-Service').click();
        await page.getByTestId('drop-down-menu').getByTestId('loader').waitFor({
          state: 'hidden',
        });
        const serviceName = get(
          entity,
          entity.type === 'Metric'
            ? 'entityResponseData.name'
            : 'entityResponseData.service.name',
          ''
        );

        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/v1/search/aggregate`) &&
            response.request().method() === 'POST'
        );

        await page
          .getByTestId('drop-down-menu')
          .getByTestId('search-input')
          .fill(serviceName);
        await searchResponse;
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceName}-checkbox`)
          .waitFor();
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceName}-checkbox`)
          .click();

        const entitiesToShow = [lineageEntity, depth1Entity, entity];

        // service entity and base entity will be visible
        // rest of them will be hidden
        const entitiesToHide = depth2ndEntities.filter(
          (_, idx) => idx !== index
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await expect(page.getByRole('button', { name: 'Update' })).toBeHidden();

        await rearrangeNodes(page);
        await performZoomOut(page);

        for (const entity of entitiesToShow) {
          await expect(
            page.getByTestId(
              `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
            )
          ).toBeVisible();
        }

        for (const entity of entitiesToHide) {
          await expect(
            page.getByTestId(
              `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
            )
          ).not.toBeVisible();
        }

        // clear the filter after validation
        const clearAllBtn = page.getByRole('button', { name: /clear/i });
        await expect(clearAllBtn).toBeEnabled();

        await clearAllBtn.click();

        await waitForAllLoadersToDisappear(page);
      });
    }
  });

  test('Verify Impact Analysis service type filter selection', async ({
    page,
  }) => {
    await openImpactAnalysisTab(page);
    await page.locator('[aria-label="Filters"]').click();

    for (const entity of depth2ndEntities) {
      if (entity.type === 'Metric') {
        continue;
      }

      await test.step(`Select service type for ${entity.entityResponseData.fullyQualifiedName}`, async () => {
        await page.getByTestId('search-dropdown-Service Type').click();
        const serviceType = get(
          entity,
          'entityResponseData.serviceType',
          ''
        ).toLowerCase();

        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/v1/search/aggregate`) &&
            response.request().method() === 'POST'
        );
        await page
          .getByTestId('drop-down-menu')
          .getByTestId('search-input')
          .fill(serviceType);
        await searchResponse;
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceType}-checkbox`)
          .waitFor();
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceType}-checkbox`)
          .click();

        const entitiesToShow = [entity];

        // service entity and base entity will be visible
        // rest of them will be hidden
        const entitiesToHide = depth2ndEntities.filter(
          (record) =>
            serviceType !==
            get(record, 'entityResponseData.serviceType', '').toLowerCase()
        );

        const lineageRes = page.waitForResponse(
          '/api/v1/lineage/getLineageByEntityCount?*'
        );
        await page.getByRole('button', { name: 'Update' }).click();
        await lineageRes;

        console.log(entitiesToShow, entitiesToHide);

        for (const entity of entitiesToShow) {
          await expect(
            page.locator(
              `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
            )
          ).toBeVisible();
        }

        for (const entity of entitiesToHide) {
          await expect(
            page.locator(
              `[data-row-key="${entity.entityResponseData.fullyQualifiedName}"]`
            )
          ).not.toBeVisible();
        }

        // clear the filter after validation
        const clearAllBtn = page.getByRole('button', { name: /clear/i });
        await expect(clearAllBtn).toBeEnabled();

        await clearAllBtn.click();

        await waitForAllLoadersToDisappear(page);
      });
    }
  });

  test('Verify lineage service type filter selection', async ({ page }) => {
    test.slow();

    await page.locator('[aria-label="Filters"]').click();

    for (const entity of depth2ndEntities) {
      if (entity.type === 'Metric') {
        continue;
      }

      await test.step(`Select service type for ${entity.entityResponseData.fullyQualifiedName}`, async () => {
        await page.getByTestId('search-dropdown-Service Type').click();
        const serviceType = get(
          entity,
          'entityResponseData.serviceType',
          ''
        ).toLowerCase();

        const searchResponse = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/v1/search/aggregate`) &&
            response.request().method() === 'POST'
        );
        await page
          .getByTestId('drop-down-menu')
          .getByTestId('search-input')
          .fill(serviceType);
        await searchResponse;
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceType}-checkbox`)
          .waitFor();
        await page
          .getByTestId('drop-down-menu')
          .getByTestId(`${serviceType}-checkbox`)
          .click();

        const entitiesToShow = [lineageEntity, depth1Entity, entity];

        // service entity and base entity will be visible
        // rest of them will be hidden

        // service entity and base entity will be visible
        // rest of them will be hidden
        const entitiesToHide = depth2ndEntities.filter(
          (record) =>
            serviceType !==
            get(record, 'entityResponseData.serviceType', '').toLowerCase()
        );

        const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
        await page.getByRole('button', { name: 'Update' }).click();
        await lineageRes;

        await rearrangeNodes(page);
        await performZoomOut(page);

        for (const entity of entitiesToShow) {
          await expect(
            page.getByTestId(
              `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
            )
          ).toBeVisible();
        }

        for (const entity of entitiesToHide) {
          await expect(
            page.getByTestId(
              `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
            )
          ).not.toBeVisible();
        }

        // clear the filter after validation
        const clearAllBtn = page.getByRole('button', { name: /clear/i });
        await expect(clearAllBtn).toBeEnabled();

        await clearAllBtn.click();

        await waitForAllLoadersToDisappear(page);
      });
    }
  });

  test.describe('Verify lineage Database service related filters', () => {
    test.beforeAll(
      'prepare lineage for database service connection',
      async ({ browser }) => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );

        await connectEdgeBetweenNodesViaAPI(
          apiContext,
          {
            id: lineageEntity.entityResponseData.id,
            type: getEntityTypeSearchIndexMapping(lineageEntity.type),
          },
          {
            id: depth1Entity.entityResponseData.id,
            type: getEntityTypeSearchIndexMapping(depth1Entity.type),
          },
          [
            {
              fromColumns: [
                lineageEntity.entityResponseData.columns[0]
                  .fullyQualifiedName ?? '',
              ],
              toColumn: get(
                depth1Entity,
                'entityResponseData.columns[0].fullyQualifiedName',
                ''
              ),
            },
            {
              fromColumns: [
                lineageEntity.entityResponseData.columns[0]
                  .fullyQualifiedName ?? '',
              ],
              toColumn: get(
                depth1Entity,
                'entityResponseData.columns[0].fullyQualifiedName',
                ''
              ),
            },
          ]
        );

        await afterAction();
      }
    );

    test('Verify lineage database filter selection', async ({ page }) => {
      await page.locator('[aria-label="Filters"]').click();
      await page.getByTestId('search-dropdown-Database').click();

      const [entityToTest, ...entitiesToHide] = entities;

      const databaseName = get(
        entityToTest,
        'entityResponseData.database.name',
        ''
      );
      await page.getByTitle(databaseName).click();

      const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
      await page.getByRole('button', { name: 'Update' }).click();
      await lineageRes;

      await rearrangeNodes(page);
      await performZoomOut(page);

      // filtered service node should be visible
      await expect(
        page.getByTestId(
          `lineage-node-${entityToTest.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      // main entity node should always be visible
      await expect(
        page.getByTestId(
          `lineage-node-${lineageEntity.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      for (const entity of entitiesToHide) {
        await expect(
          page.getByTestId(
            `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      }

      await waitForAllLoadersToDisappear(page);
    });

    test('Verify lineage schema filter selection', async ({ page }) => {
      await page.locator('[aria-label="Filters"]').click();
      await page.getByTestId('search-dropdown-Schema').click();

      const [entityToTest, ...entitiesToHide] = entities;

      const databaseSchemaName = get(
        entityToTest,
        'entityResponseData.databaseSchema.name',
        ''
      );
      await page.getByTitle(databaseSchemaName).click();

      const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
      await page.getByRole('button', { name: 'Update' }).click();
      await lineageRes;

      await rearrangeNodes(page);
      await performZoomOut(page);

      // filtered service node should be visible
      await expect(
        page.getByTestId(
          `lineage-node-${entityToTest.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      // main entity node should always be visible
      await expect(
        page.getByTestId(
          `lineage-node-${lineageEntity.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      for (const entity of entitiesToHide) {
        await expect(
          page.getByTestId(
            `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      }

      await waitForAllLoadersToDisappear(page);
    });

    test('Verify lineage column filter selection', async ({ page }) => {
      await page.locator('[aria-label="Filters"]').click();
      await page.getByTestId('search-dropdown-Column').click();

      const [entityToTest, ...entitiesToHide] = entities;

      const columnName = get(
        entityToTest,
        'entityResponseData.columns[0].name',
        ''
      );
      await page.getByTitle(columnName).click();

      const lineageRes = page.waitForResponse('/api/v1/lineage/getLineage?*');
      await page.getByRole('button', { name: 'Update' }).click();
      await lineageRes;

      await rearrangeNodes(page);
      await performZoomOut(page);

      // filtered service node should be visible
      await expect(
        page.getByTestId(
          `lineage-node-${entityToTest.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      // main entity node should always be visible
      await expect(
        page.getByTestId(
          `lineage-node-${lineageEntity.entityResponseData.fullyQualifiedName}`
        )
      ).toBeVisible();

      for (const entity of entitiesToHide) {
        await expect(
          page.getByTestId(
            `lineage-node-${entity.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      }

      await waitForAllLoadersToDisappear(page);
    });
  });

  test('Verify LineageSearchSelect in lineage mode', async ({ page }) => {
    const searchSelect = page.getByTestId('lineage-search');
    await expect(searchSelect).toBeVisible();
    const topicEntity = entities[1];

    await searchSelect.click();
    await page
      .getByTestId('lineage-search')
      .getByRole('combobox')
      .fill(topicEntity.entity.name);

    const topicFqn = get(topicEntity, 'entityResponseData.fullyQualifiedName');
    await page.getByTestId(`option-${topicFqn}`).click();

    await page.locator('.lineage-entity-panel').waitFor();
    await page
      .getByTestId('entity-summary-panel-container')
      .getByTestId('entity-header-title')
      .waitFor();
    await expect(
      page
        .getByTestId('entity-summary-panel-container')
        .getByTestId('entity-header-title')
    ).toHaveText(
      topicEntity.entityResponseData.displayName ?? topicEntity.entity.name
    );

    await page.getByTestId('drawer-close-icon').click();
    await page.locator('.lineage-entity-panel').waitFor({
      state: 'hidden',
    });

    await rearrangeNodes(page);
    await performZoomOut(page);

    await expect(page.getByTestId(`lineage-node-${topicFqn}`)).toBeVisible();
  });

  test.describe('Verify filters for Impact Analysis', () => {
    test.beforeEach('navigate to impact analysis', async ({ page }) => {
      await page.getByRole('tab', { name: 'Impact Analysis' }).click();
      await waitForAllLoadersToDisappear(page);
    });

    test('verify downstream count for all the entities', async ({ page }) => {
      test.slow();

      // validate main entity count
      const count = entities.length;
      await expect(
        page.getByRole('button', { name: `Downstream ${count}` })
      ).toBeVisible();

      await depth1Entity.visitEntityPage(page);
      await visitLineageTab(page);
      await page.getByRole('tab', { name: 'Impact Analysis' }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('button', { name: `Downstream ${count - 1}` })
      ).toBeVisible();

      for (const entity of depth2ndEntities) {
        await entity.visitEntityPage(page);
        await visitLineageTab(page);
        await waitForAllLoadersToDisappear(page);
        await setLineageDepthAndVerify(page, 2, 2);
        await page.getByRole('tab', { name: 'Impact Analysis' }).click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: `Downstream 0` })
        ).toBeVisible();
      }
    });

    test('verify upstream count for all the entities', async ({ page }) => {
      test.slow();

      // Verify Dashboard is visible in Impact Analysis for Upstream
      await page.getByRole('button', { name: 'Upstream' }).click();
      await waitForAllLoadersToDisappear(page);

      // validate main entity count
      const upstreamCount = 0;

      await expect(
        page.getByRole('button', { name: `Upstream ${upstreamCount}` })
      ).toBeVisible();

      await depth1Entity.visitEntityPage(page);
      await visitLineageTab(page);
      await page.getByRole('tab', { name: 'Impact Analysis' }).click();
      await waitForAllLoadersToDisappear(page);

      // Verify Dashboard is visible in Impact Analysis for Upstream
      await page.getByRole('button', { name: 'Upstream' }).click();
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('button', { name: `Upstream ${upstreamCount + 1}` })
      ).toBeVisible();

      for (const entity of depth2ndEntities) {
        await entity.visitEntityPage(page);
        await visitLineageTab(page);
        await waitForAllLoadersToDisappear(page);
        await setLineageDepthAndVerify(page, 2, 2);
        await page.getByRole('tab', { name: 'Impact Analysis' }).click();

        await waitForAllLoadersToDisappear(page);
        // Verify Dashboard is visible in Impact Analysis for Upstream
        await page.getByRole('button', { name: 'Upstream' }).click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByRole('button', { name: `Upstream 2` })
        ).toBeVisible();
      }
    });
  });
});
