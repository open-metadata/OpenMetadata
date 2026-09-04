/*
 *  Copyright 2022 Collate.
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

import { Input } from '@openmetadata/ui-core-components';
import { SearchMd } from '@untitledui/icons';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { LoadingState } from 'Models';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactComponent as CloseOutlined } from '../../../assets/svg/close.svg';
import Loader from '../Loader/Loader';
import './search-bar.less';

export type SearchBarProps = {
  inputClassName?: string;
  containerClassName?: string;
  onSearch: (text: string) => void;
  searchValue?: string;
  typingInterval?: number;
  placeholder?: string;
  label?: string;
  removeMargin?: boolean;
  showLoadingStatus?: boolean;
  showClearSearch?: boolean;
  searchBarDataTestId?: string;
};

const Searchbar = ({
  inputClassName = '',
  containerClassName = '',
  onSearch,
  searchValue,
  typingInterval = 0,
  placeholder,
  label,
  removeMargin = false,
  showLoadingStatus = false,
  showClearSearch = true,
  searchBarDataTestId,
}: SearchBarProps) => {
  const [userSearch, setUserSearch] = useState(searchValue ?? '');
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');
  const searchTextRef = useRef(searchValue ?? '');

  useEffect(() => {
    setUserSearch(searchValue ?? '');
    searchTextRef.current = searchValue ?? '';
  }, [searchValue]);

  const debouncedOnSearch = useCallback((): void => {
    setLoadingState((pre) => (pre === 'waiting' ? 'success' : pre));
    onSearch(searchTextRef.current);
  }, [onSearch]);

  const debounceOnSearch = useCallback(
    debounce(debouncedOnSearch, typingInterval),
    [debouncedOnSearch, typingInterval]
  );

  const handleChange = (searchText: string): void => {
    searchTextRef.current = searchText;
    setUserSearch(searchText);
    setLoadingState((pre) => (pre !== 'waiting' ? 'waiting' : pre));
    debounceOnSearch();
  };

  const handleClear = (): void => {
    searchTextRef.current = '';
    setUserSearch('');
    onSearch('');
  };

  const trailingSlot =
    showClearSearch && userSearch ? (
      <button
        aria-label="Clear search"
        className="tw:flex tw:items-center tw:justify-center tw:text-tertiary hover:tw:text-primary"
        type="button"
        onClick={handleClear}>
        <CloseOutlined aria-hidden className="tw:size-3" />
      </button>
    ) : showLoadingStatus && loadingState === 'waiting' ? (
      <Loader size="small" type="default" />
    ) : undefined;

  return (
    <div
      className={classNames('page-search-bar', containerClassName, {
        'm-b-md': !removeMargin,
      })}
      data-testid="search-bar-container">
      {label !== '' && <span>{label}</span>}
      <Input
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        icon={SearchMd as any}
        inputClassName={inputClassName}
        inputDataTestId={searchBarDataTestId ?? 'searchbar'}
        placeholder={placeholder}
        trailingSlot={trailingSlot}
        value={userSearch}
        onChange={handleChange}
      />
    </div>
  );
};

Searchbar.defaultProps = {
  searchValue: '',
  typingInterval: 1000,
  placeholder: 'Search...',
  label: '',
};

export default Searchbar;
