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
import { renderHook } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { GlobalSearchListItem, GlobalSearchRow } from './GlobalSearch.types';
import {
  GlobalSearchItemsParams,
  useGlobalSearchItems,
} from './useGlobalSearchItems';

const row = (id: string): GlobalSearchRow => ({ id, title: id, icon: null });

const onOpen = jest.fn();
const onPreview = jest.fn();
const onSearchTerm = jest.fn();
const onShowType = jest.fn();

const baseParams: GlobalSearchItemsParams = {
  query: '',
  filter: 'all',
  results: {},
  order: [],
  recentSearches: [],
  recentlyViewed: [],
  sourceRecents: [],
  labelFor: (key) => `label-${key}`,
  onOpen,
  onPreview,
  onSearchTerm,
  onShowType,
};

const renderItems = (params: Partial<GlobalSearchItemsParams>) =>
  renderHook(() => useGlobalSearchItems({ ...baseParams, ...params })).result
    .current;

const summarize = (items: GlobalSearchListItem[]) =>
  items.map((item) => item.key);

const findRow = (items: GlobalSearchListItem[], key: string) => {
  const item = items.find((entry) => entry.key === key);
  if (item?.kind !== 'row') {
    throw new Error(`no row ${key}`);
  }

  return item;
};

const findSection = (items: GlobalSearchListItem[], key: string) => {
  const item = items.find((entry) => entry.key === key);
  if (item?.kind !== 'section') {
    throw new Error(`no section ${key}`);
  }

  return item;
};

const viewed = (index: number) => ({
  id: `v${index}`,
  displayName: `Viewed ${index}`,
  entityType: EntityType.TABLE,
  fqn: `svc.db.schema.viewed${index}`,
  timestamp: index,
});

const chatRecents = {
  key: 'chats',
  label: 'Recent chats',
  rows: [row('c1'), row('c2'), row('c3')],
};

