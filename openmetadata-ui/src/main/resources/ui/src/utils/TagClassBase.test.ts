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
import { queryFilterToRemoveSomeClassification } from '../constants/Tag.constants';
import { SearchIndex } from '../enums/search.enum';
import { searchQuery } from '../rest/searchAPI';
import tagClassBase, { TagClassBase } from './TagClassBase';

jest.mock('../rest/searchAPI');

jest.mock('./StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockReturnValue('test'),
  escapeESReservedCharacters: jest.fn().mockReturnValue('test'),
}));

describe('TagClassBase', () => {
  beforeEach(() => {
    (searchQuery as jest.Mock).mockClear();
  });

  it('should create an instance of TagClassBase', () => {
    expect(tagClassBase).toBeInstanceOf(TagClassBase);
  });

  it('should call searchQuery with correct parameters', async () => {
    const searchText = 'test';
    const page = 1;

    const mockResponse = {
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'test',
            },
          },
        ],
        total: {
          value: 1,
        },
      },
    };

    (searchQuery as jest.Mock).mockResolvedValue(mockResponse);
    await tagClassBase.getTags(searchText, page);

    expect(searchQuery).toHaveBeenCalledWith({
      query: `*${searchText}*`,
      filters: 'disabled:false',
      pageNumber: page,
      pageSize: 10, // Assuming PAGE_SIZE is 10
      queryFilter: queryFilterToRemoveSomeClassification,
      searchIndex: SearchIndex.TAG,
    });
  });

  it('should return correct data structure', async () => {
    const searchText = 'test';
    const page = 1;
    const mockResponse = {
      hits: {
        hits: [
          {
            _source: {
              fullyQualifiedName: 'test',
            },
          },
        ],
        total: {
          value: 1,
        },
      },
    };

    (searchQuery as jest.Mock).mockResolvedValue(mockResponse);

    const result = await tagClassBase.getTags(searchText, page);

    expect(result).toEqual({
      data: [
        {
          label: 'test',
          value: 'test',
          data: {
            fullyQualifiedName: 'test',
          },
        },
      ],
      paging: {
        total: 1,
      },
    });
  });
});
