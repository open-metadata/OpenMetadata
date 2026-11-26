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
import { FeaturedIcon } from '@openmetadata/ui-core-components';
import { ClockRewind } from '@openmetadata/ui-core-components/icons';
import { RecentlySearchedData, RecentlyViewedData } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import { getEntityLinkFromType } from '../../../../utils/EntityLinkUtils';
import { setRecentlySearchedData } from '../../../../utils/RecentActivityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import {
  ASSETS_CATEGORY,
  RECENTLY_VIEWED_LIMIT,
  RECENT_SOURCE_ROWS,
} from './GlobalSearch.constants';
import {
  GlobalSearchCategory,
  GlobalSearchFilter,
  GlobalSearchListItem,
  GlobalSearchResults,
  GlobalSearchRow,
} from './GlobalSearch.types';
import { getEntityRowMeta, getFqnParents } from './useGlobalSearchResults';

const recentlyViewedRow = (item: RecentlyViewedData): GlobalSearchRow => ({
  id: item.id ?? item.fqn,
  title: item.displayName || item.fqn,
  icon: searchClassBase.getEntityIconWithBg(
    item.entityType,
    EntityIconSize.Size18
  ),
  meta: getEntityRowMeta(item.entityType, getFqnParents(item.fqn)),
  href: getEntityLinkFromType(item.fqn, item.entityType as EntityType),
});

export interface GlobalSearchSourceRecent {
  key: GlobalSearchCategory;
  label: string;
  rows: GlobalSearchRow[];
}

export interface GlobalSearchItemsParams {
  query: string;
  filter: GlobalSearchFilter;
  /** Opened scoped to one source: only its recent rows before typing. */
  scopedCategory?: GlobalSearchCategory;
  results: GlobalSearchResults;
  order: GlobalSearchCategory[];
  recentSearches: RecentlySearchedData[];
  recentlyViewed: RecentlyViewedData[];
  sourceRecents: GlobalSearchSourceRecent[];
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
  scopedCategory,
  results,
  order,
  recentSearches,
  recentlyViewed,
  sourceRecents,
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
      extra: Partial<Extract<GlobalSearchListItem, { kind: 'section' }>> = {}
    ) => items.push({ kind: 'section', key, label, ...extra });
    const rows = (prefix: string, list: GlobalSearchRow[]) =>
      list.forEach((row) =>
        items.push({
          kind: 'row',
          key: `${prefix}-${row.id}`,
          row,
          enterLabel: row.enterLabel ?? t('label.open'),
          onSelect: () => onOpen(row),
        })
      );

    if (!query) {
      if (scopedCategory) {
        sourceRecents
          .filter((recent) => recent.key === scopedCategory)
          .forEach((recent) => {
            section(`recent-${recent.key}`, recent.label);
            rows(recent.key, recent.rows);
          });

        return items;
      }
      if (recentSearches.length) {
        section('recent-searches', t('label.recent-search-plural'));
        recentSearches.forEach(({ term }) =>
          items.push({
            kind: 'row',
            key: `recent-search-${term}`,
            row: {
              id: term,
              title: term,
              icon: <FeaturedIcon color="gray" icon={ClockRewind} size="sm" />,
            },
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
      sourceRecents
        .filter((recent) => recent.rows.length > 0)
        .forEach((recent) => {
          section(`recent-${recent.key}`, recent.label);
          rows(recent.key, recent.rows.slice(0, RECENT_SOURCE_ROWS));
        });

      return items;
    }

    if (filter === 'all') {
      order.forEach((key) => {
        const group = results[key];
        if (!group?.count) {
          return;
        }
        section(key, labelFor(key), {
          seeAll:
            group.count > group.rows.length
              ? {
                  label: t('label.see-all-count', { count: group.count }),
                  onPress: () => onShowType(key),
                }
              : undefined,
        });
        rows(key, group.rows);
      });

      return items;
    }

    const group = results[filter];
    if (!group?.count) {
      return items;
    }
    section(filter, `${group.count} ${labelFor(filter)}`, {
      hasSort: filter === ASSETS_CATEGORY,
    });
    if (filter !== ASSETS_CATEGORY) {
      rows(filter, group.rows);

      return items;
    }
    // Data assets preview first: the first Enter opens the summary panel,
    // the second opens the asset.
    group.rows.forEach((row) => {
      const isPreviewed = previewId === row.id;
      items.push({
        kind: 'row',
        key: `${ASSETS_CATEGORY}-${row.id}`,
        row,
        enterLabel: t(isPreviewed ? 'label.open' : 'label.preview'),
        onSelect: () => (isPreviewed ? onOpen(row) : onPreview(row.id)),
      });
    });

    return items;
  }, [
    query,
    filter,
    scopedCategory,
    results,
    order,
    recentSearches,
    recentlyViewed,
    sourceRecents,
    previewId,
    labelFor,
    onOpen,
    onPreview,
    onSearchTerm,
    onShowType,
    t,
  ]);
};
