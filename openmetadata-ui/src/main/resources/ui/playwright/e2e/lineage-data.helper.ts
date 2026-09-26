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
 * Body of the lineage/SharedInfra seeding, called from `entity-data.setup.ts`.
 *
 * The seeding used to live in its own `lineage-data.setup.ts` project. The
 * CI fixture-builder step (see
 * `.github/workflows/playwright-e2e-reusable.yml`, "Seed reusable Playwright
 * auth and entity state") only invokes `--project=entity-data-setup` — so
 * every shard restored a fixture with `entity-response-data.json` but neither
 * `shared-infra.json` nor `lineage-data.json`, and every worker fell back to
 * the "socket hang up"-prone fresh POST /services path. Folding the seeding
 * into `entity-data.setup.ts` (via this helper) means all three JSON files
 * end up in the cached fixture from one CI setup step, with no workflow edit.
 */

import { APIRequestContext, expect } from '@playwright/test';
import { LineageDataClass } from '../support/entity/LineageDataClass';
import { SharedInfra } from '../support/entity/SharedInfra';
import { getEntityTypeSearchIndexMapping } from '../utils/common';
import { connectEdgeBetweenNodesViaAPI } from '../utils/lineage';
import { waitForSearchIndexed } from '../utils/polling';

export async function seedLineageAndSharedInfra(
  apiContext: APIRequestContext
): Promise<void> {
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

  // Two column-level edges from root → depth1 for the DB-service sub-describe
  // ("Verify lineage Database service related filters" in LineageFilters).
  const rootFirstColumnFqn =
    (root.entityResponseData.columns?.[0]?.fullyQualifiedName as
      | string
      | undefined) ?? '';
  const depth1FirstColumnFqn =
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

  // Naming is NOT `<type>_search_index` uniformly — SearchIndex uses
  // `search_entity_search_index` and DashboardDataModel maps to
  // `dashboard_data_model_search_index`.
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
          `lineage-data seeding: no search-index mapping for entity type ` +
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
  SharedInfra.saveResponseData();
}
