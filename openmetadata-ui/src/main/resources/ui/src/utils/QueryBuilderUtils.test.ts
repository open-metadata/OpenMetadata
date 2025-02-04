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
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { getJsonTreeFromQueryFilter } from './QueryBuilderUtils';

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
