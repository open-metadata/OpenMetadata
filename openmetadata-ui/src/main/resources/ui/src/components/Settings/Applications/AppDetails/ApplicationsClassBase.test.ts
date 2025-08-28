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
import applicationsClassBase from './ApplicationsClassBase';

describe('ApplicationsClassBase', () => {
  describe('importSchema', () => {
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
