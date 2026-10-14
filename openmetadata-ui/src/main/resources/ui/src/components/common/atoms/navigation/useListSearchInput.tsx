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

import { CloseButton } from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SEARCH_DEBOUNCE_MS = 300;

interface ListSearchInputConfig {
  /** Current query, as the listing holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /** Push a new query to the listing. Debounced while typing, immediate on clear. */
  onSearchChange: (value: string) => void;
  /**
   * Push only on submit, never while typing. For a query too costly to run on
   * every pause, such as natural-language search, which runs an LLM step per call.
   */
  submitOnly?: boolean;
  /**
   * Re-run the current query. Enter on unchanged text calls this instead of
   * pushing the same value again, e.g. to run it as NLQ once the toggle is on.
   */
  onRefresh?: () => void;
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
  submitOnly = false,
  onRefresh,
}: ListSearchInputConfig) => {
  const { t } = useTranslation();
  const [searchInputValue, setSearchInputValue] = useState(searchQuery ?? '');

  // Held in a ref so the debounce is built once. The callback usually chains
  // down to react-router's `setSearchParams`, whose identity changes on every
  // URL change - rebuilding the debounce there would cancel it mid-flight.
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const debouncedSearch = useMemo(
    () =>
      debounce(
        (value: string) => onSearchChangeRef.current(value),
        SEARCH_DEBOUNCE_MS
      ),
    []
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

  // A push still waiting on the debounce must not land once pushes are
  // submit-only, or it would run as the costly query after all.
  useEffect(() => {
    if (submitOnly) {
      debouncedSearch.cancel();
    }
  }, [submitOnly, debouncedSearch]);

  const handleChange = useCallback(
    (value: string) => {
      setSearchInputValue(value);
      if (!submitOnly) {
        debouncedSearch(value);
      }
    },
    [debouncedSearch, submitOnly]
  );

  // Enter applies the query now rather than waiting out the debounce.
  const handleSubmit = useCallback(() => {
    debouncedSearch.cancel();
    const isUnchanged = searchInputValue === (searchQuery ?? '');
    if (isUnchanged && onRefreshRef.current) {
      onRefreshRef.current();
    } else {
      onSearchChangeRef.current(searchInputValue);
    }
  }, [debouncedSearch, searchInputValue, searchQuery]);

  // Clearing skips the debounce - the intent is unambiguous, so holding the
  // stale result set for another 300ms just reads as lag.
  const handleClear = useCallback(() => {
    debouncedSearch.cancel();
    setSearchInputValue('');
    onSearchChangeRef.current('');
  }, [debouncedSearch]);

  const searchInputProps = useMemo(
    () => ({
      icon: SearchLg,
      placeholder: t('label.search'),
      value: searchInputValue,
      // `InputBase` sizes its trailing padding from its own tooltip/invalid
      // icons and ignores `trailingSlot`, so the slot has to buy its own room
      // or the text runs under the button.
      inputClassName: searchInputValue ? 'tw:pr-9' : undefined,
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
    [handleChange, handleClear, searchInputValue, t]
  );

  return {
    searchInputValue,
    searchInputProps,
    handleChange,
    handleSubmit,
    handleClear,
  };
};
