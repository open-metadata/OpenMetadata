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
import { Fields } from 'react-awesome-query-builder';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import {
  getJsonTreeFromQueryFilter,
  resolveFieldType,
} from './QueryBuilderUtils';

jest.mock('./StringsUtils', () => ({
  generateUUID: jest.fn(),
}));

describe('getJsonTreeFromQueryFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a valid JSON tree structure for a given query filter', () => {
    const mockUUIDs = ['uuid1', 'uuid2', 'uuid3', 'uuid4'];
    (
      jest.requireMock('./StringsUtils').generateUUID as jest.Mock
    ).mockImplementation(() => mockUUIDs.shift());
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  {
                    term: {
                      field1: 'value1',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const result = getJsonTreeFromQueryFilter(queryFilter);

    expect(result).toEqual({
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        uuid2: {
          type: 'group',
          properties: { conjunction: 'AND', not: false },
          children1: {
            uuid3: {
              type: 'rule',
              properties: {
                field: 'field1',
                operator: 'select_equals',
                value: ['value1'],
                valueSrc: ['value'],
                operatorOptions: null,
                valueType: ['select'],
                asyncListValues: [
                  {
                    key: 'value1',
                    value: 'value1',
                    children: 'value1',
                  },
                ],
              },
              id: 'uuid3',
              path: ['uuid1', 'uuid2', 'uuid3'],
            },
          },
          id: 'uuid2',
          path: ['uuid1', 'uuid2'],
        },
      },
      id: 'uuid1',
      path: ['uuid1'],
    });
  });

  it('should return an empty object if an error occurs', () => {
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [],
        },
      },
    };

    const result = getJsonTreeFromQueryFilter(queryFilter);

    expect(result).toEqual({});
  });
});

describe('resolveFieldType', () => {
  const mockFields: Fields = {
    name: {
      type: 'text',
    },
    extension: {
      type: '!group',
      subfields: {
        expert: {
          type: 'text',
        },
        'expert.name': {
          // Direct path field
          type: 'string',
        },
        'expert.level': {
          type: 'number',
        },
        settings: {
          type: '!group',
          subfields: {
            enabled: {
              type: 'boolean',
            },
          },
        },
      },
    },
  };

  it.each([
    ['simple top-level field', 'name', 'text'],
    ['direct path in subfields', 'extension.expert.name', 'string'],
    ['nested field through normal traversal', 'extension.expert', 'text'],
    ['deeply nested field', 'extension.settings.enabled', 'boolean'],
    ['non-existent field', 'nonexistent', undefined],
    ['non-existent nested field', 'extension.nonexistent', undefined],
    ['invalid nested path', 'name.invalid.path', undefined],
  ])('should resolve %s', (_, field: string, expectedType?: string) => {
    expect(resolveFieldType(mockFields, field)).toBe(expectedType);
  });

  it('should return an empty string if the field is undefined', () => {
    expect(resolveFieldType(undefined, 'name')).toBe('');
  });
});
