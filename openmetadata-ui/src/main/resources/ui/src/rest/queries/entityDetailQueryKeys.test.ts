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
import { EntityType } from '../../enums/entity.enum';
import { apiCollectionQueryKey } from './apiCollectionQuery';
import { apiEndpointQueryKey } from './apiEndpointQuery';
import { chartQueryKey } from './chartQuery';
import { containerQueryKey } from './containerQuery';
import { dashboardDataModelQueryKey } from './dashboardDataModelQuery';
import { dashboardQueryKey } from './dashboardQuery';
import { databaseQueryKey } from './databaseQuery';
import { databaseSchemaQueryKey } from './databaseSchemaQuery';
import { dataProductQueryKey } from './dataProductQuery';
import { glossaryTermQueryKey } from './glossaryTermQuery';
import { metricQueryKey } from './metricQuery';
import { mlModelQueryKey } from './mlModelQuery';
import { pipelineQueryKey } from './pipelineQuery';
import { searchIndexQueryKey } from './searchIndexQuery';
import { storedProcedureQueryKey } from './storedProcedureQuery';
import { tableQueryKey } from './tableQuery';
import { topicQueryKey } from './topicQuery';

// Guard for ADR:2026-10-14-entity-detail-query-keys-start-with-entity-type-and-fqn
const FQN = 'service.entity';

const DETAIL_QUERY_KEYS: Array<[EntityType, readonly unknown[]]> = [
  [EntityType.API_COLLECTION, apiCollectionQueryKey(FQN, 'f')],
  [EntityType.API_ENDPOINT, apiEndpointQueryKey(FQN, 'f')],
  [EntityType.CHART, chartQueryKey(FQN, 'f')],
  [EntityType.CONTAINER, containerQueryKey(FQN, 'f')],
  [EntityType.DASHBOARD_DATA_MODEL, dashboardDataModelQueryKey(FQN, 'f')],
  [EntityType.DASHBOARD, dashboardQueryKey(FQN, 'f')],
  [EntityType.DATA_PRODUCT, dataProductQueryKey(FQN, ['f'])],
  [EntityType.DATABASE, databaseQueryKey(FQN, 'f')],
  [EntityType.DATABASE_SCHEMA, databaseSchemaQueryKey(FQN, 'f')],
  [EntityType.GLOSSARY_TERM, glossaryTermQueryKey(FQN, 'f')],
  [EntityType.METRIC, metricQueryKey(FQN, 'f')],
  [EntityType.MLMODEL, mlModelQueryKey(FQN, 'f')],
  [EntityType.PIPELINE, pipelineQueryKey(FQN, 'f')],
  [EntityType.SEARCH_INDEX, searchIndexQueryKey(FQN, 'f')],
  [EntityType.STORED_PROCEDURE, storedProcedureQueryKey(FQN, 'f')],
  [EntityType.TABLE, tableQueryKey(FQN, 'f')],
  [EntityType.TOPIC, topicQueryKey(FQN, 'f')],
];

describe('entity detail query keys', () => {
  it.each(DETAIL_QUERY_KEYS)(
    '%s key starts with [entityType, fqn] so SuggestionsProvider can invalidate it',
    (entityType, queryKey) => {
      expect(queryKey.slice(0, 2)).toEqual([entityType, FQN]);
    }
  );
});
