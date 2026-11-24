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
import { Button, Skeleton } from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  RefreshCw01,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { RESULTS_LIST_ID } from './GlobalSearch.constants';
import { GlobalSearchListItem } from './GlobalSearch.types';
import GlobalSearchResultRow from './GlobalSearchResultRow';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

export interface GlobalSearchResultListProps {
  items: GlobalSearchListItem[];
  query: string;
  activeKey?: string;
  previewId?: string;
  isFirstLoad: boolean;
  hasError: boolean;
  isEmpty: boolean;
  /** Opened from Recent Chat: the empty state names the type and offers a way out. */
  isScoped: boolean;
  /** Replaces the default no-results hint, e.g. to point at the assistant. */
  emptyHintKey?: string;
  scopeLabel: string;
  onHover: (key: string) => void;
  onRetry: () => void;
  onSearchEverywhere: () => void;
}

const GlobalSearchResultList = ({
  items,
  query,
  activeKey,
  previewId,
  isFirstLoad,
  hasError,
  isEmpty,
  isScoped,
  emptyHintKey,
  scopeLabel,
  onHover,
  onRetry,
  onSearchEverywhere,
}: GlobalSearchResultListProps) => {
  const { t } = useTranslation();

  if (isFirstLoad) {
    return (
      <div aria-busy className="tw:flex tw:flex-col tw:px-2">
        {SKELETON_ROWS.map((index) => (
          <div
            className="tw:flex tw:items-center tw:gap-3 tw:px-3 tw:py-2"
            key={index}>
            <Skeleton height={32} variant="rounded" width={32} />
            <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1">
              <Skeleton width="40%" />
              <Skeleton width="65%" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className="tw:m-4 tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:p-4"
        role="alert">
        <span className="tw:text-fg-warning-primary">
          <AlertCircle size={20} />
        </span>
        <div className="tw:flex tw:flex-1 tw:flex-col">
          <span className="tw:text-sm tw:font-semibold tw:text-primary">
            {t('message.global-search-error-title')}
          </span>
          <span className="tw:text-sm tw:text-tertiary">
            {t('message.global-search-error-description')}
          </span>
        </div>
        <Button
          color="secondary"
          data-testid="global-search-retry"
          iconLeading={RefreshCw01}
          size="sm"
          onClick={onRetry}>
          {t('label.try-again')}
        </Button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        className="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:px-6 tw:py-12 tw:text-center"
        data-testid="global-search-empty">
        <span className="tw:text-sm tw:font-semibold tw:text-primary">
          {isScoped
            ? t('message.global-search-no-type-match', {
                type: scopeLabel.toLowerCase(),
                query,
              })
            : t('message.global-search-no-result', { query })}
        </span>
        <span className="tw:text-sm tw:text-tertiary">
          {t(emptyHintKey ?? 'message.global-search-no-result-hint')}
        </span>
        {isScoped ? (
          <Button color="secondary" size="sm" onClick={onSearchEverywhere}>
            {t('label.search-everywhere')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      aria-label={t('label.result-plural')}
      className="tw:flex tw:flex-col tw:gap-0.5 tw:px-2 tw:pb-2"
      id={RESULTS_LIST_ID}
      role="listbox">
      {items.map((item) =>
        item.kind === 'section' ? (
          <div
            className="tw:flex tw:items-center tw:justify-between tw:px-3 tw:pt-3 tw:pb-1"
            key={item.key}
            role="presentation">
            <span className="tw:text-xs tw:font-medium tw:text-tertiary">
              {item.label}
            </span>
            {item.seeAll ? (
              <Button
                color="link-color"
                size="sm"
                onClick={item.seeAll.onPress}>
                {item.seeAll.label}
              </Button>
            ) : null}
          </div>
        ) : (
          <GlobalSearchResultRow
            enterHint={item.enterLabel}
            id={`global-search-option-${item.key}`}
            isActive={activeKey === item.key}
            isPreviewed={previewId === item.row.id}
            key={item.key}
            query={query}
            row={item.row}
            onHover={() => onHover(item.key)}
            onRemove={item.onRemove}
            onSelect={item.onSelect}
          />
        )
      )}
    </div>
  );
};

export default GlobalSearchResultList;
