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

import { EntityTabs, EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { EntityUtilClassBase } from './EntityUtilClassBase';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
  getServiceDetailsPath,
} from './RouterUtils';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';

jest.mock('../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
  getEditWebhookPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getTagsDetailsPath: jest.fn(),
  getGlossaryTermDetailsPath: jest.fn(),
  getUserPath: jest.fn(),
}));

jest.mock('./FqnUtils', () => ({
  getTableFQNFromColumnFQN: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getEntityDetailsPath: jest.fn(),
  getDomainDetailsPath: jest.fn(),
  getSettingPath: jest.fn(),
  getTeamsWithFqnPath: jest.fn(),
  getEditWebhookPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getTagsDetailsPath: jest.fn(),
  getGlossaryTermDetailsPath: jest.fn(),
  getUserPath: jest.fn(),
}));

jest.mock('./TestSuiteUtils', () => ({
  getTestSuiteDetailsPath: jest.fn(),
}));

jest.mock('./TableDropdownOptions', () => ({
  ExtraTableDropdownOptions: jest.fn(),
}));

jest.mock('./TestSuiteUtils', () => ({
  getTestSuiteDetailsPath: jest.fn(),
}));

jest.mock('./Database/Database.util', () => ({
  ExtraDatabaseDropdownOptions: jest.fn(),
}));

jest.mock('./DatabaseSchemaDetailsUtils', () => ({
  ExtraDatabaseSchemaDropdownOptions: jest.fn(),
}));

jest.mock('./DatabaseServiceUtils', () => ({
  ExtraDatabaseServiceDropdownOptions: jest.fn(),
}));
jest.mock('../pages/APICollectionPage/APICollectionPage', () => jest.fn());
jest.mock('../pages/APIEndpointPage/APIEndpointPage', () => jest.fn());
jest.mock('../pages/ContainerPage/ContainerPage', () => jest.fn());
jest.mock('../pages/DashboardDetailsPage/DashboardDetailsPage.component', () =>
  jest.fn()
);
jest.mock('../pages/DatabaseDetailsPage/DatabaseDetailsPage', () => jest.fn());
jest.mock('../pages/DatabaseSchemaPage/DatabaseSchemaPage.component', () =>
  jest.fn()
);
jest.mock('../pages/ChartDetailsPage/ChartDetailsPage.component', () =>
  jest.fn()
);
jest.mock('../pages/DataModelPage/DataModelPage.component', () => jest.fn());
jest.mock('../pages/EntityVersionPage/EntityVersionPage.component', () => ({
  VersionData: jest.fn(),
}));
jest.mock('../pages/MetricsPage/MetricDetailsPage/MetricDetailsPage', () =>
  jest.fn()
);
jest.mock('../pages/MlModelPage/MlModelPage.component', () => jest.fn());
jest.mock('../pages/PipelineDetails/PipelineDetailsPage.component', () =>
  jest.fn()
);
jest.mock('../pages/SearchIndexDetailsPage/SearchIndexDetailsPage', () =>
  jest.fn()
);
jest.mock('../pages/StoredProcedure/StoredProcedurePage', () => jest.fn());
jest.mock('../pages/TableDetailsPageV1/TableDetailsPageV1', () => jest.fn());
jest.mock('../pages/TopicDetails/TopicDetailsPage.component', () => jest.fn());
jest.mock('../pages/DirectoryDetailsPage/DirectoryDetailsPage', () =>
  jest.fn()
);
jest.mock('../pages/FileDetailsPage/FileDetailsPage', () => jest.fn());
jest.mock('../pages/SpreadsheetDetailsPage/SpreadsheetDetailsPage', () =>
  jest.fn()
);
jest.mock('../pages/WorksheetDetailsPage/WorksheetDetailsPage', () =>
  jest.fn()
);

jest.mock('../constants/LeftSidebar.constants', () => ({
  SIDEBAR_NESTED_KEYS: {},
  SIDEBAR_LIST: [],
}));

