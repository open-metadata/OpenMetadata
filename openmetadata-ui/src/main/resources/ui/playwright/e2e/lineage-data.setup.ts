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

/**
 * Once-per-shard setup for the Lineage suite. Creates the root Table plus
 * 15 downstream entities (one of each type), then wires the lineage graph
 * the specs assume: root → depth1 → each depth2 entity, plus two column
 * edges the DB-service sub-describe needs. `waitForSearchIndexed` is
 * awaited for every entity so the specs' filter-dropdown searches resolve
 * against a warm index.
 *
 * Runs BEFORE the main test project (see the `lineage-data-setup` entry in
 * `playwright.config.ts`). Persists response data via
 * `LineageDataClass.saveResponseData()` so each test worker rehydrates the
 * same FQNs on module import.
 */

import { expect, test as setup } from '@playwright/test';
import { LineageDataClass } from '../support/entity/LineageDataClass';
import { SharedInfra } from '../support/entity/SharedInfra';
import { performAdminLogin } from '../utils/admin';
import { getEntityTypeSearchIndexMapping } from '../utils/common';
import { connectEdgeBetweenNodesViaAPI } from '../utils/lineage';
import { waitForSearchIndexed } from '../utils/polling';

setup('create lineage data prerequisites', async ({ browser }) => {
  // 15 entity creates + 15 edges + 16 search-index waits — the full setup
  // costs seconds under normal load but a fresh worker's first
  // SharedInfra parent-chain create adds another few seconds each. 600s
  // gives generous headroom, matching entity-data.setup.ts.
  setup.setTimeout(600 * 1000);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await LineageDataClass.create(apiContext);

    const root = LineageDataClass.lineageEntity;
    const depth1 = LineageDataClass.depth1Entity();
    const depth2 = LineageDataClass.depth2ndEntities();

    // Root → depth-1
    await connectEdgeBetweenNodesViaAPI(
      apiContext,
      {
        id: root.entityResponseData.id,
        type: getEntityTypeSearchIndexMapping(root.type),
      },
      {
        id: depth1.entityResponseData.id,
        type: getEntityTypeSearchIndexMapping(depth1.type),
      }
    );

    // depth-1 → each depth-2
    for (const entity of depth2) {
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: depth1.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(depth1.type),
        },
        {
          id: entity.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(entity.type),
        }
      );
    }

    // Two column-level edges from root → depth1 for the DB-service tests
    // (Verify lineage Database service related filters). Matches the
    // inner beforeAll the spec used to run.
    const rootFirstColumnFqn =
      (root.entityResponseData.columns?.[0]?.fullyQualifiedName as
        | string
        | undefined) ?? '';
    const depth1FirstColumnFqn =
      // depth1 is TableClass — its columns are known typed. Cast down for
      // the helper's untyped shape.
      (
        depth1 as unknown as {
          entityResponseData?: {
            columns?: Array<{ fullyQualifiedName?: string }>;
          };
        }
      ).entityResponseData?.columns?.[0]?.fullyQualifiedName ?? '';

    if (rootFirstColumnFqn && depth1FirstColumnFqn) {
      await connectEdgeBetweenNodesViaAPI(
        apiContext,
        {
          id: root.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(root.type),
        },
        {
          id: depth1.entityResponseData.id,
          type: getEntityTypeSearchIndexMapping(depth1.type),
        },
        [
          {
            fromColumns: [rootFirstColumnFqn],
            toColumn: depth1FirstColumnFqn,
          },
          {
            fromColumns: [rootFirstColumnFqn],
            toColumn: depth1FirstColumnFqn,
          },
        ]
      );
    }

    // Warm the search index for every entity so the filter-dropdown
    // aggregation searches in the spec resolve on first pass. Naming is
    // NOT `<type>_search_index` uniformly — SearchIndex uses
    // `search_entity_search_index` and DashboardDataModel is stored under
    // `dashboard_data_model_search_index`. This map matches the one the
    // spec used to carry inline.
    const searchIndexByEntityType: Record<string, string> = {
      apiEndpoint: 'api_endpoint_search_index',
      container: 'container_search_index',
      dashboard: 'dashboard_search_index',
      dashboardDataModel: 'dashboard_data_model_search_index',
      directory: 'directory_search_index',
      file: 'file_search_index',
      metric: 'metric_search_index',
      mlmodel: 'mlmodel_search_index',
      pipeline: 'pipeline_search_index',
      searchIndex: 'search_entity_search_index',
      spreadsheet: 'spreadsheet_search_index',
      storedProcedure: 'stored_procedure_search_index',
      table: 'table_search_index',
      topic: 'topic_search_index',
      worksheet: 'worksheet_search_index',
    };

    await Promise.all(
      [root, ...LineageDataClass.allEntities()].map((entity) => {
        const entityType = getEntityTypeSearchIndexMapping(entity.type);
        const searchIndex = searchIndexByEntityType[entityType];
        if (!searchIndex) {
          throw new Error(
            `lineage-data.setup: no search-index mapping for entity type ` +
              `"${entity.type}" (normalised: "${entityType}")`
          );
        }

        return waitForSearchIndexed(
          apiContext,
          entity.entityResponseData.fullyQualifiedName ?? '',
          searchIndex
        );
      })
    );

    expect(root.entityResponseData.id).toBeTruthy();
    LineageDataClass.saveResponseData();
    // Persist SharedInfra parents (databaseService, messagingService, …)
    // so every test worker picks them up on module import without doing
    // its own POST /services/* — the whole point of machine-level
    // sharing. See SharedInfra.loadResponseData().
    SharedInfra.saveResponseData();
  } finally {
    await afterAction();
  }
});
