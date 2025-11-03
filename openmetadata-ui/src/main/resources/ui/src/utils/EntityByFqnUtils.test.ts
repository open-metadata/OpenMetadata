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

import { EntityType } from '../enums/entity.enum';
import * as alertsAPI from '../rest/alertsAPI';
import * as apiCollectionsAPI from '../rest/apiCollectionsAPI';
import * as apiEndpointsAPI from '../rest/apiEndpointsAPI';
import * as databaseAPI from '../rest/databaseAPI';
import * as glossaryAPI from '../rest/glossaryAPI';
import * as serviceAPI from '../rest/serviceAPI';
import * as tableAPI from '../rest/tableAPI';
import * as testAPI from '../rest/testAPI';
import { getEntityByFqnUtil } from './EntityByFqnUtils';

jest.mock('../rest/tableAPI');
jest.mock('../rest/databaseAPI');
jest.mock('../rest/glossaryAPI');
jest.mock('../rest/serviceAPI');
jest.mock('../rest/alertsAPI');
jest.mock('../rest/apiCollectionsAPI');
jest.mock('../rest/apiEndpointsAPI');
jest.mock('../rest/testAPI');

describe('EntityByFqnUtils', () => {
  const mockFqn = 'test.fqn';
  const mockFields = 'owners,tags';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEntityByFqnUtil', () => {
    it('should fetch TABLE entity correctly', async () => {
      const mockTableData = { id: '1', name: 'test-table' };
      (tableAPI.getTableDetailsByFQN as jest.Mock).mockResolvedValue(
        mockTableData
      );

      const result = await getEntityByFqnUtil(
        EntityType.TABLE,
        mockFqn,
        mockFields
      );

      expect(tableAPI.getTableDetailsByFQN).toHaveBeenCalledWith(mockFqn, {
        fields: mockFields,
      });
      expect(result).toEqual(mockTableData);
    });

    it('should fetch DATABASE entity with OWNERS field', async () => {
      const mockDatabaseData = { id: '1', name: 'test-db' };
      (databaseAPI.getDatabaseDetailsByFQN as jest.Mock).mockResolvedValue(
        mockDatabaseData
      );

      const result = await getEntityByFqnUtil(EntityType.DATABASE, mockFqn);

      expect(databaseAPI.getDatabaseDetailsByFQN).toHaveBeenCalledWith(
        mockFqn,
        {
          fields: 'owners',
        }
      );
      expect(result).toEqual(mockDatabaseData);
    });

    it('should fetch DATABASE_SCHEMA entity with OWNERS field and Include.All', async () => {
      const mockSchemaData = { id: '1', name: 'test-schema' };
      (
        databaseAPI.getDatabaseSchemaDetailsByFQN as jest.Mock
      ).mockResolvedValue(mockSchemaData);

      const result = await getEntityByFqnUtil(
        EntityType.DATABASE_SCHEMA,
        mockFqn
      );

      expect(databaseAPI.getDatabaseSchemaDetailsByFQN).toHaveBeenCalledWith(
        mockFqn,
        {
          fields: 'owners',
          include: 'all',
        }
      );
      expect(result).toEqual(mockSchemaData);
    });

    it('should fetch GLOSSARY_TERM entity correctly', async () => {
      const mockGlossaryTermData = { id: '1', name: 'test-term' };
      (glossaryAPI.getGlossaryTermByFQN as jest.Mock).mockResolvedValue(
        mockGlossaryTermData
      );

      const result = await getEntityByFqnUtil(
        EntityType.GLOSSARY_TERM,
        mockFqn
      );

      expect(glossaryAPI.getGlossaryTermByFQN).toHaveBeenCalledWith(mockFqn, {
        fields: 'owners',
      });
      expect(result).toEqual(mockGlossaryTermData);
    });

    it('should fetch GLOSSARY entity correctly', async () => {
      const mockGlossaryData = { id: '1', name: 'test-glossary' };
      (glossaryAPI.getGlossariesByName as jest.Mock).mockResolvedValue(
        mockGlossaryData
      );

      const result = await getEntityByFqnUtil(EntityType.GLOSSARY, mockFqn);

      expect(glossaryAPI.getGlossariesByName).toHaveBeenCalledWith(mockFqn, {
        fields: 'owners',
      });
      expect(result).toEqual(mockGlossaryData);
    });

    it('should fetch TEST_CASE entity with correct fields', async () => {
      const mockTestCaseData = { id: '1', name: 'test-case' };
      (testAPI.getTestCaseByFqn as jest.Mock).mockResolvedValue(
        mockTestCaseData
      );

      const result = await getEntityByFqnUtil(EntityType.TEST_CASE, mockFqn);

      expect(testAPI.getTestCaseByFqn).toHaveBeenCalledWith(mockFqn, {
        fields: ['owners'],
      });
      expect(result).toEqual(mockTestCaseData);
    });

    it('should fetch DATABASE_SERVICE using getServiceByFQN', async () => {
      const mockServiceData = { id: '1', name: 'test-service' };
      (serviceAPI.getServiceByFQN as jest.Mock).mockResolvedValue(
        mockServiceData
      );

      const result = await getEntityByFqnUtil(
        EntityType.DATABASE_SERVICE,
        mockFqn
      );

      expect(serviceAPI.getServiceByFQN).toHaveBeenCalledWith(
        EntityType.DATABASE_SERVICE,
        mockFqn
      );
      expect(result).toEqual(mockServiceData);
    });

    it('should fetch MESSAGING_SERVICE using getServiceByFQN', async () => {
      const mockServiceData = { id: '1', name: 'test-messaging-service' };
      (serviceAPI.getServiceByFQN as jest.Mock).mockResolvedValue(
        mockServiceData
      );

      const result = await getEntityByFqnUtil(
        EntityType.MESSAGING_SERVICE,
        mockFqn
      );

      expect(serviceAPI.getServiceByFQN).toHaveBeenCalledWith(
        EntityType.MESSAGING_SERVICE,
        mockFqn
      );
      expect(result).toEqual(mockServiceData);
    });

    it('should fetch API_COLLECTION entity correctly', async () => {
      const mockAPICollectionData = { id: '1', name: 'test-collection' };
      (apiCollectionsAPI.getApiCollectionByFQN as jest.Mock).mockResolvedValue(
        mockAPICollectionData
      );

      const result = await getEntityByFqnUtil(
        EntityType.API_COLLECTION,
        mockFqn,
        mockFields
      );

      expect(apiCollectionsAPI.getApiCollectionByFQN).toHaveBeenCalledWith(
        mockFqn,
        {
          fields: mockFields,
        }
      );
      expect(result).toEqual(mockAPICollectionData);
    });

    it('should fetch API_ENDPOINT entity correctly', async () => {
      const mockAPIEndpointData = { id: '1', name: 'test-endpoint' };
      (apiEndpointsAPI.getApiEndPointByFQN as jest.Mock).mockResolvedValue(
        mockAPIEndpointData
      );

      const result = await getEntityByFqnUtil(
        EntityType.API_ENDPOINT,
        mockFqn,
        mockFields
      );

      expect(apiEndpointsAPI.getApiEndPointByFQN).toHaveBeenCalledWith(
        mockFqn,
        {
          fields: mockFields,
        }
      );
      expect(result).toEqual(mockAPIEndpointData);
    });

    it('should fetch EVENT_SUBSCRIPTION entity correctly', async () => {
      const mockEventSubData = { id: '1', name: 'test-event-sub' };
      (alertsAPI.getAlertsFromName as jest.Mock).mockResolvedValue(
        mockEventSubData
      );

      const result = await getEntityByFqnUtil(
        EntityType.EVENT_SUBSCRIPTION,
        mockFqn
      );

      expect(alertsAPI.getAlertsFromName).toHaveBeenCalledWith(mockFqn);
      expect(result).toEqual(mockEventSubData);
    });

    it('should return null for unknown entity type', async () => {
      const result = await getEntityByFqnUtil('UNKNOWN_TYPE', mockFqn);

      expect(result).toBeNull();
    });

    it('should handle all service types correctly', async () => {
      const serviceTypes = [
        EntityType.DATABASE_SERVICE,
        EntityType.MESSAGING_SERVICE,
        EntityType.DASHBOARD_SERVICE,
        EntityType.PIPELINE_SERVICE,
        EntityType.MLMODEL_SERVICE,
        EntityType.STORAGE_SERVICE,
        EntityType.SEARCH_SERVICE,
        EntityType.API_SERVICE,
        EntityType.SECURITY_SERVICE,
        EntityType.METADATA_SERVICE,
        EntityType.SERVICE,
      ];

      const mockServiceData = { id: '1', name: 'test-service' };
      (serviceAPI.getServiceByFQN as jest.Mock).mockResolvedValue(
        mockServiceData
      );

      for (const serviceType of serviceTypes) {
        await getEntityByFqnUtil(serviceType, mockFqn);

        expect(serviceAPI.getServiceByFQN).toHaveBeenCalledWith(
          serviceType,
          mockFqn
        );
      }

      expect(serviceAPI.getServiceByFQN).toHaveBeenCalledTimes(
        serviceTypes.length
      );
    });
  });
});
