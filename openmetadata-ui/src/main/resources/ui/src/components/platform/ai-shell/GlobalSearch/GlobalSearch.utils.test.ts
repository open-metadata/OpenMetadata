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
  getActiveOption,
  getAdjacentFilter,
  getExploreParams,
  getFacetQueryFilter,
  getKeyAction,
  getTabCounts,
  getUsableSources,
  getVisibleTabs,
  splitHighlight,
} from './GlobalSearch.utils';

const section = (count: number) => ({ count, rows: [] });
const ORDER = [
  'assets',
  'chats',
  'tasks',
  'glossaryTerm',
  'user',
  'domain',
  'dataProduct',
];

describe('getVisibleTabs', () => {
  it('lists only matched types, biggest first', () => {
    const { shown, more } = getVisibleTabs(
      { assets: section(4), tasks: section(9), glossaryTerm: section(0) },
      'all',
      ORDER
    );

    expect(shown).toEqual(['tasks', 'assets']);
    expect(more).toEqual([]);
  });

  it('breaks count ties by the fixed category order', () => {
    const { shown } = getVisibleTabs(
      { user: section(2), assets: section(2) },
      'all',
      ORDER
    );

    expect(shown).toEqual(['assets', 'user']);
  });

  it('moves everything past five types into the overflow', () => {
    const { shown, more } = getVisibleTabs(
      {
        assets: section(9),
        chats: section(8),
        tasks: section(7),
        glossaryTerm: section(6),
        user: section(5),
        domain: section(4),
        dataProduct: section(3),
      },
      'all',
      ORDER
    );

    expect(shown).toHaveLength(5);
    expect(more).toEqual(['domain', 'dataProduct']);
  });

  it('keeps the active type while it has no hits', () => {
    expect(getVisibleTabs({}, 'tasks', ORDER).shown).toEqual(['tasks']);
  });
});

describe('getTabCounts', () => {
  const chatRow = { id: 'c1', title: 'Chat', icon: null };
  const recents = [{ key: 'chats', rows: [chatRow, { ...chatRow, id: 'c2' }] }];
  const loaded = { assets: { count: 4, rows: [] } };

  it('counts the scoped source’s recent rows before typing', () => {
    expect(
      getTabCounts({
        query: '',
        scopedCategory: 'chats',
        recents,
        results: {},
        isCounting: false,
      })
    ).toEqual({
      results: { chats: { count: 2, rows: recents[0].rows } },
      hideCounts: false,
    });
  });

  it('hides counts before typing when not scoped, and while counting', () => {
    expect(
      getTabCounts({ query: '', recents, results: {}, isCounting: false })
        .hideCounts
    ).toBe(true);
    expect(
      getTabCounts({
        query: 'orders',
        scopedCategory: 'chats',
        recents,
        results: loaded,
        isCounting: true,
      })
    ).toEqual({ results: loaded, hideCounts: true });
  });

  it('shows the loaded counts once a query settles', () => {
    expect(
      getTabCounts({
        query: 'orders',
        recents,
        results: loaded,
        isCounting: false,
      })
    ).toEqual({ results: loaded, hideCounts: false });
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
    [EntityFields.TIER]: [{ key: 'Tier.Tier1', label: 'Tier1' }],
    [EntityFields.OWNERS]: [
      { key: 'Finance', label: 'Finance' },
      { key: 'Data Platform', label: 'Data Platform' },
    ],
    [EntityFields.TAG]: [],
  };

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

describe('getKeyAction for Backspace', () => {
  const backspace = {
    key: 'Backspace',
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
  };
  const context = {
    query: '',
    filter: 'all',
    isScoped: false,
    isActionActive: false,
    tabCount: 3,
  };

  it('never closes search, scoped or not', () => {
    expect(
      getKeyAction(backspace, { ...context, isScoped: true, filter: 'chats' })
    ).toBeUndefined();
    expect(getKeyAction(backspace, context)).toBeUndefined();
  });

  it('widens an empty type tab back to All and leaves typing alone', () => {
    expect(getKeyAction(backspace, { ...context, filter: 'assets' })).toBe(
      'show-all'
    );
    expect(
      getKeyAction(backspace, { ...context, query: 'o', filter: 'assets' })
    ).toBeUndefined();
  });
});

describe('getKeyAction', () => {
  const key = (
    name: string,
    mods: Partial<Record<'shiftKey' | 'metaKey' | 'ctrlKey', boolean>> = {}
  ) => ({
    key: name,
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    ...mods,
  });
  const typed = {
    query: 'orders',
    filter: 'all',
    isScoped: false,
    isActionActive: false,
    tabCount: 3,
  };

  it.each([
    ['ArrowDown', key('ArrowDown'), typed, 'next'],
    ['ArrowUp', key('ArrowUp'), typed, 'previous'],
    ['Enter on a row', key('Enter'), typed, 'select'],
    [
      'Enter on the query action',
      key('Enter'),
      { ...typed, isActionActive: true },
      undefined,
    ],
    ['⌘Enter anywhere', key('Enter', { metaKey: true }), typed, 'run-action'],
    [
      'Ctrl+Enter anywhere',
      key('Enter', { ctrlKey: true }),
      typed,
      'run-action',
    ],
    ['Tab', key('Tab'), typed, 'next-tab'],
    ['Shift+Tab', key('Tab', { shiftKey: true }), typed, 'previous-tab'],
    ['Tab before typing', key('Tab'), { ...typed, query: '' }, undefined],
    ['Tab with a single tab', key('Tab'), { ...typed, tabCount: 1 }, undefined],
    ['Escape with text', key('Escape'), typed, 'close'],
    ['Escape when empty', key('Escape'), { ...typed, query: '' }, 'close'],
    ['a letter', key('a'), typed, undefined],
  ])('%s', (_name, event, context, expected) => {
    expect(getKeyAction(event, context)).toBe(expected);
  });
});

describe('getActiveOption', () => {
  const rows = [{ key: 'a' }, { key: 'b' }];

  it('highlights the first result by default, with the query action above it', () => {
    expect(getActiveOption(rows, 0, true)).toMatchObject({
      index: 1,
      count: 3,
      isActionActive: false,
      row: { key: 'a' },
      optionId: 'global-search-option-a',
    });
    expect(getActiveOption(rows, -1, true)).toMatchObject({
      index: 0,
      isActionActive: true,
      optionId: 'global-search-query-action',
    });
  });

  it('highlights the query action when there are no results', () => {
    expect(getActiveOption([], 0, true).isActionActive).toBe(true);
  });

  it('clamps past either end instead of wrapping', () => {
    expect(getActiveOption(rows, 9, false).row).toEqual({ key: 'b' });
    expect(getActiveOption(rows, -3, false).row).toEqual({ key: 'a' });
  });
});

describe('getUsableSources', () => {
  const source = (key: string, labelKey = key) => ({
    key,
    labelKey,
    search: jest.fn(),
  });

  it('drops sources whose key is a built-in category, an entity type or a duplicate', () => {
    const usable = getUsableSources([
      source('chats'),
      source('assets'),
      source('tasks'),
      source('all'),
      source('table'),
      source('chats', 'second'),
      source('notes'),
    ]);

    expect(usable.map((item) => [item.key, item.labelKey])).toEqual([
      ['chats', 'chats'],
      ['notes', 'notes'],
    ]);
  });
});
