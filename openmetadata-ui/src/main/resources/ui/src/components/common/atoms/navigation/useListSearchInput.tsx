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

import { CloseButton, Input, Tooltip } from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconSuggestionsActive } from '../../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../../assets/svg/ic-suggestions-blue.svg';
import { useSearchStore } from '../../../../hooks/useSearchStore';

const SEARCH_DEBOUNCE_MS = 300;

interface ListSearchInputConfig {
  /** Current query, as the listing holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /** Push a new query to the listing. Debounced while typing, immediate on clear. */
  onSearchChange: (value: string) => void;
  /** Offer the NLQ toggle. Shown only once the server reports NLP enabled. */
  enableNlq?: boolean;
}

/**
 * Search box for a listing page: local input state, a debounced push to the
 * listing, and a clear button once there is something to clear.
 *
 * The listing pages render the same box twice (page header in AI mode, filter
 * bar otherwise) and the query also arrives from the URL, so the input value
 * has to live above both render sites.
 */
export const useListSearchInput = ({
  searchQuery,
  onSearchChange,
  enableNlq,
}: ListSearchInputConfig) => {
  const { t } = useTranslation();
  const [searchInputValue, setSearchInputValue] = useState(searchQuery ?? '');
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();

  // GlobalSearchBar is absent on these pages, so bootstrap the store.
  useEffect(() => {
    if (enableNlq) {
      initNLP();
    }
  }, [enableNlq, initNLP]);

  const showNlqToggle = Boolean(enableNlq) && isNLPEnabled;

  const debouncedSearch = useMemo(
    () => debounce(onSearchChange, SEARCH_DEBOUNCE_MS),
    [onSearchChange]
  );

  useEffect(() => {
    debouncedSearch.cancel();
    setSearchInputValue(searchQuery ?? '');
  }, [searchQuery, debouncedSearch]);

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleChange = useCallback(
    (value: string) => {
      setSearchInputValue(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Clearing skips the debounce - the intent is unambiguous, so holding the
  // stale result set for another 300ms just reads as lag.
  const handleClear = useCallback(() => {
    debouncedSearch.cancel();
    setSearchInputValue('');
    onSearchChange('');
  }, [debouncedSearch, onSearchChange]);

  const searchInputProps = useMemo(
    () => ({
      // `icon` is pointer-events-none, so the toggle is overlaid instead.
      icon: showNlqToggle ? undefined : SearchLg,
      placeholder: t('label.search'),
      value: searchInputValue,
      // `InputBase` sizes its trailing padding from its own tooltip/invalid
      // icons and ignores `trailingSlot`, so the slot has to buy its own room
      // or the text runs under the button.
      inputClassName: `${showNlqToggle ? 'tw:pl-11 ' : ''}${
        searchInputValue ? 'tw:pr-9' : ''
      }`.trim(),
      trailingSlot: searchInputValue ? (
        <CloseButton
          className="tw:absolute tw:right-1.5"
          label={t('label.clear-entity', { entity: t('label.search') })}
          size="xs"
          onPress={handleClear}
        />
      ) : undefined,
      onChange: handleChange,
    }),
    [handleChange, handleClear, searchInputValue, showNlqToggle, t]
  );

  const renderSearchInput = useCallback(
    (className?: string): ReactNode => (
      <div className={`tw:relative ${className ?? ''}`.trim()}>
        {showNlqToggle && (
          // Position the div, not the button: Tooltip's wrapper stays in flow.
          <div className="tw:absolute tw:left-3 tw:top-1/2 tw:z-10 tw:flex tw:-translate-y-1/2 tw:items-center">
            <Tooltip
              title={
                isNLPActive
                  ? t('message.natural-language-search-active')
                  : t('label.use-natural-language-search')
              }>
              <button
                className={`tw:flex tw:cursor-pointer tw:items-center tw:justify-center ${
                  isNLPActive
                    ? 'tw:[&_svg]:size-6 tw:[&_svg]:fill-none'
                    : 'tw:rounded-sm tw:border tw:border-secondary tw:bg-primary tw:p-1 tw:[&_svg]:size-3.5 tw:[&_svg]:fill-transparent'
                }`}
                data-testid="list-search-nlq-toggle"
                type="button"
                onClick={() => setNLPActive(!isNLPActive)}>
                {isNLPActive ? (
                  <IconSuggestionsActive />
                ) : (
                  <IconSuggestionsBlue />
                )}
              </button>
            </Tooltip>
          </div>
        )}
        {/* 44px control, matching Explore's search box. */}
        <Input
          className="tw:w-full"
          {...searchInputProps}
          inputClassName={`${
            searchInputProps.inputClassName ?? ''
          } tw:!py-3`.trim()}
        />
      </div>
    ),
    [isNLPActive, searchInputProps, setNLPActive, showNlqToggle, t]
  );

  return { searchInputValue, searchInputProps, renderSearchInput };
};
