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
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { QueryFieldInterface } from '../pages/ExplorePage/ExplorePage.interface';
import {
  extractTermKeys,
  getQuickFilterQuery,
  getSelectedValuesFromQuickFilter,
} from './Explore.utils';

describe('Explore Utils', () => {
  it('should return undefined if data is empty', () => {
    const data: ExploreQuickFilterField[] = [];
    const result = getQuickFilterQuery(data);

    expect(result).toBeUndefined();
  });

  it('should generate quick filter query correctly', () => {
    const data = [
      {
        label: 'Domain',
        key: 'domain.displayName.keyword',
        value: [],
      },
      {
        label: 'Owner',
        key: 'owner.displayName.keyword',
        value: [],
      },
      {
        label: 'Tag',
        key: 'tags.tagFQN',
        value: [
          {
            key: 'personaldata.personal',
            label: 'personaldata.personal',
            count: 1,
          },
        ],
      },
    ];
    const result = getQuickFilterQuery(data);
    const expectedQuery = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    term: {
                      'tags.tagFQN': 'personaldata.personal',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(result).toEqual(expectedQuery);
  });

  describe('extractTermKeys', () => {
    it('should return an empty array if objects is empty', () => {
      const objects: QueryFieldInterface[] = [];
      const result = extractTermKeys(objects);

      expect(result).toEqual([]);
    });

    it('should return an array of term keys', () => {
      const objects = [
        {
          bool: {
            must_not: {
              exists: {
                field: 'owner.displayName.keyword',
              },
            },
          },
        },
        {
          term: {
            'owner.displayName.keyword': 'accounting',
          },
        },
      ];
      const result = extractTermKeys(objects);
      const expectedKeys = ['owner.displayName.keyword'];

      expect(result).toEqual(expectedKeys);
    });
  });

  it('getSelectedValuesFromQuickFilter should return correct result', () => {
    const selectedFilters = {
      Domain: [],
      Owner: [
        {
          key: 'OM_NULL_FIELD',
          label: 'label.no-entity',
        },
        {
          key: 'accounting',
          label: 'accounting',
        },
      ],
      Tag: [],
    };

    const dropdownData = [
      {
        label: 'Domain',
        key: 'domain.displayName.keyword',
      },
      {
        label: 'Owner',
        key: 'owner.displayName.keyword',
      },
      {
        label: 'Tag',
        key: 'tags.tagFQN',
      },
    ];

    const queryFilter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      must_not: {
                        exists: {
                          field: 'owner.displayName.keyword',
                        },
                      },
                    },
                  },
                  {
                    term: {
                      'owner.displayName.keyword': 'accounting',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(getSelectedValuesFromQuickFilter(dropdownData, queryFilter)).toEqual(
      selectedFilters
    );
  });
});
