/*
 *  Copyright 2023 Collate.
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

import { DataAssetsHeaderProps } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { TeamCSVRecord } from '../../components/Settings/Team/TeamImportResult/TeamImportResult.interface';
import { EntityType } from '../../enums/entity.enum';
import { MOCK_CSV_GLOSSARY_DATA } from '../../mocks/Glossary.mock';
import { MOCK_CSV_TEAM_DATA } from '../../mocks/Teams.mock';
import {
  importEntityInCSVFormat,
  importGlossaryInCSVFormat,
  importGlossaryTermInCSVFormat,
  importServiceInCSVFormat,
  importTestCaseInCSVFormat,
} from '../../rest/importExportAPI';
import {
  getBulkEntityBreadcrumbList,
  getImportedEntityType,
  getImportValidateAPIEntityType,
  parseCSV,
  validateCsvString,
} from './EntityImportUtils';

// Mock dependencies
jest.mock('../../rest/importExportAPI');
jest.mock('../EntityUtils', () => ({
  getEntityBreadcrumbs: jest.fn((entity) => [
    { name: 'Parent', url: '/parent', activeTitle: false },
    { name: entity.name, url: `/entity/${entity.fullyQualifiedName}` },
  ]),
  getEntityName: jest.fn((entity) => entity.name),
}));
jest.mock('../RouterUtils', () => ({
  getGlossaryPath: jest.fn((fqn) => (fqn ? `/glossary/${fqn}` : '/glossary')),
}));
jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key) => key),
  },
}));

describe('EntityImportUtils', () => {
  describe('parseCSV', () => {
    it('should parse team CSV data correctly', () => {
      const teamResult = parseCSV<TeamCSVRecord>(MOCK_CSV_TEAM_DATA.rowData);

      expect(teamResult).toStrictEqual(MOCK_CSV_TEAM_DATA.parseData);
    });

    it('should parse glossary CSV data correctly', () => {
      const glossaryResult = parseCSV<TeamCSVRecord>(
        MOCK_CSV_GLOSSARY_DATA.rowData
      );

      expect(glossaryResult).toStrictEqual(MOCK_CSV_GLOSSARY_DATA.parseData);
    });

    it('should return empty array for empty CSV data', () => {
      const result = parseCSV<TeamCSVRecord>([]);

      expect(result).toEqual([]);
    });

    it('should handle CSV with only headers', () => {
      const csvData = [['header1', 'header2', 'header3']];
      const result = parseCSV<Record<string, unknown>>(csvData);

      expect(result).toEqual([]);
    });

    it('should handle CSV with missing values', () => {
      const csvData = [
        ['name', 'email', 'role'],
        ['John', 'john@example.com'],
        ['Jane', '', 'admin'],
      ];
      const result = parseCSV<Record<string, unknown>>(csvData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John',
        email: 'john@example.com',
        role: undefined,
      });
      expect(result[1]).toEqual({ name: 'Jane', email: '', role: 'admin' });
    });
  });

  describe('getImportedEntityType', () => {
    it('should return DATABASE for DATABASE_SERVICE', () => {
      const result = getImportedEntityType(EntityType.DATABASE_SERVICE);

      expect(result).toBe(EntityType.DATABASE);
    });

    it('should return DATABASE_SCHEMA for DATABASE', () => {
      const result = getImportedEntityType(EntityType.DATABASE);

      expect(result).toBe(EntityType.DATABASE_SCHEMA);
    });

    it('should return TABLE for DATABASE_SCHEMA', () => {
      const result = getImportedEntityType(EntityType.DATABASE_SCHEMA);

      expect(result).toBe(EntityType.TABLE);
    });

    it('should return same entity type for other types', () => {
      expect(getImportedEntityType(EntityType.TABLE)).toBe(EntityType.TABLE);
      expect(getImportedEntityType(EntityType.GLOSSARY)).toBe(
        EntityType.GLOSSARY
      );
      expect(getImportedEntityType(EntityType.TEST_CASE)).toBe(
        EntityType.TEST_CASE
      );
    });
  });

  describe('getBulkEntityBreadcrumbList', () => {
    const mockEntity = {
      name: 'Test Entity',
      fullyQualifiedName: 'test.entity.fqn',
    };

    it('should return breadcrumbs for GLOSSARY_TERM with import', () => {
      const result = getBulkEntityBreadcrumbList(
        EntityType.GLOSSARY_TERM,
        mockEntity as DataAssetsHeaderProps['dataAsset'],
        false
      );

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('label.glossary-plural');
      expect(result[0].url).toBe('/glossary');
      expect(result[1].name).toBe('Test Entity');
      expect(result[1].url).toBe('/glossary/test.entity.fqn');
      expect(result[2].name).toBe('label.import');
      expect(result[2].activeTitle).toBe(true);
    });

    it('should return breadcrumbs for GLOSSARY with bulk edit', () => {
      const result = getBulkEntityBreadcrumbList(
        EntityType.GLOSSARY,
        mockEntity as DataAssetsHeaderProps['dataAsset'],
        true
      );

      expect(result).toHaveLength(3);
      expect(result[2].name).toBe('label.bulk-edit');
      expect(result[2].activeTitle).toBe(true);
    });

    it('should return breadcrumbs for non-glossary entity types', () => {
      const result = getBulkEntityBreadcrumbList(
        EntityType.TABLE,
        mockEntity as DataAssetsHeaderProps['dataAsset'],
        false
      );

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Parent');
      expect(result[1].name).toBe('Test Entity');
      expect(result[2].name).toBe('label.import');
    });

    it('should include additional breadcrumbs when provided', () => {
      const additionalBreadcrumb = [
        { name: 'Extra', url: '/extra', activeTitle: false },
      ];
      const result = getBulkEntityBreadcrumbList(
        EntityType.TABLE,
        mockEntity as DataAssetsHeaderProps['dataAsset'],
        false,
        additionalBreadcrumb
      );

      expect(result).toHaveLength(4);
      expect(result[2].name).toBe('Extra');
      expect(result[3].name).toBe('label.import');
    });
  });

  describe('getImportValidateAPIEntityType', () => {
    it('should return importServiceInCSVFormat for DATABASE_SERVICE', () => {
      const result = getImportValidateAPIEntityType(
        EntityType.DATABASE_SERVICE
      );

      expect(result).toBe(importServiceInCSVFormat);
    });

    it('should return importGlossaryTermInCSVFormat for GLOSSARY_TERM', () => {
      const result = getImportValidateAPIEntityType(EntityType.GLOSSARY_TERM);

      expect(result).toBe(importGlossaryTermInCSVFormat);
    });

    it('should return importGlossaryInCSVFormat for GLOSSARY', () => {
      const result = getImportValidateAPIEntityType(EntityType.GLOSSARY);

      expect(result).toBe(importGlossaryInCSVFormat);
    });

    it('should return importTestCaseInCSVFormat for TEST_CASE', () => {
      const result = getImportValidateAPIEntityType(EntityType.TEST_CASE);

      expect(result).toBe(importTestCaseInCSVFormat);
    });

    it('should return importEntityInCSVFormat for other entity types', () => {
      expect(getImportValidateAPIEntityType(EntityType.TABLE)).toBe(
        importEntityInCSVFormat
      );
      expect(getImportValidateAPIEntityType(EntityType.DATABASE)).toBe(
        importEntityInCSVFormat
      );
      expect(getImportValidateAPIEntityType(EntityType.DASHBOARD)).toBe(
        importEntityInCSVFormat
      );
    });
  });

  describe('validateCsvString', () => {
    const mockApiResponse = { status: 'success', data: [] };

    beforeEach(() => {
      (importEntityInCSVFormat as jest.Mock).mockResolvedValue(mockApiResponse);
      (importServiceInCSVFormat as jest.Mock).mockResolvedValue(
        mockApiResponse
      );
      (importGlossaryInCSVFormat as jest.Mock).mockResolvedValue(
        mockApiResponse
      );
      (importGlossaryTermInCSVFormat as jest.Mock).mockResolvedValue(
        mockApiResponse
      );
      (importTestCaseInCSVFormat as jest.Mock).mockResolvedValue(
        mockApiResponse
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call correct API for TABLE entity type with import mode', async () => {
      const csvData = 'name,description\nTable1,Test table';
      const fqn = 'database.schema.table';

      await validateCsvString(csvData, EntityType.TABLE, fqn, false);

      expect(importEntityInCSVFormat).toHaveBeenCalledWith({
        entityType: EntityType.TABLE,
        name: fqn,
        data: csvData,
        dryRun: true,
        recursive: true,
      });
    });

    it('should call API with recursive false for bulk edit mode', async () => {
      const csvData = 'name,description\nTable1,Test table';
      const fqn = 'database.schema.table';

      await validateCsvString(csvData, EntityType.TABLE, fqn, true);

      expect(importEntityInCSVFormat).toHaveBeenCalledWith({
        entityType: EntityType.TABLE,
        name: fqn,
        data: csvData,
        dryRun: true,
        recursive: false,
      });
    });

    it('should call importServiceInCSVFormat for DATABASE_SERVICE', async () => {
      const csvData = 'name,description\nService1,Test service';
      const fqn = 'service.fqn';

      await validateCsvString(csvData, EntityType.DATABASE_SERVICE, fqn, false);

      expect(importServiceInCSVFormat).toHaveBeenCalledWith({
        entityType: EntityType.DATABASE_SERVICE,
        name: fqn,
        data: csvData,
        dryRun: true,
        recursive: true,
      });
    });

    it('should call importGlossaryTermInCSVFormat for GLOSSARY_TERM', async () => {
      const csvData = 'name,description\nTerm1,Test term';
      const fqn = 'glossary.term.fqn';

      await validateCsvString(csvData, EntityType.GLOSSARY_TERM, fqn, false);

      expect(importGlossaryTermInCSVFormat).toHaveBeenCalledWith({
        entityType: EntityType.GLOSSARY_TERM,
        name: fqn,
        data: csvData,
        dryRun: true,
        recursive: true,
      });
    });

    it('should return API response', async () => {
      const csvData = 'name,description\nTable1,Test table';
      const fqn = 'database.schema.table';

      const result = await validateCsvString(
        csvData,
        EntityType.TABLE,
        fqn,
        false
      );

      expect(result).toEqual(mockApiResponse);
    });
  });
});
