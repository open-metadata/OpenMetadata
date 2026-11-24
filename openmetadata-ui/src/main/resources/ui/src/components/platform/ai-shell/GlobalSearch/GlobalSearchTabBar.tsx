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
import { Button, FilterSelect } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { DomainFilterChip } from '../../../common/DomainFilterChip/DomainFilterChip.component';
import {
  GlobalSearchCategory,
  GlobalSearchFilter,
  GlobalSearchResults,
} from './GlobalSearch.types';

export interface GlobalSearchTabBarProps {
  isVisible: boolean;
  filter: GlobalSearchFilter;
  shown: GlobalSearchCategory[];
  more: GlobalSearchCategory[];
  results: GlobalSearchResults;
  totalCount: number;
  /** Opened from Recent Chat: only Chats, plus a way out to everything. */
  isChatsOnly: boolean;
  hideCounts: boolean;
  isCounting: boolean;
  labelFor: (key: GlobalSearchCategory) => string;
  onChange: (filter: GlobalSearchFilter) => void;
  onSearchEverything: () => void;
}

const GlobalSearchTabBar = ({
  isVisible,
  filter,
  shown,
  more,
  results,
  totalCount,
  isChatsOnly,
  hideCounts,
  isCounting,
  labelFor,
  onChange,
  onSearchEverything,
}: GlobalSearchTabBarProps) => {
  const { t } = useTranslation();
  const selectedMore = more.find((key) => key === filter);

  const renderTab = (key: GlobalSearchFilter, label: string, count: number) => {
    const isSelected = filter === key;

    return (
      <button
        aria-selected={isSelected}
        className={classNames(
          'tw:flex tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-md tw:border-0 tw:px-2.5 tw:py-1 tw:text-sm',
          isSelected
            ? 'tw:bg-active tw:font-semibold tw:text-primary'
            : 'tw:bg-transparent tw:font-medium tw:text-tertiary'
        )}
        data-testid={`global-search-tab-${key}`}
        key={key}
        role="tab"
        type="button"
        onClick={() => onChange(key)}>
        <span>{label}</span>
        {hideCounts ? null : (
          <span className="tw:text-xs tw:text-quaternary">
            {isCounting ? '·' : count}
          </span>
        )}
      </button>
    );
  };

  const countOf = (key: GlobalSearchCategory) => results[key]?.count ?? 0;
  const tabs: GlobalSearchCategory[] = isChatsOnly
    ? ['chats']
    : [...shown, ...(selectedMore ? [selectedMore] : [])];

  if (!isVisible) {
    return null;
  }

  return (
    <div className="tw:flex tw:items-center tw:gap-1 tw:px-4 tw:py-2">
      <div
        aria-label={t('label.filter-plural')}
        className="tw:flex tw:items-center tw:gap-1"
        role="tablist">
        {isChatsOnly ? null : renderTab('all', t('label.all'), totalCount)}
        {tabs.map((key) => renderTab(key, labelFor(key), countOf(key)))}
      </div>
      {more.length > 0 ? (
        <FilterSelect
          data-testid="global-search-more-tabs"
          label={t('label.plus-count-more', { count: more.length })}
          options={more.map((key) => ({
            value: key,
            label: labelFor(key),
            count: countOf(key),
          }))}
          selectedValues={selectedMore ? [selectedMore] : []}
          selectionMode="single"
          size="sm"
          triggerVariant="chip"
          onChange={(values) =>
            values[0] && onChange(values[0] as GlobalSearchCategory)
          }
        />
      ) : null}
      <span className="tw:flex-1" />
      {isChatsOnly ? (
        <Button
          color="link-color"
          data-testid="global-search-everything"
          iconTrailing={ArrowRight}
          size="sm"
          onClick={onSearchEverything}>
          {t('label.search-everything')}
        </Button>
      ) : (
        <DomainFilterChip />
      )}
    </div>
  );
};

export default GlobalSearchTabBar;
