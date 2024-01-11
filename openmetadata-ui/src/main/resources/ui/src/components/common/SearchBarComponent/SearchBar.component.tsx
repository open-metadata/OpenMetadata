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

import { Input, InputProps } from 'antd';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { LoadingState } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Loader from '../../Loader/Loader';

type Props = {
  onSearch: (text: string) => void;
  searchValue: string;
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
}: Props) => {
  const [userSearch, setUserSearch] = useState('');
  const [searchIcon, setSearchIcon] = useState<string>(Icons.SEARCHV1);
  const [loadingState, setLoadingState] = useState<LoadingState>('initial');

  useEffect(() => {
    setUserSearch(searchValue);
  }, [searchValue]);

  const debouncedOnSearch = useCallback(
    (searchText: string): void => {
      setLoadingState((pre) => (pre === 'waiting' ? 'success' : pre));
      onSearch(searchText);
    },
    [onSearch]
  );

  const debounceOnSearch = useCallback(
    debounce(debouncedOnSearch, typingInterval),
    [debouncedOnSearch]
  );

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    setUserSearch(searchText);
    setLoadingState((pre) => (pre !== 'waiting' ? 'waiting' : pre));
    debounceOnSearch(searchText);
  };

  return (
    <div
      className={classNames('page-search-bar', {
        'm-b-md': !removeMargin,
      })}
      data-testid="search-bar-container">
      {label !== '' && <label>{label}</label>}
      <div className="flex relative">
        <Input
          allowClear={showClearSearch}
          data-testid={searchBarDataTestId ?? 'searchbar'}
          placeholder={placeholder}
          prefix={<SVGIcons alt="icon-search" icon={searchIcon} />}
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
          onBlur={() => setSearchIcon(Icons.SEARCHV1)}
          onChange={handleChange}
          onFocus={() => setSearchIcon(Icons.SEARCHV1COLOR)}
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
