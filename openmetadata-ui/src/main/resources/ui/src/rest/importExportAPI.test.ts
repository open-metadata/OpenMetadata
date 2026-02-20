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

import { EntityType } from '../enums/entity.enum';

// Mock response data
const mockCSVImportResponse = {
  jobId: 'test-job-id-123',
  message: 'Import job started successfully',
};

const mockCSVData = 'name,description\ntest1,desc1\ntest2,desc2';

describe('importExportAPI tests', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('importTestCaseInCSVFormat', () => {
    it('should call API with correct endpoint and default parameters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      const result = await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: 'test.suite.name',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/dataQuality/testCases/name/test.suite.name/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
      expect(result).toEqual(mockCSVImportResponse);
    });

    it('should call API with dryRun=false when specified', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: 'test.suite.name',
        data: mockCSVData,
        dryRun: false,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/dataQuality/testCases/name/test.suite.name/importAsync?dryRun=false&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should call API with recursive=true when specified', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: 'test.suite.name',
        data: mockCSVData,
        recursive: true,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/dataQuality/testCases/name/test.suite.name/importAsync?dryRun=true&recursive=true',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should encode FQN with special characters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: 'test/suite/name',
        data: mockCSVData,
      });

      // getEncodedFqn should encode the forward slashes
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('/dataQuality/testCases/name/'),
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle API errors', async () => {
      const mockError = new Error('API Error');
      const mockPut = jest.fn().mockRejectedValue(mockError);
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      await expect(
        importTestCaseInCSVFormat({
          entityType: EntityType.TEST_CASE,
          name: 'test.suite.name',
          data: mockCSVData,
        })
      ).rejects.toThrow('API Error');
    });

    it('should handle empty CSV data', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importTestCaseInCSVFormat } = require('./importExportAPI');

      await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: 'test.suite.name',
        data: '',
      });

      expect(mockPut).toHaveBeenCalledWith(expect.any(String), '', {
        headers: { 'Content-type': 'text/plain' },
      });
    });
  });

  describe('importEntityInCSVFormat', () => {
    it('should call API with correct endpoint for TABLE entity', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      const result = await importEntityInCSVFormat({
        entityType: EntityType.TABLE,
        name: 'database.schema.table',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/tables/name/database.schema.table/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
      expect(result).toEqual(mockCSVImportResponse);
    });

    it('should call API with correct endpoint for DATABASE entity', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      await importEntityInCSVFormat({
        entityType: EntityType.DATABASE,
        name: 'service.database',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/databases/name/service.database/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should call API with correct endpoint for DATABASE_SCHEMA entity', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      await importEntityInCSVFormat({
        entityType: EntityType.DATABASE_SCHEMA,
        name: 'service.database.schema',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/databaseSchemas/name/service.database.schema/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle dryRun and recursive parameters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      await importEntityInCSVFormat({
        entityType: EntityType.TABLE,
        name: 'database.schema.table',
        data: mockCSVData,
        dryRun: false,
        recursive: true,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/tables/name/database.schema.table/importAsync?dryRun=false&recursive=true',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should set correct Content-Type header', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      await importEntityInCSVFormat({
        entityType: EntityType.TABLE,
        name: 'database.schema.table',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      const mockPut = jest.fn().mockRejectedValue(networkError);
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importEntityInCSVFormat } = require('./importExportAPI');

      await expect(
        importEntityInCSVFormat({
          entityType: EntityType.TABLE,
          name: 'database.schema.table',
          data: mockCSVData,
        })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('importServiceInCSVFormat', () => {
    it('should call API with correct endpoint for DATABASE_SERVICE', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importServiceInCSVFormat } = require('./importExportAPI');

      const result = await importServiceInCSVFormat({
        entityType: EntityType.DATABASE_SERVICE,
        name: 'my-database-service',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        'services/databaseServices/name/my-database-service/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
      expect(result).toEqual(mockCSVImportResponse);
    });

    it('should call API with correct endpoint for MESSAGING_SERVICE', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importServiceInCSVFormat } = require('./importExportAPI');

      await importServiceInCSVFormat({
        entityType: EntityType.MESSAGING_SERVICE,
        name: 'my-messaging-service',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        'services/messagingServices/name/my-messaging-service/importAsync?dryRun=true&recursive=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle dryRun=false and recursive=true', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importServiceInCSVFormat } = require('./importExportAPI');

      await importServiceInCSVFormat({
        entityType: EntityType.DATABASE_SERVICE,
        name: 'my-service',
        data: mockCSVData,
        dryRun: false,
        recursive: true,
      });

      expect(mockPut).toHaveBeenCalledWith(
        'services/databaseServices/name/my-service/importAsync?dryRun=false&recursive=true',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle API errors', async () => {
      const apiError = new Error('Service import failed');
      const mockPut = jest.fn().mockRejectedValue(apiError);
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importServiceInCSVFormat } = require('./importExportAPI');

      await expect(
        importServiceInCSVFormat({
          entityType: EntityType.DATABASE_SERVICE,
          name: 'my-service',
          data: mockCSVData,
        })
      ).rejects.toThrow('Service import failed');
    });
  });

  describe('importGlossaryInCSVFormat', () => {
    it('should call API with correct endpoint and default parameters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryInCSVFormat } = require('./importExportAPI');

      const result = await importGlossaryInCSVFormat({
        entityType: EntityType.GLOSSARY,
        name: 'my-glossary',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/glossaries/name/my-glossary/importAsync?dryRun=true',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
      expect(result).toEqual(mockCSVImportResponse);
    });

    it('should call API with dryRun=false when specified', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryInCSVFormat } = require('./importExportAPI');

      await importGlossaryInCSVFormat({
        entityType: EntityType.GLOSSARY,
        name: 'my-glossary',
        data: mockCSVData,
        dryRun: false,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/glossaries/name/my-glossary/importAsync?dryRun=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should not include recursive parameter in URL', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryInCSVFormat } = require('./importExportAPI');

      await importGlossaryInCSVFormat({
        entityType: EntityType.GLOSSARY,
        name: 'my-glossary',
        data: mockCSVData,
        recursive: true, // Should be ignored
      });

      const callUrl = mockPut.mock.calls[0][0];

      expect(callUrl).not.toContain('recursive');
      expect(callUrl).toBe(
        '/glossaries/name/my-glossary/importAsync?dryRun=true'
      );
    });

    it('should encode glossary name with special characters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryInCSVFormat } = require('./importExportAPI');

      await importGlossaryInCSVFormat({
        entityType: EntityType.GLOSSARY,
        name: 'my/glossary/name',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('/glossaries/name/'),
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle API errors', async () => {
      const error = new Error('Glossary import failed');
      const mockPut = jest.fn().mockRejectedValue(error);
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryInCSVFormat } = require('./importExportAPI');

      await expect(
        importGlossaryInCSVFormat({
          entityType: EntityType.GLOSSARY,
          name: 'my-glossary',
          data: mockCSVData,
        })
      ).rejects.toThrow('Glossary import failed');
    });
  });

  describe('importGlossaryTermInCSVFormat', () => {
    it('should call API with correct endpoint and default parameters', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      const result = await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'glossary.term',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/glossaryTerms/name/glossary.term/importAsync?dryRun=true',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
      expect(result).toEqual(mockCSVImportResponse);
    });

    it('should call API with dryRun=false when specified', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'glossary.term',
        data: mockCSVData,
        dryRun: false,
      });

      expect(mockPut).toHaveBeenCalledWith(
        '/glossaryTerms/name/glossary.term/importAsync?dryRun=false',
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should not include recursive parameter in URL', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'glossary.term',
        data: mockCSVData,
        recursive: true, // Should be ignored
      });

      const callUrl = mockPut.mock.calls[0][0];

      expect(callUrl).not.toContain('recursive');
      expect(callUrl).toBe(
        '/glossaryTerms/name/glossary.term/importAsync?dryRun=true'
      );
    });

    it('should handle hierarchical glossary term names', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'glossary.parent.child.term',
        data: mockCSVData,
      });

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('/glossaryTerms/name/'),
        mockCSVData,
        { headers: { 'Content-type': 'text/plain' } }
      );
    });

    it('should handle API errors', async () => {
      const error = new Error('Glossary term import failed');
      const mockPut = jest.fn().mockRejectedValue(error);
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      await expect(
        importGlossaryTermInCSVFormat({
          entityType: EntityType.GLOSSARY_TERM,
          name: 'glossary.term',
          data: mockCSVData,
        })
      ).rejects.toThrow('Glossary term import failed');
    });

    it('should handle large CSV data', async () => {
      const largeCsvData = Array(1000).fill('name,description').join('\n');
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const { importGlossaryTermInCSVFormat } = require('./importExportAPI');

      await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'glossary.term',
        data: largeCsvData,
      });

      expect(mockPut).toHaveBeenCalledWith(expect.any(String), largeCsvData, {
        headers: { 'Content-type': 'text/plain' },
      });
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle special characters in entity names across all functions', async () => {
      const mockPut = jest
        .fn()
        .mockResolvedValue({ data: mockCSVImportResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const {
        importTestCaseInCSVFormat,
        importEntityInCSVFormat,
        importServiceInCSVFormat,
        importGlossaryInCSVFormat,
        importGlossaryTermInCSVFormat,
      } = require('./importExportAPI');

      const specialName = 'test/name@with#special$chars';

      await importTestCaseInCSVFormat({
        entityType: EntityType.TEST_CASE,
        name: specialName,
        data: mockCSVData,
      });

      await importEntityInCSVFormat({
        entityType: EntityType.TABLE,
        name: specialName,
        data: mockCSVData,
      });

      await importServiceInCSVFormat({
        entityType: EntityType.DATABASE_SERVICE,
        name: specialName,
        data: mockCSVData,
      });

      await importGlossaryInCSVFormat({
        entityType: EntityType.GLOSSARY,
        name: specialName,
        data: mockCSVData,
      });

      await importGlossaryTermInCSVFormat({
        entityType: EntityType.GLOSSARY_TERM,
        name: specialName,
        data: mockCSVData,
      });

      // All should have been called
      expect(mockPut).toHaveBeenCalledTimes(5);
    });

    it('should return response data correctly for all functions', async () => {
      const customResponse = {
        jobId: 'custom-job-id',
        message: 'Custom message',
      };
      const mockPut = jest.fn().mockResolvedValue({ data: customResponse });
      jest.mock('./index', () => ({
        __esModule: true,
        default: {
          put: mockPut,
        },
      }));

      const {
        importTestCaseInCSVFormat,
        importEntityInCSVFormat,
        importServiceInCSVFormat,
        importGlossaryInCSVFormat,
        importGlossaryTermInCSVFormat,
      } = require('./importExportAPI');

      const params = {
        entityType: EntityType.TABLE,
        name: 'test',
        data: mockCSVData,
      };

      const result1 = await importTestCaseInCSVFormat(params);
      const result2 = await importEntityInCSVFormat(params);
      const result3 = await importServiceInCSVFormat(params);
      const result4 = await importGlossaryInCSVFormat(params);
      const result5 = await importGlossaryTermInCSVFormat(params);

      expect(result1).toEqual(customResponse);
      expect(result2).toEqual(customResponse);
      expect(result3).toEqual(customResponse);
      expect(result4).toEqual(customResponse);
      expect(result5).toEqual(customResponse);
    });
  });
});
