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
import { Input, InputProps, InputRef } from 'antd';
import classNames from 'classnames';
import { debounce } from 'lodash';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
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
  disabled?: boolean;
  isLoading?: boolean;
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
  disabled,
  isLoading = false,
}: SearchBarProps) => {
  const [userSearch, setUserSearch] = useState(searchValue ?? '');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearchBlur, setIsSearchBlur] = useState(true);
  const isTypingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const latestSearchTextRef = useRef<string>('');

  useEffect(() => {
    if (!isTypingRef.current && searchValue !== userSearch) {
      setUserSearch(searchValue ?? '');
    }
  }, [searchValue, userSearch]);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const debouncedOnSearch = useCallback(
    debounce(() => {
      setIsTyping(false);
      onSearch(latestSearchTextRef.current);
      isTypingRef.current = false;
    }, typingInterval),
    [typingInterval, onSearch]
  );

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    isTypingRef.current = true;
    setUserSearch(searchText);
    latestSearchTextRef.current = searchText;
    setIsTyping(true);
    debouncedOnSearch();
  };

  const showLoading = showLoadingStatus && (isLoading || isTyping);

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
          disabled={disabled}
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
          ref={inputRef as unknown as RefObject<InputRef>}
          suffix={
            showLoading && (
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
