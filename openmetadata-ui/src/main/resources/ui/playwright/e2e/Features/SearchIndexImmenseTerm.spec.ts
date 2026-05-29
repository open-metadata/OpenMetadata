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
 * Reproduces the "immense term" reindex failure: a single nested column leaf
 * longer than Lucene's 32,766-byte keyword limit is flattened into
 * `columns.children` and fails the search-index bulk insert, so the entity never
 * lands in the index.
 *
 * The original leaf was a ~50 KB Looker measure expression containing CJK
 * characters, so the payload mirrors both the field (`dataTypeDisplay`) and the
 * multi-byte content to exercise the byte-vs-char distinction that ASCII-only
 * fixtures miss.
 *
 * The test reindexes ONLY this entity via `/search/reindexEntities`, then tracks
 * the outcome with `/search/get/{index}/doc/{id}`:
 *   - 200 → the document indexed successfully.
 *   - 404 → it failed to index (the oversize leaf was rejected).
 * While the bug is present the document never indexes (404) and this fails RED.
 * Once the oversize leaf is capped/dropped at index-build time, the document
 * indexes (200) and the test goes green.
 */

import { APIRequestContext, expect, test } from '@playwright/test';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { createAdminApiContext } from '../../utils/admin';

test.use({ storageState: 'playwright/.auth/admin.json' });

const LUCENE_MAX_TERM_BYTES = 32766;
const REINDEX_ENTITY_TYPE = 'dashboardDataModel';

const buildOversizeExpression = (targetBytes = 50586): string => {
  const unit =
    'Expression : //Par_MQY_Time 時間 SUM(CASE WHEN revenue > 0 THEN revenue END) / ';
  let value = '';

  while (Buffer.byteLength(value, 'utf8') < targetBytes) {
    value += unit;
  }

  return value;
};

const buildOversizeColumns = () => {
  const oversizeExpression = buildOversizeExpression();

  return [
    {
      name: 'metrics',
      dataType: 'STRUCT',
      dataTypeDisplay: 'struct',
      description: 'Computed metrics for the data model.',
      children: [
        {
          name: 'revenue_measure',
          dataType: 'STRUCT',
          dataTypeDisplay: 'struct',
          description: 'Revenue measure with a large derived expression.',
          children: [
            {
              name: 'derived_expression',
              dataType: 'VARCHAR',
              dataLength: 256,
              dataTypeDisplay: oversizeExpression,
              description:
                'Looker measure expression exceeding the Lucene term limit.',
            },
          ],
        },
      ],
    },
  ];
};

const reindexEntity = async (
  apiContext: APIRequestContext,
  entityId: string,
  fullyQualifiedName: string
): Promise<void> => {
  const response = await apiContext.post('/api/v1/search/reindexEntities', {
    data: [{ id: entityId, type: REINDEX_ENTITY_TYPE, fullyQualifiedName }],
  });

  expect(response.status()).toBe(200);
};

const getIndexedDocStatus = async (
  apiContext: APIRequestContext,
  entityId: string
): Promise<number> => {
  const response = await apiContext.get(
    `/api/v1/search/get/${REINDEX_ENTITY_TYPE}/doc/${entityId}`
  );

  return response.status();
};

test.describe('Search Index - oversized nested column reindex', () => {
  const dataModel = new DashboardDataModelClass();

  test.beforeAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    const oversizeColumns = buildOversizeColumns();
    dataModel.children = oversizeColumns;
    dataModel.entity.columns = oversizeColumns;

    await dataModel.create(apiContext);
    await afterAction();
  });

  test.afterAll(async () => {
    const { apiContext, afterAction } = await createAdminApiContext();
    await dataModel.delete(apiContext);
    await afterAction();
  });

  test('reindex of a >32KB nested column leaf indexes the document', async () => {
    test.slow();

    const { apiContext, afterAction } = await createAdminApiContext();

    try {
      const entityId = dataModel.entityResponseData.id;
      const fullyQualifiedName =
        dataModel.entityResponseData.fullyQualifiedName ?? '';

      expect(
        Buffer.byteLength(
          dataModel.entity.columns[0].children?.[0].children?.[0]
            .dataTypeDisplay ?? '',
          'utf8'
        )
      ).toBeGreaterThan(LUCENE_MAX_TERM_BYTES);

      await test.step('Reindex only this entity', async () => {
        await reindexEntity(apiContext, entityId, fullyQualifiedName);
      });

      await test.step('Document is present in the search index', async () => {
        // 404 means the oversize columns.children leaf was rejected (immense
        // term) and the document never indexed. reindexEntities swallows the
        // engine error, so the indexed/not-indexed outcome is the signal here.
        await expect
          .poll(() => getIndexedDocStatus(apiContext, entityId), {
            message:
              'expected the reindexed data model to be present in the index (404 = oversize columns.children leaf rejected, document not indexed)',
            intervals: [2_000, 3_000, 5_000, 10_000],
            timeout: 60_000,
          })
          .toBe(200);
      });
    } finally {
      await afterAction();
    }
  });
});
