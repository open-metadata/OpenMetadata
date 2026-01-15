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

import {
  APIEndpoint,
  DataTypeTopic,
  TagSource,
} from '../../generated/entity/data/apiEndpoint';
import { EntityReference } from '../../generated/type/entityReference';
import { LabelType, State } from '../../generated/type/tagLabel';
import { extractApiEndpointFields } from './APIEndpointUtils';

type APIEndpointTestData = Partial<APIEndpoint> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('APIEndpointUtils', () => {
  describe('extractApiEndpointFields', () => {
    it('should extract fields from both request and response schemas', () => {
      const mockApiEndpoint: APIEndpointTestData = {
        id: 'test-id',
        requestSchema: {
          schemaFields: [
            {
              name: 'requestField1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'api.request.field1',
            },
            {
              name: 'requestField2',
              dataType: DataTypeTopic.Int,
              fullyQualifiedName: 'api.request.field2',
              tags: [
                {
                  tagFQN: 'tag1',
                  source: TagSource.Classification,
                  labelType: LabelType.Manual,
                  state: State.Confirmed,
                },
              ],
            },
          ],
        },
        responseSchema: {
          schemaFields: [
            {
              name: 'responseField1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'api.response.field1',
            },
          ],
        },
      };

      const result = extractApiEndpointFields(mockApiEndpoint);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('requestField1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('requestField2');
      expect(result[1].tags).toHaveLength(1);
      expect(result[2].name).toBe('responseField1');
      expect(result[2].tags).toEqual([]);
    });

    it('should handle missing request schema', () => {
      const mockApiEndpoint: APIEndpointTestData = {
        id: 'test-id',
        responseSchema: {
          schemaFields: [
            {
              name: 'responseField1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'api.response.field1',
            },
          ],
        },
      };

      const result = extractApiEndpointFields(mockApiEndpoint);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('responseField1');
    });

    it('should handle missing response schema', () => {
      const mockApiEndpoint: APIEndpointTestData = {
        id: 'test-id',
        requestSchema: {
          schemaFields: [
            {
              name: 'requestField1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'api.request.field1',
            },
          ],
        },
      };

      const result = extractApiEndpointFields(mockApiEndpoint);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('requestField1');
    });

    it('should return empty array when both schemas are missing', () => {
      const mockApiEndpoint: APIEndpointTestData = {
        id: 'test-id',
      };

      const result = extractApiEndpointFields(mockApiEndpoint);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to fields without tags', () => {
      const mockApiEndpoint: APIEndpointTestData = {
        id: 'test-id',
        requestSchema: {
          schemaFields: [
            {
              name: 'field1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'api.field1',
            },
          ],
        },
      };

      const result = extractApiEndpointFields(mockApiEndpoint);

      expect(result[0].tags).toEqual([]);
    });
  });
});
