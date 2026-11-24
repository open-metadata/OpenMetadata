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
import { ClockRewind } from '@openmetadata/ui-core-components/icons';
import { RecentlySearchedData, RecentlyViewedData } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { getEntityLinkFromType } from '../../../../utils/EntityLinkUtils';
import { setRecentlySearchedData } from '../../../../utils/RecentActivityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { RECENTLY_VIEWED_LIMIT } from './GlobalSearch.constants';
import {
  GlobalSearchCategory,
  GlobalSearchFilter,
  GlobalSearchListItem,
  GlobalSearchResults,
  GlobalSearchRow,
} from './GlobalSearch.types';

const RECENT_CHATS_ON_HOME = 2;

const recentlyViewedRow = (item: RecentlyViewedData): GlobalSearchRow => ({
  id: item.id ?? item.fqn,
  title: item.displayName || item.fqn,
  icon: searchClassBase.getEntityIcon(item.entityType),
  href: getEntityLinkFromType(item.fqn, item.entityType as EntityType),
});

export interface GlobalSearchItemsParams {
  query: string;
  filter: GlobalSearchFilter;
  isChatsOnly: boolean;
  results: GlobalSearchResults;
  order: GlobalSearchCategory[];
  recentSearches: RecentlySearchedData[];
  recentlyViewed: RecentlyViewedData[];
  recentChats: GlobalSearchRow[];
  /** Heading for `recentChats`, from the contributing source. */
  recentChatsLabel: string;
  previewId?: string;
  labelFor: (key: GlobalSearchCategory) => string;
  onOpen: (row: GlobalSearchRow) => void;
  onPreview: (id: string) => void;
  onSearchTerm: (term: string) => void;
  onShowType: (key: GlobalSearchCategory) => void;
}

/** The ordered sections and rows the result list renders for the current state. */
export const useGlobalSearchItems = ({
  query,
  filter,
  isChatsOnly,
  results,
  order,
  recentSearches,
  recentlyViewed,
  recentChats,
  recentChatsLabel,
  previewId,
  labelFor,
  onOpen,
  onPreview,
  onSearchTerm,
  onShowType,
}: GlobalSearchItemsParams): GlobalSearchListItem[] => {
  const { t } = useTranslation();

  return useMemo(() => {
    const items: GlobalSearchListItem[] = [];
    const section = (
      key: string,
      label: string,
      seeAll?: { label: string; onPress: () => void }
    ) => items.push({ kind: 'section', key, label, seeAll });
    const rows = (prefix: string, list: GlobalSearchRow[]) =>
      list.forEach((row) =>
        items.push({
          kind: 'row',
          key: `${prefix}-${row.id}`,
          row,
          enterLabel: t('label.open'),
          onSelect: () => onOpen(row),
        })
      );

    if (!query && isChatsOnly) {
      section('recent-chats', recentChatsLabel);
      rows('chats', recentChats);

      return items;
    }

    if (!query) {
      if (recentSearches.length) {
        section('recent-searches', t('label.recent-search-plural'));
        recentSearches.forEach(({ term }) =>
          items.push({
            kind: 'row',
            key: `recent-search-${term}`,
            row: { id: term, title: term, icon: <ClockRewind size={18} /> },
            enterLabel: t('label.search-this'),
            onSelect: () => onSearchTerm(term),
            onRemove: () =>
              setRecentlySearchedData(
                recentSearches.filter((item) => item.term !== term)
              ),
          })
        );
      }
      if (recentlyViewed.length) {
        section('recently-viewed', t('label.recently-viewed'));
        rows(
          'viewed',
          recentlyViewed.slice(0, RECENTLY_VIEWED_LIMIT).map(recentlyViewedRow)
        );
      }
      if (recentChats.length) {
        section('recent-chats', recentChatsLabel, {
          label: t('label.view-all-entity', {
            entity: labelFor('chats'),
          }),
          onPress: () => onShowType('chats'),
        });
        rows('chats', recentChats.slice(0, RECENT_CHATS_ON_HOME));
      }

      return items;
    }

    if (filter === 'all') {
      order.forEach((key) => {
        const group = results[key];
        if (!group?.count) {
          return;
        }
        const seeAll =
          group.count > group.rows.length
            ? {
                label: t('label.see-all-count', { count: group.count }),
                onPress: () => onShowType(key),
              }
            : undefined;
        section(key, labelFor(key), seeAll);
        rows(key, group.rows);
      });

      return items;
    }

    const group = results[filter];
    if (!group?.count) {
      return items;
    }
    section(filter, `${group.count} ${labelFor(filter)}`);
    if (filter !== 'assets') {
      rows(filter, group.rows);

      return items;
    }
    // Data assets preview first: the first Enter opens the summary panel,
    // the second opens the asset.
    group.rows.forEach((row) => {
      const isPreviewed = previewId === row.id;
      items.push({
        kind: 'row',
        key: `assets-${row.id}`,
        row,
        enterLabel: t(isPreviewed ? 'label.open' : 'label.preview'),
        onSelect: () => (isPreviewed ? onOpen(row) : onPreview(row.id)),
      });
    });

    return items;
  }, [
    query,
    filter,
    isChatsOnly,
    results,
    order,
    recentSearches,
    recentlyViewed,
    recentChats,
    recentChatsLabel,
    previewId,
    labelFor,
    onOpen,
    onPreview,
    onSearchTerm,
    onShowType,
    t,
  ]);
};
