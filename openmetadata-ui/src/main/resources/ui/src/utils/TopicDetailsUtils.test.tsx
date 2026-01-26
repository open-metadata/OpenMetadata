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

import { DataTypeTopic, Topic } from '../generated/entity/data/topic';
import { EntityReference } from '../generated/type/entityReference';
import { extractTopicFields } from './TopicDetailsUtils';

type TopicTestData = Partial<Topic> & Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('TopicDetailsUtils', () => {
  describe('extractTopicFields', () => {
    it('should extract fields from topic message schema', () => {
      const mockTopic: TopicTestData = {
        id: 'test-id',
        messageSchema: {
          schemaFields: [
            {
              name: 'field1',
              dataType: DataTypeTopic.String,
              fullyQualifiedName: 'topic.field1',
            },
            {
              name: 'field2',
              dataType: DataTypeTopic.Int,
              fullyQualifiedName: 'topic.field2',
            },
          ],
        },
      };

      const result = extractTopicFields(mockTopic);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('field1');
      expect(result[1].name).toBe('field2');
    });

    it('should return empty array when messageSchema is undefined', () => {
      const mockTopic: TopicTestData = {
        id: 'test-id',
      };

      const result = extractTopicFields(mockTopic);

      expect(result).toEqual([]);
    });

    it('should return empty array when schemaFields is undefined', () => {
      const mockTopic: TopicTestData = {
        id: 'test-id',
        messageSchema: {},
      };

      const result = extractTopicFields(mockTopic);

      expect(result).toEqual([]);
    });

    it('should handle nested fields', () => {
      const mockTopic: TopicTestData = {
        id: 'test-id',
        messageSchema: {
          schemaFields: [
            {
              name: 'parentField',
              dataType: DataTypeTopic.Record,
              fullyQualifiedName: 'topic.parentField',
              children: [
                {
                  name: 'childField',
                  dataType: DataTypeTopic.String,
                  fullyQualifiedName: 'topic.parentField.childField',
                },
              ],
            },
          ],
        },
      };

      const result = extractTopicFields(mockTopic);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('parentField');
      expect(result[0].children).toBeDefined();
      expect(result[0].children).toHaveLength(1);
    });
  });
});
