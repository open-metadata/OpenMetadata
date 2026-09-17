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
import { EntityReference } from '../generated/entity/type';
import { EntityType } from '../enums/entity.enum';
import { getDataAssetsHeaderInfo } from './DataAssetsHeader.utils';

// The DataAssetsHeader breadcrumb must never render the same crumb twice. This
// invariant was previously covered by 19 per-entity Playwright tests
// (Pages/EntityHeaderBreadcrumb.spec.ts) that created a real entity, opened its
// page, and asserted crumb uniqueness. The crumbs are built purely by
// getDataAssetsHeaderInfo, so the matrix belongs here.

const SERVICE = {
  id: 'service-id',
  type: 'databaseService',
  name: 'sample-service',
  displayName: 'Sample Service',
  fullyQualifiedName: 'sample-service',
};

const DATABASE = {
  id: 'database-id',
  name: 'sample-database',
  displayName: 'Sample Database',
  fullyQualifiedName: 'sample-service.sample-database',
};

const DATABASE_SCHEMA = {
  id: 'schema-id',
  name: 'sample-schema',
  displayName: 'Sample Schema',
  fullyQualifiedName: 'sample-service.sample-database.sample-schema',
};

const ENTITY_NAME = 'Sample Entity';

// A superset payload: each builder reads only the ancestor fields relevant to
// its entity type. Distinct ancestor names mean a correct builder yields unique
// crumbs; a builder that duplicated an ancestor or the current entity would
// break the uniqueness assertion below.
const buildDataAsset = (entityType: EntityType) => ({
  id: 'entity-id',
  name: 'sample-entity',
  displayName: ENTITY_NAME,
  fullyQualifiedName:
    'sample-service.sample-database.sample-schema.sample-entity',
  entityType,
  service: SERVICE,
  database: DATABASE,
  databaseSchema: DATABASE_SCHEMA,
});

const ENTITY_TYPES: Array<[string, EntityType]> = [
  ['Database', EntityType.DATABASE],
  ['Database Schema', EntityType.DATABASE_SCHEMA],
  ['Metric', EntityType.METRIC],
  ['Table', EntityType.TABLE],
  ['Stored Procedure', EntityType.STORED_PROCEDURE],
  ['Dashboard', EntityType.DASHBOARD],
  ['Pipeline', EntityType.PIPELINE],
  ['Topic', EntityType.TOPIC],
  ['Ml Model', EntityType.MLMODEL],
  ['Container', EntityType.CONTAINER],
  ['Search Index', EntityType.SEARCH_INDEX],
  ['Dashboard Data Model', EntityType.DASHBOARD_DATA_MODEL],
  ['Chart', EntityType.CHART],
  ['Api Collection', EntityType.API_COLLECTION],
  ['Api Endpoint', EntityType.API_ENDPOINT],
  ['Directory', EntityType.DIRECTORY],
  ['File', EntityType.FILE],
  ['Spreadsheet', EntityType.SPREADSHEET],
  ['Worksheet', EntityType.WORKSHEET],
];

const getRenderedCrumbLabels = (entityType: EntityType): string[] => {
  const { breadcrumbs } = getDataAssetsHeaderInfo(
    entityType,
    buildDataAsset(entityType) as never,
    ENTITY_NAME,
    [] as EntityReference[]
  );

  // Mirrors DataAssetsHeader's breadcrumbItems: the ancestor crumbs followed by
  // the current entity, dropping any empty labels the way the rendered list does.
  return [...breadcrumbs.map((crumb) => crumb.name), ENTITY_NAME]
    .map((label) => label?.trim())
    .filter((label): label is string => Boolean(label && label.length > 0));
};

describe('getDataAssetsHeaderInfo breadcrumb uniqueness', () => {
  it.each(ENTITY_TYPES)(
    'should build unique, non-empty crumbs for %s',
    (_, entityType) => {
      const labels = getRenderedCrumbLabels(entityType);

      expect(labels.length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(labels.length);
    }
  );

  it.each(ENTITY_TYPES)(
    'should end the %s trail with the current entity exactly once',
    (_, entityType) => {
      const labels = getRenderedCrumbLabels(entityType);

      expect(labels[labels.length - 1]).toBe(ENTITY_NAME);
      expect(labels.filter((label) => label === ENTITY_NAME)).toHaveLength(1);
    }
  );
});
