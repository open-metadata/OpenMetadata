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
import { EntityType } from '../enums/entity.enum';
import { EntityReference } from '../generated/entity/type';
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

const API_COLLECTION = {
  id: 'api-collection-id',
  name: 'sample-collection',
  displayName: 'Sample Collection',
  fullyQualifiedName: 'sample-service.sample-collection',
};

// Distinct ancestor containers so the CONTAINER trail actually exercises the
// parent-mapping branch of getBreadcrumbForEntityWithParent.
const PARENT_CONTAINERS: EntityReference[] = [
  {
    id: 'parent-container-1-id',
    type: 'container',
    name: 'parent-container-1',
    displayName: 'Parent Container 1',
    fullyQualifiedName: 'sample-service.parent-container-1',
  },
  {
    id: 'parent-container-2-id',
    type: 'container',
    name: 'parent-container-2',
    displayName: 'Parent Container 2',
    fullyQualifiedName: 'sample-service.parent-container-1.parent-container-2',
  },
];

const ENTITY_NAME = 'Sample Entity';
const ENTITY_RAW_NAME = 'sample-entity';

// A superset payload: each builder reads only the ancestor fields relevant to
// its entity type. Distinct ancestor names mean a correct builder yields unique
// crumbs; a builder that duplicated an ancestor would break the uniqueness
// assertion below.
const buildDataAsset = (entityType: EntityType) => ({
  id: 'entity-id',
  name: ENTITY_RAW_NAME,
  displayName: ENTITY_NAME,
  fullyQualifiedName:
    'sample-service.sample-database.sample-schema.sample-entity',
  entityType,
  service: SERVICE,
  database: DATABASE,
  databaseSchema: DATABASE_SCHEMA,
  apiCollection: API_COLLECTION,
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

// The ancestor crumbs produced by the builder, before DataAssetsHeader appends
// the current entity. Only the CONTAINER builder consumes parentContainers.
const getAncestorCrumbNames = (entityType: EntityType): string[] => {
  const { breadcrumbs } = getDataAssetsHeaderInfo(
    entityType,
    buildDataAsset(entityType) as never,
    ENTITY_NAME,
    entityType === EntityType.CONTAINER
      ? PARENT_CONTAINERS
      : ([] as EntityReference[])
  );

  return breadcrumbs
    .map((crumb) => crumb.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));
};

describe('getDataAssetsHeaderInfo breadcrumbs', () => {
  it.each(ENTITY_TYPES)(
    'should build non-empty, unique ancestor crumbs for %s',
    (_, entityType) => {
      const names = getAncestorCrumbNames(entityType);

      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
    }
  );

  it.each(ENTITY_TYPES)(
    'should not include the current entity in the %s ancestor crumbs',
    (_, entityType) => {
      // DataAssetsHeader appends the current entity after these ancestor crumbs,
      // so the builder must not already emit it under either its display name or
      // its raw name - otherwise the rendered trail shows the entity twice.
      const names = getAncestorCrumbNames(entityType);

      expect(names).not.toContain(ENTITY_NAME);
      expect(names).not.toContain(ENTITY_RAW_NAME);
    }
  );
});
