/*
 *  Copyright 2025 Collate.
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
import Icon from '@ant-design/icons';
import { Input, Popover, Select } from 'antd';
import classNames from 'classnames';
import { debounce, isString } from 'lodash';
import Qs from 'qs';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconCloseCircleOutlined } from '../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as IconSearch } from '../../assets/svg/search.svg';
import { getExplorePath, TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { isTourRoute } from '../../utils/AuthProvider.util';
import { addToRecentSearched } from '../../utils/CommonUtils';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import SearchOptions from '../AppBar/SearchOptions';
import Suggestions from '../AppBar/Suggestions';
import './global-search-bar.less';

export const GlobalSearchBar = () => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const { searchCriteria, updateSearchCriteria } = useApplicationStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [isSearchBlur, setIsSearchBlur] = useState<boolean>(true);
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const location = useCustomLocation();
  const pathname = location.pathname;
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState<boolean>(false);
  const history = useHistory();
  const { isTourOpen, updateTourPage, updateTourSearch } = useTourProvider();

  const parsedQueryString = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substr(1)
      : location.search
  );
  const searchQuery = isString(parsedQueryString.search)
    ? parsedQueryString.search
    : '';
  const [searchValue, setSearchValue] = useState<string>(searchQuery);

  const entitiesSelect = useMemo(
    () => (
      <Select
        defaultActiveFirstOption
        bordered={false}
        className="global-search-select"
        data-testid="global-search-selector"
        listHeight={300}
        popupClassName="global-search-select-menu"
        size="small"
        value={searchCriteria}
        onChange={updateSearchCriteria}>
        {searchClassBase.getGlobalSearchOptions().map(({ value, label }) => (
          <Select.Option
            data-testid={`global-search-select-option-${label}`}
            key={value}
            value={value}>
            {label}
          </Select.Option>
        ))}
      </Select>
    ),
    [searchCriteria]
  );

  const handleSelectOption = useCallback((text: string) => {
    history.replace({
      search: `?withinPageSearch=${text}`,
    });
  }, []);

  const debouncedOnChange = useCallback(
    (text: string): void => {
      setSuggestionSearch(text);
    },
    [setSuggestionSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const searchHandler = (value: string) => {
    if (!isTourOpen) {
      setIsSearchBoxOpen(false);
      addToRecentSearched(value);

      const defaultTab: string =
        searchCriteria !== '' ? tabsInfo[searchCriteria].path : '';

      history.push(
        getExplorePath({
          tab: defaultTab,
          search: value,
          isPersistFilters: true,
          extraParameters: {
            sort: '_score',
          },
        })
      );
    }
  };

  const handleClear = () => {
    setSearchValue('');
    searchHandler('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      if (isTourOpen && searchValue === TOUR_SEARCH_TERM) {
        updateTourPage(CurrentTourPageType.EXPLORE_PAGE);
        updateTourSearch('');
      }

      searchHandler(target.value);
    }
  };

  const handleOnClick = () => {
    searchHandler(searchValue);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (isTourOpen) {
      updateTourSearch(value);
    } else {
      value ? setIsSearchBoxOpen(true) : setIsSearchBoxOpen(false);
    }
  };

  return (
    <div
      className="flex-center search-container"
      data-testid="navbar-search-container"
      ref={searchContainerRef}>
      <Popover
        content={
          !isTourRoute &&
          searchValue &&
          (isInPageSearchAllowed(pathname) ? (
            <SearchOptions
              isOpen={isSearchBoxOpen}
              options={inPageSearchOptions(pathname)}
              searchText={searchValue}
              selectOption={handleSelectOption}
              setIsOpen={setIsSearchBoxOpen}
            />
          ) : (
            <Suggestions
              isOpen={isSearchBoxOpen}
              searchCriteria={
                searchCriteria === '' ? undefined : searchCriteria
              }
              searchText={suggestionSearch}
              setIsOpen={setIsSearchBoxOpen}
            />
          ))
        }
        getPopupContainer={() => searchContainerRef.current || document.body}
        open={isSearchBoxOpen}
        overlayClassName="global-search-overlay"
        overlayStyle={{ width: '100%', paddingTop: 0 }}
        placement="bottomRight"
        showArrow={false}
        trigger={['click']}
        onOpenChange={setIsSearchBoxOpen}>
        <Input
          autoComplete="off"
          bordered={false}
          className="rounded-4 appbar-search"
          data-testid="searchBox"
          id="searchBox"
          placeholder={t('label.search-for-type', {
            type: t('label.data-asset-plural'),
          })}
          type="text"
          value={searchValue}
          onBlur={() => {
            setIsSearchBlur(true);
          }}
          onChange={(e) => {
            const { value } = e.target;
            debounceOnSearch(value);
            handleSearchChange(value);
          }}
          onFocus={() => {
            setIsSearchBlur(false);
          }}
          onKeyDown={handleKeyDown}
        />
      </Popover>

      {entitiesSelect}

      {searchValue ? (
        <Icon
          alt="icon-cancel"
          className={classNames('align-middle', {
            'text-primary': !isSearchBlur,
          })}
          component={IconCloseCircleOutlined}
          data-testid="cancel-icon"
          style={{ fontSize: '16px' }}
          onClick={handleClear}
        />
      ) : (
        <Icon
          alt="icon-search"
          className={classNames('align-middle', {
            'text-grey-3': isSearchBlur,
            'text-primary': !isSearchBlur,
          })}
          component={IconSearch}
          data-testid="search-icon"
          style={{ fontSize: '16px' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOnClick();
          }}
        />
      )}
    </div>
  );
};
