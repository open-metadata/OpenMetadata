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

import { DataAssetsHeaderProps } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { EntityType } from '../enums/entity.enum';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { getDataAssetsHeaderInfo } from './DataAssetsHeader.utils';
import { getBreadcrumbForMetric } from './EntityGovernanceBreadcrumbUtils';
import { getEntityName } from './EntityNameUtils';
import {
  getBreadcrumbForDatabase,
  getBreadcrumbForDatabaseSchema,
} from './EntityServiceBreadcrumbUtils';

const buildService = (type: string) => ({
  id: 'svc-id',
  name: 'svc',
  type,
  fullyQualifiedName: 'svc',
});

const databaseRef = { id: 'db-id', name: 'db', fullyQualifiedName: 'svc.db' };
const schemaRef = {
  id: 'schema-id',
  name: 'schema',
  fullyQualifiedName: 'svc.db.schema',
};
const apiCollectionRef = {
  id: 'coll-id',
  name: 'coll',
  fullyQualifiedName: 'svc.coll',
};

const HEADER_ENTITY_CASES: Array<{
  entityType: DataAssetsHeaderProps['entityType'];
  entity: Record<string, unknown>;
}> = [
  {
    entityType: EntityType.TABLE,
    entity: {
      name: 'tbl',
      fullyQualifiedName: 'svc.db.schema.tbl',
      service: buildService('databaseService'),
      database: databaseRef,
      databaseSchema: schemaRef,
    },
  },
  {
    entityType: EntityType.STORED_PROCEDURE,
    entity: {
      name: 'sp',
      fullyQualifiedName: 'svc.db.schema.sp',
      service: buildService('databaseService'),
      database: databaseRef,
      databaseSchema: schemaRef,
    },
  },
  {
    entityType: EntityType.DATABASE,
    entity: {
      name: 'db',
      fullyQualifiedName: 'svc.db',
      service: buildService('databaseService'),
    },
  },
  {
    entityType: EntityType.DATABASE_SCHEMA,
    entity: {
      name: 'schema',
      fullyQualifiedName: 'svc.db.schema',
      service: buildService('databaseService'),
      database: databaseRef,
    },
  },
  {
    entityType: EntityType.DATABASE_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.METRIC,
    entity: { name: 'metric1', fullyQualifiedName: 'metric1' },
  },
  {
    entityType: EntityType.CHART,
    entity: {
      name: 'chart1',
      fullyQualifiedName: 'svc.chart1',
      service: buildService('dashboardService'),
    },
  },
  {
    entityType: EntityType.TOPIC,
    entity: {
      name: 'topic1',
      fullyQualifiedName: 'svc.topic1',
      service: buildService('messagingService'),
    },
  },
  {
    entityType: EntityType.DASHBOARD,
    entity: {
      name: 'dashboard1',
      fullyQualifiedName: 'svc.dashboard1',
      service: buildService('dashboardService'),
    },
  },
  {
    entityType: EntityType.PIPELINE,
    entity: {
      name: 'pipeline1',
      fullyQualifiedName: 'svc.pipeline1',
      service: buildService('pipelineService'),
    },
  },
  {
    entityType: EntityType.MLMODEL,
    entity: {
      name: 'mlmodel1',
      fullyQualifiedName: 'svc.mlmodel1',
      service: buildService('mlmodelService'),
    },
  },
  {
    entityType: EntityType.DASHBOARD_DATA_MODEL,
    entity: {
      name: 'datamodel1',
      fullyQualifiedName: 'svc.datamodel1',
      service: buildService('dashboardService'),
    },
  },
  {
    entityType: EntityType.SEARCH_INDEX,
    entity: {
      name: 'searchindex1',
      fullyQualifiedName: 'svc.searchindex1',
      service: buildService('searchService'),
    },
  },
  {
    entityType: EntityType.CONTAINER,
    entity: {
      name: 'container1',
      fullyQualifiedName: 'svc.container1',
      service: buildService('storageService'),
    },
  },
  {
    entityType: EntityType.DIRECTORY,
    entity: {
      name: 'directory1',
      fullyQualifiedName: 'svc.directory1',
      service: buildService('driveService'),
    },
  },
  {
    entityType: EntityType.FILE,
    entity: {
      name: 'file1',
      fullyQualifiedName: 'svc.file1',
      service: buildService('driveService'),
    },
  },
  {
    entityType: EntityType.SPREADSHEET,
    entity: {
      name: 'spreadsheet1',
      fullyQualifiedName: 'svc.spreadsheet1',
      service: buildService('driveService'),
    },
  },
  {
    entityType: EntityType.WORKSHEET,
    entity: {
      name: 'worksheet1',
      fullyQualifiedName: 'svc.worksheet1',
      service: buildService('driveService'),
    },
  },
  {
    entityType: EntityType.API_COLLECTION,
    entity: {
      name: 'collection1',
      fullyQualifiedName: 'svc.collection1',
      service: buildService('apiService'),
    },
  },
  {
    entityType: EntityType.API_ENDPOINT,
    entity: {
      name: 'endpoint1',
      fullyQualifiedName: 'svc.coll.endpoint1',
      service: buildService('apiService'),
      apiCollection: apiCollectionRef,
    },
  },
  {
    entityType: EntityType.API_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.DASHBOARD_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.MESSAGING_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.PIPELINE_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.MLMODEL_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.METADATA_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.STORAGE_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.SEARCH_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.SECURITY_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
  {
    entityType: EntityType.DRIVE_SERVICE,
    entity: { name: 'svc', fullyQualifiedName: 'svc' },
  },
];

describe('breadcrumb builders gate the current entity behind includeCurrent', () => {
  const service = {
    id: 'svc-id',
    name: 'svc',
    type: 'databaseService',
    fullyQualifiedName: 'svc',
  };
  const database = {
    id: 'db-id',
    name: 'db',
    fullyQualifiedName: 'svc.db',
    service,
  } as unknown as Database;
  const databaseSchema = {
    id: 'schema-id',
    name: 'schema',
    fullyQualifiedName: 'svc.db.schema',
    service,
    database: { id: 'db-id', name: 'db', fullyQualifiedName: 'svc.db' },
  } as unknown as DatabaseSchema;

  it('should exclude the current database by default', () => {
    const crumbs = getBreadcrumbForDatabase(database);

    expect(crumbs.some((crumb) => crumb.name === 'db')).toBe(false);
  });

  it('should append the current database when includeCurrent is true', () => {
    const crumbs = getBreadcrumbForDatabase(database, true);

    expect(crumbs[crumbs.length - 1].name).toBe('db');
  });

  it('should exclude the current schema by default', () => {
    const crumbs = getBreadcrumbForDatabaseSchema(databaseSchema);

    expect(crumbs.some((crumb) => crumb.name === 'schema')).toBe(false);
  });

  it('should append the current schema when includeCurrent is true', () => {
    const crumbs = getBreadcrumbForDatabaseSchema(databaseSchema, true);

    expect(crumbs[crumbs.length - 1].name).toBe('schema');
  });

  it('should exclude the current metric by default', () => {
    const crumbs = getBreadcrumbForMetric('metric1');

    expect(crumbs.some((crumb) => crumb.name === 'metric1')).toBe(false);
  });

  it('should append the current metric when includeCurrent is true', () => {
    const crumbs = getBreadcrumbForMetric('metric1', true);

    expect(crumbs[crumbs.length - 1].name).toBe('metric1');
  });
});

describe('DataAssetsHeader breadcrumbs - builders are ancestor-only for every entity', () => {
  it.each(HEADER_ENTITY_CASES)(
    'should not include the current entity in breadcrumbs for $entityType',
    ({ entityType, entity }) => {
      const dataAsset = entity as unknown as DataAssetsHeaderProps['dataAsset'];
      const entityName = getEntityName(dataAsset);
      const { breadcrumbs } = getDataAssetsHeaderInfo(
        entityType,
        dataAsset,
        entityName,
        []
      );

      const currentEntityNames = new Set([entityName, entity.name as string]);
      const currentEntityCrumbs = breadcrumbs.filter((crumb) =>
        currentEntityNames.has(crumb.name)
      );

      expect(currentEntityCrumbs).toHaveLength(0);
    }
  );
});
