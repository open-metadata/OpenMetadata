/*
 *  Copyright 2026 Collate.
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
import { EntityFields } from '../../../../enums/AdvancedSearch.enum';
import {
  countSelectedFacets,
  getAdjacentFilter,
  getExploreParams,
  getFacetQueryFilter,
  getVisibleTabs,
  splitHighlight,
} from './GlobalSearch.utils';

const section = (count: number) => ({ count, rows: [] });

describe('getVisibleTabs', () => {
  it('lists only matched types, biggest first', () => {
    const { shown, more } = getVisibleTabs(
      { assets: section(4), tasks: section(9), glossary: section(0) },
      'all'
    );

    expect(shown).toEqual(['tasks', 'assets']);
    expect(more).toEqual([]);
  });

  it('breaks count ties by the fixed category order', () => {
    const { shown } = getVisibleTabs(
      { people: section(2), assets: section(2) },
      'all'
    );

    expect(shown).toEqual(['assets', 'people']);
  });

  it('moves everything past five types into the overflow', () => {
    const { shown, more } = getVisibleTabs(
      {
        assets: section(9),
        chats: section(8),
        tasks: section(7),
        glossary: section(6),
        people: section(5),
        domains: section(4),
        products: section(3),
      },
      'all'
    );

    expect(shown).toHaveLength(5);
    expect(more).toEqual(['domains', 'products']);
  });

  it('keeps the active type while it has no hits', () => {
    expect(getVisibleTabs({}, 'tasks').shown).toEqual(['tasks']);
  });
});

describe('getAdjacentFilter', () => {
  const order = ['all', 'assets', 'tasks'] as const;

  it('wraps forward and backward', () => {
    expect(getAdjacentFilter([...order], 'tasks', false)).toBe('all');
    expect(getAdjacentFilter([...order], 'all', true)).toBe('tasks');
  });
});

describe('splitHighlight', () => {
  it('marks every query token, case-insensitively', () => {
    expect(splitHighlight('Customer_Orders', 'customer ord')).toEqual([
      { text: 'Customer', isMatch: true, offset: 0 },
      { text: '_', isMatch: false, offset: 8 },
      { text: 'Ord', isMatch: true, offset: 9 },
      { text: 'ers', isMatch: false, offset: 12 },
    ]);
  });

  it('treats regex characters literally', () => {
    expect(splitHighlight('a.b', '.')).toEqual([
      { text: 'a', isMatch: false, offset: 0 },
      { text: '.', isMatch: true, offset: 1 },
      { text: 'b', isMatch: false, offset: 2 },
    ]);
  });
});

describe('facet carry-over to Explore', () => {
  const selection = {
    [EntityFields.TIER]: ['Tier.Tier1'],
    [EntityFields.OWNERS]: ['Finance', 'Data Platform'],
    [EntityFields.TAG]: [],
  };

  it('counts selected values', () => {
    expect(countSelectedFacets(selection)).toBe(3);
  });

  it('builds the quickFilter, sort and order Explore reads', () => {
    const params = getExploreParams(selection, 'updatedAt', 'asc');

    expect(params.sort).toBe('updatedAt');
    expect(params.sortOrder).toBe('asc');
    expect(JSON.parse(params.quickFilter)).toEqual({
      query: {
        bool: {
          must: [
            { bool: { should: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
            {
              bool: {
                should: [
                  { term: { ownerDisplayName: 'Finance' } },
                  { term: { ownerDisplayName: 'Data Platform' } },
                ],
              },
            },
          ],
        },
      },
    });
  });

  it('omits quickFilter when nothing is selected', () => {
    expect(getExploreParams({}, '_score', 'desc')).toEqual({
      sort: '_score',
      sortOrder: 'desc',
    });
  });

  it('leaves out the facet being counted', () => {
    expect(getFacetQueryFilter(selection, EntityFields.OWNERS)).toEqual({
      query: {
        bool: {
          must: [
            { bool: { should: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
          ],
        },
      },
    });
  });
});