describe('useGlobalSearchItems', () => {
  describe('before typing', () => {
    it('lists recent searches, then recently viewed, then source recents', () => {
      const items = renderItems({
        recentSearches: [{ term: 'orders', timestamp: 1 }],
        recentlyViewed: [1, 2, 3, 4].map(viewed),
        sourceRecents: [chatRecents, { key: 'notes', label: 'n', rows: [] }],
      });

      expect(summarize(items)).toEqual([
        'recent-searches',
        'recent-search-orders',
        'recently-viewed',
        'viewed-v1',
        'viewed-v2',
        'viewed-v3',
        'recent-chats',
        'chats-c1',
        'chats-c2',
      ]);
      expect(findSection(items, 'recent-searches').label).toBe(
        'label.recent-search-plural'
      );
      expect(findRow(items, 'viewed-v1').row).toEqual(
        expect.objectContaining({
          title: 'Viewed 1',
          meta: 'label.table · svc › db › schema',
        })
      );
    });

    it('searches a recent term on select', () => {
      const items = renderItems({
        recentSearches: [{ term: 'orders', timestamp: 1 }],
      });
      const recent = findRow(items, 'recent-search-orders');

      expect(recent.enterLabel).toBe('label.search-this');

      recent.onSelect();

      expect(onSearchTerm).toHaveBeenCalledWith('orders');
    });

    it('removes a recent search from the stored preferences', () => {
      useApplicationStore.setState({
        currentUser: { id: 'u1', name: 'karthick', email: 'k@x.io' },
      });
      const recentSearches = [
        { term: 'orders', timestamp: 1 },
        { term: 'customers', timestamp: 2 },
      ];
      const items = renderItems({ recentSearches });

      findRow(items, 'recent-search-orders').onRemove?.();

      expect(
        usePersistentStorage.getState().preferences.karthick.recentlySearched
      ).toEqual([{ term: 'customers', timestamp: 2 }]);
    });

    it('lists a source recent under its heading, with no link (as in the design)', () => {
      const items = renderItems({ sourceRecents: [chatRecents] });
      const section = findSection(items, 'recent-chats');

      expect(section.label).toBe('Recent chats');
      expect(section.seeAll).toBeUndefined();
    });

    it('shows only the scoped source recents', () => {
      const items = renderItems({
        scopedCategory: 'chats',
        recentSearches: [{ term: 'orders', timestamp: 1 }],
        recentlyViewed: [viewed(1)],
        sourceRecents: [
          chatRecents,
          { key: 'notes', label: 'Notes', rows: [row('n1')] },
        ],
      });

      expect(summarize(items)).toEqual([
        'recent-chats',
        'chats-c1',
        'chats-c2',
        'chats-c3',
      ]);
      expect(findSection(items, 'recent-chats').seeAll).toBeUndefined();
    });

    it('uses the row’s own Enter label when the source gives one', () => {
      const items = renderItems({
        scopedCategory: 'chats',
        sourceRecents: [
          {
            key: 'chats',
            label: 'Recent chats',
            rows: [{ ...row('c1'), enterLabel: 'Open chat' }, row('c2')],
          },
        ],
      });
      const enterLabels = items.flatMap((item) =>
        item.kind === 'row' ? [item.enterLabel] : []
      );

      expect(enterLabels).toEqual(['Open chat', 'label.open']);
    });
  });

  describe('with a query on the all filter', () => {
    it('groups sections by order and skips empty ones', () => {
      const items = renderItems({
        query: 'cust',
        order: ['tasks', 'assets', 'glossaryTerm'],
        results: {
          assets: { count: 5, rows: [row('a1'), row('a2')] },
          tasks: { count: 1, rows: [row('t1')] },
          glossaryTerm: { count: 0, rows: [] },
        },
      });

      expect(summarize(items)).toEqual([
        'tasks',
        'tasks-t1',
        'assets',
        'assets-a1',
        'assets-a2',
      ]);
      expect(findSection(items, 'tasks').label).toBe('label-tasks');
      expect(findSection(items, 'tasks').seeAll).toBeUndefined();

      const assets = findSection(items, 'assets');

      expect(assets.seeAll?.label).toBe('label.see-all-count');

      assets.seeAll?.onPress();

      expect(onShowType).toHaveBeenCalledWith('assets');

      findRow(items, 'assets-a1').onSelect();

      expect(onOpen).toHaveBeenCalledWith(row('a1'));
    });
  });

  describe('with a query on a single filter', () => {
    const assetResults = {
      assets: { count: 2, rows: [row('a1'), row('a2')] },
      tasks: { count: 1, rows: [row('t1')] },
    };

    it('shows a sortable heading for assets and previews before opening', () => {
      const items = renderItems({
        query: 'cust',
        filter: 'assets',
        results: assetResults,
        previewId: 'a2',
      });
      const section = findSection(items, 'assets');

      expect(section.label).toBe('2 label-assets');
      expect(section.hasSort).toBe(true);

      const first = findRow(items, 'assets-a1');

      expect(first.enterLabel).toBe('label.preview');

      first.onSelect();

      expect(onPreview).toHaveBeenCalledWith('a1');
      expect(onOpen).not.toHaveBeenCalled();

      const previewed = findRow(items, 'assets-a2');

      expect(previewed.enterLabel).toBe('label.open');

      previewed.onSelect();

      expect(onOpen).toHaveBeenCalledWith(row('a2'));
    });

    it('opens other types directly without a sort control', () => {
      const items = renderItems({
        query: 'cust',
        filter: 'tasks',
        results: assetResults,
      });

      expect(summarize(items)).toEqual(['tasks', 'tasks-t1']);
      expect(findSection(items, 'tasks').hasSort).toBe(false);

      findRow(items, 'tasks-t1').onSelect();

      expect(onOpen).toHaveBeenCalledWith(row('t1'));
    });

    it('is empty when the filter has no results', () => {
      expect(
        renderItems({ query: 'cust', filter: 'domain', results: assetResults })
      ).toEqual([]);
    });
  });
});
