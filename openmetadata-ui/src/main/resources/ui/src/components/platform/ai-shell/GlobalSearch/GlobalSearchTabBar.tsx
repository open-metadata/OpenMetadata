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
import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { Tab, TabList, Tabs } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { DomainFilterChip } from '../../../common/DomainFilterChip/DomainFilterChip.component';
import { TAB_CLASS } from './GlobalSearch.constants';
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
  labelFor: (key: GlobalSearchCategory) => string;
  onChange: (filter: GlobalSearchFilter) => void;
  onSearchEverything: () => void;
}

// Core `Tabs` render counts as pill badges; the design wants a plain count
// beside the label, so the tabs are react-aria tabs styled to the prototype.

const getTabClass =
  (isPinned: boolean, isSlot = false) =>
  ({
    isSelected,
    isHovered,
    isFocusVisible,
  }: {
    isSelected: boolean;
    isHovered: boolean;
    isFocusVisible: boolean;
  }) =>
    classNames(TAB_CLASS, {
      // "All" never truncates; type tabs shrink so "+N more" stays visible.
      'tw:flex-none': isPinned || isSlot,
      // The overflow slot is one pill with the chevron that switches it.
      'tw:rounded-r-none tw:pr-0.5': isSlot,
      'tw:bg-secondary_hover': isSelected,
      'tw:bg-primary_hover': isHovered && !isSelected,
      'tw:outline-2 tw:outline-focus-ring': isFocusVisible,
    });

const GlobalSearchTabBar = ({
  isVisible,
  filter,
  shown,
  more,
  results,
  totalCount,
  scopedCategory,
  hideCounts,
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

  const countOf = (key: GlobalSearchCategory) => results[key]?.count ?? 0;
  const tabs = scopedCategory ? [scopedCategory] : shown;
  const slot =
    more.find((key) => key === filter) ??
    more.find((key) => key === pickedMore);

  const renderTab = (
    id: string,
    label: string,
    count: number,
    isSlot = false
  ) => (
    <Tab
      className={getTabClass(id === 'all', isSlot)}
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
    </Tab>
  );

  return (
    <Box
      align="center"
      className="tw:px-2.5 tw:py-2"
      data-testid="global-search-tabs"
      gap={2}>
      <Tabs
        className="tw:-mr-2 tw:min-w-0"
        selectedKey={filter}
        onSelectionChange={(key) => onChange(String(key))}>
        <TabList
          aria-label={t('label.filter-plural')}
          className="tw:flex tw:items-center tw:gap-0.5 tw:overflow-hidden">
          {[
            ...(scopedCategory
              ? []
              : [renderTab('all', t('label.all'), totalCount)]),
            ...tabs.map((key) => renderTab(key, labelFor(key), countOf(key))),
            ...(slot
              ? [renderTab(slot, labelFor(slot), countOf(slot), true)]
              : []),
          ]}
        </TabList>
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
      <Box className="tw:flex-1" />
      {scopedCategory ? (
        <Button
          color="link-gray"
          data-testid="global-search-everything"
          iconTrailing={ArrowRight}
          size="sm"
          onClick={onSearchEverything}>
          {t('label.search-everything')}
        </Button>
      ) : (
        <DomainFilterChip />
      )}
    </Box>
  );
};

export default GlobalSearchTabBar;
