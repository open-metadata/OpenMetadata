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
import {
  ButtonUtility,
  Divider,
  Input,
  Select,
  SelectPopover,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { debounce, isEmpty, isString } from 'lodash';
import Qs from 'qs';
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useInteractOutside } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { ReactComponent as IconCloseCircleOutlined } from '../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as IconSuggestionsActive } from '../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../assets/svg/ic-suggestions-blue.svg';
import { ReactComponent as IconSearch } from '../../assets/svg/search.svg';
import { TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../hooks/useSearchStore';
import { ExploreSearchIndex } from '../../interface/discovery/explore.interface';
import { addToRecentSearched } from '../../utils/RecentActivityUtils';
import {
  getExplorePath,
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import searchClassBase from '../../utils/SearchClassBase';
import SearchOptions from '../AppBar/SearchOptions';
import Suggestions from '../AppBar/Suggestions';
import './global-search-bar.less';

// Pure helpers pulled out of the component body so the branches they need
// (parsing the querystring, deciding whether to show search content) don't
// accumulate in the component's own cyclomatic complexity.
const parseSearchQueryFromLocationSearch = (search: string): string => {
  const parsedQueryString = Qs.parse(
    search.startsWith('?') ? search.substring(1) : search
  );

  return isString(parsedQueryString.search) ? parsedQueryString.search : '';
};

const getShouldShowSearchContent = (
  isTourOpen: boolean,
  searchValue: string,
  isNLPActive: boolean
): boolean => !isTourOpen && (Boolean(searchValue) || isNLPActive);

// The "All" criteria is an empty string, which react-aria cannot use as a key.
const ALL_SEARCH_CRITERIA_KEY = 'all';

export const GlobalSearchBar = () => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const { searchCriteria, updateSearchCriteria, currentUser } =
    useApplicationStore(
      useShallow((state) => ({
        searchCriteria: state.searchCriteria,
        updateSearchCriteria: state.updateSearchCriteria,
        currentUser: state.currentUser,
      }))
    );
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { t, i18n } = useTranslation();
  const [isSearchBlur, setIsSearchBlur] = useState<boolean>(true);
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const location = useCustomLocation();
  const pathname = location.pathname;
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const { isTourOpen, updateTourPage, updateTourSearch } = useTourProvider();
  const searchQuery = parseSearchQueryFromLocationSearch(location.search);
  const [searchValue, setSearchValue] = useState<string>(searchQuery);

  const entitiesSelect = useMemo(
    () => (
      <Select
        aria-label={t('label.search-index')}
        data-testid="global-search-selector"
        popoverClassName="tw:w-50"
        selectedKey={searchCriteria || ALL_SEARCH_CRITERIA_KEY}
        onSelectionChange={(key) =>
          key !== null &&
          updateSearchCriteria(
            key === ALL_SEARCH_CRITERIA_KEY
              ? ''
              : (String(key) as ExploreSearchIndex)
          )
        }>
        {searchClassBase.getGlobalSearchOptions().map(({ value, label }) => (
          <Select.Item
            data-testid={`global-search-select-option-${label}`}
            id={value || ALL_SEARCH_CRITERIA_KEY}
            key={value || ALL_SEARCH_CRITERIA_KEY}
            label={label}
          />
        ))}
      </Select>
    ),
    [searchCriteria, i18n.language, t, updateSearchCriteria]
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
    if (pathname === '/explore' || pathname.startsWith('/explore/')) {
      navigate(getExplorePath({ search: '', isPersistFilters: true }));
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
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

  useEffect(() => {
    if (!isEmpty(currentUser)) {
      initNLP();
    }
  }, [currentUser]);

  const shouldShowSearchContent = getShouldShowSearchContent(
    isTourOpen,
    searchValue,
    isNLPActive
  );

  const renderNlpToggle = () => {
    if (!isNLPEnabled) {
      return null;
    }

    return (
      <>
        <ButtonUtility
          data-testid="nlp-suggestions-button"
          icon={isNLPActive ? IconSuggestionsActive : IconSuggestionsBlue}
          size="xs"
          tooltip={
            isNLPActive
              ? t('message.natural-language-search-active')
              : t('label.use-natural-language-search')
          }
          onClick={() => setNLPActive(!isNLPActive)}
        />
        <Divider
          className="h-5 tw:mx-2 tw:self-center"
          orientation="vertical"
        />
      </>
    );
  };

  // Non-modal popovers skip react-aria's outside-press dismissal; restore the
  // antd behaviour. The popover is portaled, so presses inside it land
  // outside the search container and are filtered by class.
  useInteractOutside({
    ref: searchContainerRef,
    isDisabled: !isSearchBoxOpen,
    onInteractOutside: (event) => {
      if (!(event.target as Element).closest('.global-search-overlay')) {
        setIsSearchBoxOpen(false);
      }
    },
  });

  const renderPopoverContent = () =>
    isInPageSearchAllowed(pathname) ? (
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
        searchCriteria={searchCriteria === '' ? undefined : searchCriteria}
        searchText={suggestionSearch}
        setIsOpen={setIsSearchBoxOpen}
        onSearchTextUpdate={handleSearchChange}
      />
    );

  const searchIconClassName = classNames({
    'tw:*:data-icon:text-utility-brand-600': !isSearchBlur,
  });

  const renderSearchIcon = () =>
    searchValue ? (
      <ButtonUtility
        className={searchIconClassName}
        data-testid="cancel-icon"
        icon={IconCloseCircleOutlined}
        size="xs"
        tooltip={t('label.clear')}
        onClick={handleClear}
      />
    ) : (
      <ButtonUtility
        className={searchIconClassName}
        data-testid="search-icon"
        icon={IconSearch}
        size="xs"
        tooltip={t('label.search')}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.preventDefault();
          e.stopPropagation();
          handleOnClick();
        }}
      />
    );

  return (
    <div
      className="flex-center search-container relative"
      data-testid="navbar-search-container"
      ref={searchContainerRef}>
      {renderNlpToggle()}
      <Input
        aria-label={t('label.search-for-type', {
          type: t('label.data-asset-plural'),
        })}
        autoComplete="off"
        className="tw:flex-1"
        id="searchBox"
        inputDataTestId="searchBox"
        placeholder={t('label.search-for-type', {
          type: t('label.data-asset-plural'),
        })}
        value={searchValue}
        onBlur={() => {
          setIsSearchBlur(true);
        }}
        onChange={(value) => {
          debounceOnSearch(value);
          handleSearchChange(value);
        }}
        onFocus={() => {
          setIsSearchBlur(false);
          setIsSearchBoxOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <SelectPopover
        className="global-search-overlay"
        data-testid="global-search-popover"
        isOpen={isSearchBoxOpen && Boolean(shouldShowSearchContent)}
        size="md"
        style={{ width: searchContainerRef.current?.offsetWidth }}
        triggerRef={searchContainerRef}
        onOpenChange={setIsSearchBoxOpen}>
        {renderPopoverContent()}
      </SelectPopover>

      {entitiesSelect}
      <Divider
        className="h-5 m-r-md tw:ml-2 tw:self-center"
        orientation="vertical"
      />
      {renderSearchIcon()}
    </div>
  );
};
