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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Input, InputProps } from 'antd';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { LoadingState } from 'Models';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactComponent as IconSearchV1 } from '../../../assets/svg/search.svg';
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
  inputProps?: InputProps;
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
  inputProps,
}: SearchBarProps) => {
  const [userSearch, setUserSearch] = useState(searchValue ?? '');
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');
  const [isSearchBlur, setIsSearchBlur] = useState(true);
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

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    searchTextRef.current = searchText;
    setUserSearch(searchText);
    setLoadingState((pre) => (pre !== 'waiting' ? 'waiting' : pre));
    debounceOnSearch();
  };

  return (
    <div
      className={classNames('page-search-bar', containerClassName, {
        'm-b-md': !removeMargin,
      })}
      data-testid="search-bar-container">
      {label !== '' && <label>{label}</label>}
      <div className="flex relative">
        <Input
          allowClear={showClearSearch}
          className={classNames('p-y-xs', inputClassName)}
          data-testid={searchBarDataTestId ?? 'searchbar'}
          placeholder={placeholder}
          prefix={
            <Icon
              className={classNames('align-middle m-r-xss', {
                'text-black': isSearchBlur,
                'text-primary': !isSearchBlur,
              })}
              component={IconSearchV1}
              style={{ fontSize: '16px' }}
            />
          }
          suffix={
            showLoadingStatus &&
            loadingState === 'waiting' && (
              <div className="absolute d-block text-center">
                <Loader size="small" type="default" />
              </div>
            )
          }
          type="text"
          value={userSearch}
          onBlur={() => setIsSearchBlur(true)}
          onChange={handleChange}
          onFocus={() => setIsSearchBlur(false)}
          {...inputProps}
        />
        {showLoadingStatus && loadingState === 'waiting' && (
          <div className="absolute d-block text-center">
            <Loader size="small" type="default" />
          </div>
        )}
      </div>
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
