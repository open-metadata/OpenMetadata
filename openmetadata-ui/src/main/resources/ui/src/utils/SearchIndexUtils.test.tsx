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

import { DataType, SearchIndex, TagSource } from '../generated/entity/data/searchIndex';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State } from '../generated/type/tagLabel';
import { extractSearchIndexFields } from './SearchIndexUtils';

type SearchIndexTestData = Partial<SearchIndex> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('SearchIndexUtils', () => {
  describe('extractSearchIndexFields', () => {
    it('should extract fields from search index', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
          },
          {
            name: 'field2',
            dataType: DataType.Keyword,
            fullyQualifiedName: 'searchindex.field2',
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
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('field1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('field2');
      expect(result[1].tags).toHaveLength(1);
    });

    it('should return empty array when fields are undefined', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to fields without tags', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result[0].tags).toEqual([]);
    });

    it('should preserve existing tags', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
              {
                tagFQN: 'tag2',
                source: TagSource.Glossary,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags?.[0].tagFQN).toBe('tag1');
      expect(result[0].tags?.[1].tagFQN).toBe('tag2');
    });

    it('should handle nested fields', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'parentField',
            dataType: DataType.Object,
            fullyQualifiedName: 'searchindex.parentField',
            children: [
              {
                name: 'childField',
                dataType: DataType.Text,
                fullyQualifiedName: 'searchindex.parentField.childField',
              },
            ],
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('parentField');
      expect(result[0].children).toBeDefined();
      expect(result[0].children).toHaveLength(1);
    });

    it('should return empty array when fields is null', () => {
      const mockSearchIndex = {
        id: 'test-id',
        fields: null,
      } as Omit<SearchIndexTestData, 'fields'> & {
        fields: null;
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toEqual([]);
    });

    it('should return empty array when fields is empty array', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toEqual([]);
    });

    it('should handle fields with null tags', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
            tags: null as unknown as undefined,
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual([]);
    });

    it('should handle multiple fields with mixed tag states', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
          },
          {
            name: 'field2',
            dataType: DataType.Keyword,
            fullyQualifiedName: 'searchindex.field2',
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
          {
            name: 'field3',
            dataType: DataType.Integer,
            fullyQualifiedName: 'searchindex.field3',
            tags: null as unknown as undefined,
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result).toHaveLength(3);
      expect(result[0].tags).toEqual([]);
      expect(result[1].tags).toHaveLength(1);
      expect(result[2].tags).toEqual([]);
    });

    it('should preserve all field properties', () => {
      const mockSearchIndex: SearchIndexTestData = {
        id: 'test-id',
        fields: [
          {
            name: 'field1',
            dataType: DataType.Text,
            fullyQualifiedName: 'searchindex.field1',
            description: 'Test description',
            displayName: 'Field 1',
          },
        ],
      };

      const result = extractSearchIndexFields(mockSearchIndex);

      expect(result[0].name).toBe('field1');
      expect(result[0].dataType).toBe(DataType.Text);
      expect(result[0].fullyQualifiedName).toBe('searchindex.field1');
      expect(result[0].description).toBe('Test description');
      expect(result[0].displayName).toBe('Field 1');
      expect(result[0].tags).toEqual([]);
    });
  });
});
