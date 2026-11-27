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
import {
  Box,
  Button,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DomainFilterChip } from '../../../common/DomainFilterChip/DomainFilterChip.component';
import {
  GlobalSearchCategory,
  GlobalSearchFilter,
  GlobalSearchResults,
} from './GlobalSearch.types';
import GlobalSearchMoreTabs from './GlobalSearchMoreTabs';

export interface GlobalSearchTabBarProps {
  isVisible: boolean;
  filter: GlobalSearchFilter;
  shown: GlobalSearchCategory[];
  more: GlobalSearchCategory[];
  results: GlobalSearchResults;
  totalCount: number;
  /** Opened scoped to one source: only that type, plus a way out to everything. */
  scopedCategory?: GlobalSearchCategory;
  hideCounts: boolean;
  /** The query's first results are loading: tabs are not known yet. */
  isLoading?: boolean;
  labelFor: (key: GlobalSearchCategory) => string;
  onChange: (filter: GlobalSearchFilter) => void;
  onSearchEverything: () => void;
}

const TAB_SKELETON_WIDTHS = [48, 112, 96, 84];

const GlobalSearchTabBar = ({
  isVisible,
  filter,
  shown,
  more,
  results,
  totalCount,
  scopedCategory,
  hideCounts,
  isLoading = false,
  labelFor,
  onChange,
  onSearchEverything,
}: GlobalSearchTabBarProps) => {
  const { t } = useTranslation();
  // The overflow type last picked from "+N more" keeps its slot after the
  // user moves to another tab, so they can switch straight back to it.
  const [pickedMore, setPickedMore] = useState<GlobalSearchCategory>();

  if (!isVisible) {
    return null;
  }

  // Which types matched is unknown until the first results arrive, so show
  // the shape of the tab bar rather than a lone "All".
  if (isLoading && !scopedCategory) {
    return (
      <Box
        aria-busy
        align="center"
        className="tw:px-2.5 tw:py-2"
        data-testid="global-search-tabs-loading"
        gap={2}>
        {TAB_SKELETON_WIDTHS.map((width) => (
          <Skeleton height={36} key={width} variant="rounded" width={width} />
        ))}
      </Box>
    );
  }

  const countOf = (key: GlobalSearchCategory) => results[key]?.count ?? 0;
  const tabs = scopedCategory ? [scopedCategory] : shown;
  const slot =
    more.find((key) => key === filter) ??
    more.find((key) => key === pickedMore);

  const renderTab = (id: string, label: string, count: number) => (
    <Tabs.Item
      // "All" never truncates; type tabs shrink so "+N more" stays visible.
      className={id === 'all' ? 'tw:flex-none' : 'tw:min-w-0 tw:max-w-60'}
      data-testid={`global-search-tab-${id}`}
      id={id}
      key={id}>
      {({ isSelected }) => (
        <>
          <Typography
            color={isSelected ? undefined : 'secondary'}
            ellipsis={{ excludeTriggerFromTabOrder: true }}
            size="text-sm"
            weight={isSelected ? 'semibold' : 'medium'}>
            {label}
          </Typography>
          {hideCounts ? null : (
            <Typography color="quaternary" size="text-xs" weight="medium">
              {count}
            </Typography>
          )}
        </>
      )}
    </Tabs.Item>
  );

  return (
    <Box
      align="center"
      className="tw:px-2.5 tw:py-2"
      data-testid="global-search-tabs"
      gap={1}>
      <Tabs
        className="tw:w-auto tw:min-w-0"
        selectedKey={filter}
        onSelectionChange={(key) => onChange(String(key))}>
        <Tabs.List
          aria-label={t('label.filter-plural')}
          className="tw:min-w-0 tw:overflow-hidden"
          size="sm"
          type="button-gray">
          {[
            ...(scopedCategory
              ? []
              : [renderTab('all', t('label.all'), totalCount)]),
            ...tabs.map((key) => renderTab(key, labelFor(key), countOf(key))),
            ...(slot ? [renderTab(slot, labelFor(slot), countOf(slot))] : []),
          ]}
        </Tabs.List>
      </Tabs>
      <GlobalSearchMoreTabs
        countOf={countOf}
        filter={filter}
        labelFor={labelFor}
        more={more}
        slot={slot}
        onPick={(key) => {
          setPickedMore(key);
          onChange(key);
        }}
      />
      {scopedCategory ? (
        <Button
          color="tertiary"
          data-testid="global-search-everything"
          iconTrailing={ArrowRight}
          size="sm"
          onClick={onSearchEverything}>
          {t('label.search-everything')}
        </Button>
      ) : (
        <>
          <Box className="tw:flex-1" />
          <DomainFilterChip />
        </>
      )}
    </Box>
  );
};

export default GlobalSearchTabBar;
