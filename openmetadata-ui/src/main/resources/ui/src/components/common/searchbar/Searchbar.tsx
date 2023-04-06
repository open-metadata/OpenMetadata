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

import { Input } from 'antd';
import { ReactComponent as ClearIcon } from 'assets/svg/close-circle-outlined.svg';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { LoadingState } from 'Models';
import PropTypes from 'prop-types';
import React, { ChangeEvent, useCallback, useEffect, useState } from 'react';
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
};

const Searchbar = ({
  onSearch,
  searchValue,
  typingInterval = 0,
  placeholder,
  label,
  removeMargin = false,
  showLoadingStatus = false,
  showClearSearch = false,
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
      className={classNames('tw-group page-search-bar', {
        'tw-mb-4': !removeMargin,
      })}
      data-testid="search-bar-container">
      {label !== '' && <label>{label}</label>}
      <div className="flex relative">
        <Input
          data-testid="searchbar"
          placeholder={placeholder}
          prefix={
            <SVGIcons
              alt="icon-search"
              className="tw-w-4 tw-h-4 tw-mr-0.5"
              icon={searchIcon}
            />
          }
          type="text"
          value={userSearch}
          onBlur={() => setSearchIcon(Icons.SEARCHV1)}
          onChange={handleChange}
          onFocus={() => setSearchIcon(Icons.SEARCHV1COLOR)}
        />
        {showLoadingStatus && loadingState === 'waiting' && (
          <div className="tw-absolute tw-block tw-z-1 tw-w-4 tw-h-4 tw-top-2 tw-right-2.5 tw-text-center tw-pointer-events-none">
            <Loader size="small" type="default" />
          </div>
        )}
        {showClearSearch && searchValue && (
          <div
            className="tw-absolute tw-block tw-z-1 tw-w-4 tw-h-4 tw-top-2 tw-right-2.5 tw-text-center cursor-pointer"
            onClick={() =>
              handleChange({ target: { value: '' } } as ChangeEvent)
            }>
            <ClearIcon height={16} />
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

Searchbar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  searchValue: PropTypes.string,
  typingInterval: PropTypes.number,
  placeholder: PropTypes.string,
  label: PropTypes.string,
};

export default Searchbar;
