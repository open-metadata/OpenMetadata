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

import { AppType } from '../../../../generated/entity/applications/app';
import rdfIndexAppSchema from '../../../../jsons/applicationSchemas/RdfIndexApp.json';
import searchIndexingAppSchema from '../../../../jsons/applicationSchemas/SearchIndexingApplication.json';
import { getSearchEntityTypes } from '../../../../rest/searchAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import applicationsClassBase from './ApplicationsClassBase';

jest.mock('../../../../rest/searchAPI', () => ({
  getSearchEntityTypes: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetSearchEntityTypes = getSearchEntityTypes as jest.Mock;

describe('ApplicationsClassBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSearchEntityTypes.mockResolvedValue([]);
  });

  describe('importSchema', () => {
    it('should fill the SearchIndexingApplication entity list from the server', async () => {
      mockGetSearchEntityTypes.mockResolvedValue(['dynamicAgent', 'table']);

      const schema = await applicationsClassBase.importSchema(
        'SearchIndexingApplication'
      );

      // 'all' is the backend sentinel for "every registered index"; it is not an index, so the
      // endpoint does not return it, but the ["all"] default has to validate against the enum.
      expect(schema.properties.entities.items.enum).toEqual([
        'all',
        'dynamicAgent',
        'table',
      ]);
    });

    it('should not hardcode the entity list in the schema json', () => {
      const { items } = searchIndexingAppSchema.properties.entities;

      // A shipped enum is the bug this endpoint replaced: one list for every deployment,
      // stale every time an entity type was added and blind to Collate-only indexes.
      expect(items).not.toHaveProperty('enum');
    });

    it('should toast and keep only the all option when the server call fails', async () => {
      const error = new Error('boom');
      mockGetSearchEntityTypes.mockRejectedValue(error);

      const schema = await applicationsClassBase.importSchema(
        'SearchIndexingApplication'
      );

      expect(schema.properties.entities.items.enum).toEqual(['all']);
      expect(showErrorToast).toHaveBeenCalledWith(error);
    });

    it('should not fetch entity types for other applications', async () => {
      await applicationsClassBase.importSchema('RdfIndexApp');

      expect(mockGetSearchEntityTypes).not.toHaveBeenCalled();
    });

    it('should import pre-parsed schema', async () => {
      // Mock the dynamic import
      jest.doMock(
        '../../../../jsons/applicationSchemas/SearchIndexingApplication.json',
        () => ({
          type: 'object',
          properties: {
            type: {
              type: 'string',
              default: 'SearchIndexing',
            },
            cacheSize: {
              type: 'integer',
              default: 100,
            },
          },
        }),
        { virtual: true }
      );

      const schema = await applicationsClassBase.importSchema(
        'SearchIndexingApplication'
      );

      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      // Should not contain any $ref since schemas are pre-parsed
      expect(JSON.stringify(schema)).not.toContain('$ref');
    });

    it('should import the RDF app schema', async () => {
      const schema = await applicationsClassBase.importSchema('RdfIndexApp');

      expect(schema).toEqual(rdfIndexAppSchema);
      expect(schema.properties.entities.default).toEqual([]);
      expect(schema.properties.partitionSize).toBeDefined();
      expect(schema.properties.useDistributedIndexing).toBeDefined();
    });
  });

  describe('getJSONUISchema', () => {
    it('should return UI schema configuration', () => {
      const uiSchema = applicationsClassBase.getJSONUISchema();

      expect(uiSchema).toBeDefined();
      expect(uiSchema.moduleConfiguration?.dataAssets?.serviceFilter).toEqual({
        'ui:widget': 'hidden',
      });
      expect(uiSchema.entityLink).toEqual({
        'ui:widget': 'hidden',
      });
      expect(uiSchema.type).toEqual({
        'ui:widget': 'hidden',
      });
    });
  });

  describe('getScheduleOptionsForApp', () => {
    it('should return week schedule for DataInsightsReportApplication', () => {
      const options = applicationsClassBase.getScheduleOptionsForApp(
        'DataInsightsReportApplication',
        AppType.Internal
      );

      expect(options).toEqual(['week']);
    });

    it('should return day schedule for External apps', () => {
      const options = applicationsClassBase.getScheduleOptionsForApp(
        'SomeExternalApp',
        AppType.External
      );

      expect(options).toEqual(['day']);
    });

    it('should return undefined when no schedules provided for other apps', () => {
      const options = applicationsClassBase.getScheduleOptionsForApp(
        'SomeApp',
        AppType.Internal
      );

      expect(options).toBeUndefined();
    });
  });
});
