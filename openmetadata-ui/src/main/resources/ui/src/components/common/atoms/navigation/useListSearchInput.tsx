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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SEARCH_DEBOUNCE_MS = 300;

interface ListSearchInputConfig {
  /** Current query, as the listing holds it (usually mirrored from the URL). */
  searchQuery?: string;
  /** Push a new query to the listing. Debounced while typing, immediate on clear. */
  onSearchChange: (value: string) => void;
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
}: ListSearchInputConfig) => {
  const { t } = useTranslation();
  const [searchInputValue, setSearchInputValue] = useState(searchQuery ?? '');

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

  return { searchInputValue, searchInputProps };
};