describe('EntityUtilClassBase', () => {
  let entityUtil: EntityUtilClassBase;

  beforeEach(() => {
    entityUtil = new EntityUtilClassBase();
  });

  it('should return topic details path for topic index type', () => {
    const fqn = 'test.topic';
    entityUtil.getEntityLink(SearchIndex.TOPIC, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TOPIC,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return dashboard details path for dashboard index type', () => {
    const fqn = 'test.dashboard';
    entityUtil.getEntityLink(SearchIndex.DASHBOARD, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DASHBOARD,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return pipeline details path for pipeline index type', () => {
    const fqn = 'test.pipeline';
    entityUtil.getEntityLink(SearchIndex.PIPELINE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.PIPELINE,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return database details path for database EntityType', () => {
    const fqn = 'test.database';
    entityUtil.getEntityLink(EntityType.DATABASE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DATABASE,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return database schema details path for database EntityType', () => {
    const fqn = 'test.database.schema';
    entityUtil.getEntityLink(EntityType.DATABASE_SCHEMA, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.DATABASE_SCHEMA,
      fqn,
      undefined,
      undefined
    );
  });

  it('Should return glossary details path for database EntityType', () => {
    const fqn = 'testingGlossary';
    entityUtil.getEntityLink(EntityType.GLOSSARY, fqn);

    expect(getGlossaryTermDetailsPath).toHaveBeenCalledWith(
      fqn,
      undefined,
      undefined
    );
  });

  it('should return testSuite details path for testSuite EntityType', () => {
    const fqn = 'test.default';
    entityUtil.getEntityLink(EntityType.TEST_SUITE, fqn);

    expect(getTestSuiteDetailsPath).toHaveBeenCalledWith({
      fullyQualifiedName: 'test.default',
      isExecutableTestSuite: undefined,
    });
  });

  it('should return table details path for table index type', () => {
    const fqn = 'test.table';
    entityUtil.getEntityLink(SearchIndex.TABLE, fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return table details path for default case', () => {
    const fqn = 'test.default';
    entityUtil.getEntityLink('default', fqn);

    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });

  it('should return service details path for driveService entity type', () => {
    const fqn = 'test.driveService';
    entityUtil.getEntityLink(EntityType.DRIVE_SERVICE, fqn);

    expect(getServiceDetailsPath).toHaveBeenCalledWith(fqn, 'driveServices');
  });

  it('should return service details path for securityService entity type', () => {
    const fqn = 'test.securityService';
    entityUtil.getEntityLink(EntityType.SECURITY_SERVICE, fqn);

    expect(getServiceDetailsPath).toHaveBeenCalledWith(fqn, 'securityServices');
  });

  it('should route ingestion pipelines to the owning service agents tab', () => {
    const fqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';
    entityUtil.getEntityLink(
      EntityType.INGESTION_PIPELINE,
      fqn,
      undefined,
      undefined,
      undefined,
      undefined,
      'databaseServices',
      'bigquery-beta'
    );

    expect(getServiceDetailsPath).toHaveBeenCalledWith(
      'bigquery-beta',
      'databaseServices',
      EntityTabs.AGENTS
    );
    expect(getEntityDetailsPath).not.toHaveBeenCalled();
  });

  it('should fall through to the default table path for ingestion pipelines without service context', () => {
    // prepareFeedLink and similar callers omit the service category; they must keep the
    // default behaviour rather than produce a service URL built from a pipeline FQN.
    const fqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';
    entityUtil.getEntityLink(EntityType.INGESTION_PIPELINE, fqn);

    expect(getServiceDetailsPath).not.toHaveBeenCalled();
    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });

  it('should accept the singular service entity type as the category', () => {
    // Chat markdown links are model-authored and routinely carry the singular entity type
    // ("databaseService") instead of the plural route segment; both name the same service page.
    const fqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';
    entityUtil.getEntityLink(
      EntityType.INGESTION_PIPELINE,
      fqn,
      undefined,
      undefined,
      undefined,
      undefined,
      'databaseService',
      'bigquery-beta'
    );

    expect(getServiceDetailsPath).toHaveBeenCalledWith(
      'bigquery-beta',
      'databaseServices',
      EntityTabs.AGENTS
    );
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'should fall through to the default table path for the prototype key %s',
    (serviceCategory) => {
      // The category comes from a model-authored href, so a prototype key can reach the
      // reverse lookup; it must not resolve to a truthy non-category value.
      const fqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';
      entityUtil.getEntityLink(
        EntityType.INGESTION_PIPELINE,
        fqn,
        undefined,
        undefined,
        undefined,
        undefined,
        serviceCategory,
        'bigquery-beta'
      );

      expect(getServiceDetailsPath).not.toHaveBeenCalled();
      expect(getEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.TABLE,
        fqn,
        undefined,
        undefined
      );
    }
  );

  it('should fall through to the default table path for an unknown service category', () => {
    // The category is supplied by the caller (chat markdown links carry one). A value that
    // is not a real service category would build a route that matches nothing.
    const fqn = 'bigquery-beta.bigquery-beta-1.7047fd1d';
    entityUtil.getEntityLink(
      EntityType.INGESTION_PIPELINE,
      fqn,
      undefined,
      undefined,
      undefined,
      undefined,
      'Snowflake',
      'bigquery-beta'
    );

    expect(getServiceDetailsPath).not.toHaveBeenCalled();
    expect(getEntityDetailsPath).toHaveBeenCalledWith(
      EntityType.TABLE,
      fqn,
      undefined,
      undefined
    );
  });

  describe('getFqnParts', () => {
    it('should return undefined columnFqn if type is NOT provided', () => {
      const fqn = 'service.database.schema.table';
      const result = entityUtil.getFqnParts(fqn);

      expect(result).toEqual({ entityFqn: fqn, columnFqn: undefined });
    });

    it('should split TABLE FQN correctly (4 parts)', () => {
      const fqn = 'service.database.schema.table.column.nested';
      const result = entityUtil.getFqnParts(fqn, EntityType.TABLE);

      expect(result).toEqual({
        entityFqn: 'service.database.schema.table',
        columnFqn: 'column.nested',
      });
    });

    it('should split API_ENDPOINT FQN correctly (3 parts)', () => {
      const fqn = 'service.collection.endpoint.field';
      const result = entityUtil.getFqnParts(fqn, EntityType.API_ENDPOINT);

      expect(result).toEqual({
        entityFqn: 'service.collection.endpoint',
        columnFqn: 'field',
      });
    });

    it('should split TOPIC FQN correctly (2 parts)', () => {
      const fqn = 'service.topic.field.nested';
      const result = entityUtil.getFqnParts(fqn, EntityType.TOPIC);

      expect(result).toEqual({
        entityFqn: 'service.topic',
        columnFqn: 'field.nested',
      });
    });

    it('should split DASHBOARD_DATA_MODEL FQN correctly (3 parts)', () => {
      const fqn = 'service.dashboard.datamodel.column';
      const result = entityUtil.getFqnParts(
        fqn,
        EntityType.DASHBOARD_DATA_MODEL
      );

      expect(result).toEqual({
        entityFqn: 'service.dashboard.datamodel',
        columnFqn: 'column',
      });
    });

    it('should return full FQN for CONTAINER (variable depth, no column split)', () => {
      const fqn = 'service.container1.container2.container3.container4';
      const result = entityUtil.getFqnParts(fqn, EntityType.CONTAINER);

      expect(result).toEqual({
        entityFqn: fqn,
        columnFqn: undefined,
      });
    });

    it('should return original FQN if parts are insufficient for TABLE', () => {
      const fqn = 'service.database.schema';
      const result = entityUtil.getFqnParts(fqn, EntityType.TABLE);

      // Implementation detail: it initializes entityFqn = fqn, and only changes if length > 4
      expect(result).toEqual({ entityFqn: fqn, columnFqn: undefined });
    });
  });

  describe('getEntityTypes', () => {
    it('should return the list of OSS entity types', () => {
      const types = entityUtil.getEntityTypes();

      expect(types).toEqual(Object.values(EntityType));
      expect(types).toContain(EntityType.TABLE);
      expect(types).toContain(EntityType.GLOSSARY_TERM);
    });

    it('should not contain Collate-only types absent from the enum', () => {
      expect(entityUtil.getEntityTypes()).not.toContain('aiAutomation');
    });
  });

  describe('shouldShowEntityStatus', () => {
    it('shows the status badge for metrics, which run an approval workflow', () => {
      expect(entityUtil.shouldShowEntityStatus(EntityType.METRIC)).toBe(true);
    });

    it('hides it for entities with no approval workflow', () => {
      expect(entityUtil.shouldShowEntityStatus(EntityType.TABLE)).toBe(false);
      expect(entityUtil.shouldShowEntityStatus(EntityType.DASHBOARD)).toBe(
        false
      );
    });
  });
});
