/*
 *  Copyright 2025 Collate.
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

import { ROUTES } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  getBulkEditCSVExportEntityApi,
  getBulkEntityNavigationPath,
  isBulkEditRoute,
} from './EntityBulkEditUtils';

jest.mock('../EntityUtilClassBase', () => ({
  getEntityLink: jest
    .fn()
    .mockImplementation((entityType, fqn, tab, subTab) => {
      let path = `/${entityType}/${fqn}`;
      if (tab) {
        path += `/${tab}`;
      }
      if (subTab) {
        path += `/${subTab}`;
      }

      return path;
    }),
}));

jest.mock('../RouterUtils', () => ({
  getDataQualityPagePath: jest
    .fn()
    .mockImplementation((tab) => `/data-quality/${tab}`),
}));

jest.mock('../../rest/databaseAPI', () => ({
  exportDatabaseDetailsInCSV: jest.fn(),
  exportDatabaseSchemaDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest.fn(),
  exportGlossaryTermsInCSVFormat: jest.fn(),
}));

jest.mock('../../rest/serviceAPI', () => ({
  exportDatabaseServiceDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/tableAPI', () => ({
  exportTableDetailsInCSV: jest.fn(),
}));

jest.mock('../../rest/testAPI', () => ({
  exportTestCasesInCSV: jest.fn(),
}));

describe('EntityBulkEditUtils', () => {
  describe('isBulkEditRoute', () => {
    it('should return true if the pathname includes bulk edit route', () => {
      const pathname = `/some/path${ROUTES.BULK_EDIT_ENTITY}/entity`;

      expect(isBulkEditRoute(pathname)).toBe(true);
    });

    it('should return false if the pathname does not include bulk edit route', () => {
      const pathname = '/some/path/entity';

      expect(isBulkEditRoute(pathname)).toBe(false);
    });
  });

  describe('getBulkEditCSVExportEntityApi', () => {
    it('should return exportDatabaseServiceDetailsInCSV for DATABASE_SERVICE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE_SERVICE);

      expect(result).toBeDefined();
    });

    it('should return exportDatabaseDetailsInCSV for DATABASE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE);

      expect(result).toBeDefined();
    });

    it('should return exportDatabaseSchemaDetailsInCSV for DATABASE_SCHEMA', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.DATABASE_SCHEMA);

      expect(result).toBeDefined();
    });

    it('should return exportGlossaryTermsInCSVFormat for GLOSSARY_TERM', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.GLOSSARY_TERM);

      expect(result).toBeDefined();
    });

    it('should return exportGlossaryInCSVFormat for GLOSSARY', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.GLOSSARY);

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for TABLE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.TABLE);

      expect(result).toBeDefined();
    });

    it('should return exportTestCasesInCSV for TEST_CASE', () => {
      const result = getBulkEditCSVExportEntityApi(EntityType.TEST_CASE);

      expect(result).toBeDefined();
    });

    it('should return exportTableDetailsInCSV for unknown entity type', () => {
      const result = getBulkEditCSVExportEntityApi(
        'UNKNOWN_TYPE' as EntityType
      );

      expect(result).toBeDefined();
    });
  });

  describe('getBulkEntityNavigationPath', () => {
    it('should return data quality page path for TEST_CASE with wildcard fqn', () => {
      const result = getBulkEntityNavigationPath(EntityType.TEST_CASE, '*');

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return TABLE profiler path for TEST_CASE with TABLE source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.table.fqn',
        EntityType.TABLE
      );

      expect(result).toBe('/table/test.table.fqn/profiler/data-quality');
    });

    it('should return TEST_SUITE path for TEST_CASE with TEST_SUITE source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.suite.fqn',
        EntityType.TEST_SUITE
      );

      expect(result).toBe('/testSuite/test.suite.fqn');
    });

    it('should return data quality page path for TEST_CASE with no source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.case.fqn'
      );

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return data quality page path for TEST_CASE with unknown source entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TEST_CASE,
        'test.case.fqn',
        'UNKNOWN_TYPE' as EntityType
      );

      expect(result).toBe('/data-quality/test-cases');
    });

    it('should return entity link for non-TEST_CASE entity types', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.TABLE,
        'sample.table.fqn'
      );

      expect(result).toBe('/table/sample.table.fqn');
    });

    it('should return entity link for GLOSSARY entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.GLOSSARY,
        'sample.glossary.fqn'
      );

      expect(result).toBe('/glossary/sample.glossary.fqn');
    });

    it('should return entity link for DATABASE entity type', () => {
      const result = getBulkEntityNavigationPath(
        EntityType.DATABASE,
        'sample.database.fqn'
      );

      expect(result).toBe('/database/sample.database.fqn');
    });
  });
});
