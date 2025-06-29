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
import { Button, Divider, Input, Popover, Select, Tooltip } from 'antd';
import classNames from 'classnames';
import { debounce, isEmpty, isString } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconCloseCircleOutlined } from '../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as DropDownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as IconSuggestionsActive } from '../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../assets/svg/ic-suggestions-blue.svg';
import { ReactComponent as IconSearch } from '../../assets/svg/search.svg';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import { getNLPEnabledStatus } from '../../rest/searchAPI';
import { addToRecentSearched } from '../../utils/CommonUtils';
import {
  getExplorePath,
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
  const { isNLPEnabled, isNLPActive, setNLPActive, setNLPEnabled } =
    useSearchStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [isSearchBlur, setIsSearchBlur] = useState<boolean>(true);
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const location = useCustomLocation();
  const pathname = location.pathname;
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const { isTourOpen, updateTourPage, updateTourSearch } = useTourProvider();
  const { currentUser } = useApplicationStore();
  const parsedQueryString = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substring(1)
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
        suffixIcon={<DropDownIcon width={12} />}
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
    navigate(
      {
        search: `?withinPageSearch=${text}`,
      },
      {
        replace: true,
      }
    );
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

      navigate(
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

  const fetchNLPEnabledStatus = useCallback(() => {
    if (!isEmpty(currentUser)) {
      getNLPEnabledStatus().then((enabled) => {
        setNLPEnabled(enabled);
      });
    }
  }, [setNLPEnabled, currentUser]);

  useEffect(() => {
    fetchNLPEnabledStatus();
  }, [fetchNLPEnabledStatus]);

  return (
    <div
      className="flex-center search-container relative"
      data-testid="navbar-search-container"
      ref={searchContainerRef}>
      {isNLPEnabled && (
        <>
          <Tooltip
            title={
              isNLPActive
                ? t('message.natural-language-search-active')
                : t('label.use-natural-language-search')
            }>
            <Button
              className={classNames('nav-search-button', 'w-6', 'h-6', {
                active: isNLPActive,
              })}
              data-testid="nlp-suggestions-button"
              icon={
                <Icon
                  component={
                    isNLPActive ? IconSuggestionsActive : IconSuggestionsBlue
                  }
                />
              }
              type="text"
              onClick={() => setNLPActive(!isNLPActive)}
            />
          </Tooltip>
          <Divider className="h-5" type="vertical" />
        </>
      )}
      <Popover
        align={{ offset: [0, 12] }}
        content={
          !isTourOpen &&
          (searchValue || isNLPActive) &&
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
              isNLPActive={isNLPActive}
              isOpen={isSearchBoxOpen}
              searchCriteria={
                searchCriteria === '' ? undefined : searchCriteria
              }
              searchText={suggestionSearch}
              setIsOpen={setIsSearchBoxOpen}
              onSearchTextUpdate={handleSearchChange}
            />
          ))
        }
        getPopupContainer={() => searchContainerRef.current || document.body}
        open={isSearchBoxOpen}
        overlayClassName="global-search-overlay"
        overlayStyle={{ paddingTop: 0, width: '100%' }}
        placement="bottom"
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
      <Divider className="h-5 m-r-md" type="vertical" />
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
            'text-color': isSearchBlur,
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
