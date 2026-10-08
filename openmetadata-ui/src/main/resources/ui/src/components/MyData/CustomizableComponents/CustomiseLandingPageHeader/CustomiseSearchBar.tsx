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
  Box,
  ButtonUtility,
  Input,
  SelectPopover,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { debounce, isEmpty, isString } from 'lodash';
import Qs from 'qs';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconSuggestionsActive } from '../../../../assets/svg/ic-suggestions-active.svg';
import { ReactComponent as IconSuggestionsBlue } from '../../../../assets/svg/ic-suggestions-blue.svg';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../../../enums/tour.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useSearchStore } from '../../../../hooks/useSearchStore';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { addToRecentSearched } from '../../../../utils/RecentActivityUtils';
import {
  getExplorePath,
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../../../utils/RouterUtils';

const SearchOptions = lazy(() => import('../../../AppBar/SearchOptions'));
const Suggestions = lazy(() => import('../../../AppBar/Suggestions'));

export const CustomiseSearchBar = ({ disabled }: { disabled?: boolean }) => {
  const { currentUser, searchCriteria } = useApplicationStore();
  const { isNLPEnabled, isNLPActive, setNLPActive, initNLP } = useSearchStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const location = useCustomLocation();
  const pathname = location.pathname;
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState<boolean>(false);
  const navigate = useNavigate();
  const { isTourOpen, updateTourPage, updateTourSearch } = useTourProvider();
  const parsedQueryString = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substring(1)
      : location.search
  );
  const searchQuery = isString(parsedQueryString.search)
    ? parsedQueryString.search
    : '';
  const [searchValue, setSearchValue] = useState<string>(searchQuery);
  const handleSelectOption = useCallback(
    (text: string) => {
      navigate(
        {
          search: `?withinPageSearch=${text}`,
        },
        {
          replace: true,
        }
      );
    },
    [navigate]
  );

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

      const defaultTab =
        searchCriteria !== ''
          ? customizeMyDataPageClassBase.getSearchIndexPath(searchCriteria)
          : '';

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

  const handleKeyDown = (e: { key: string }) => {
    if (e.key === 'Enter') {
      if (isTourOpen && searchValue === 'tour') {
        updateTourPage(CurrentTourPageType.EXPLORE_PAGE);
        updateTourSearch('');
      }

      searchHandler(searchValue);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (isTourOpen) {
      updateTourSearch(value);
    } else {
      value ? setIsSearchBoxOpen(true) : setIsSearchBoxOpen(false);
    }
  };

  const popoverContent = useMemo(() => {
    if (!isSearchBoxOpen) {
      return null;
    }

    const shouldShowInPageOptions =
      !isTourOpen &&
      (searchValue || isNLPActive) &&
      isInPageSearchAllowed(pathname);

    return (
      <Suspense fallback={null}>
        {shouldShowInPageOptions ? (
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
        )}
      </Suspense>
    );
  }, [
    isTourOpen,
    searchValue,
    isSearchBoxOpen,
    pathname,
    isNLPActive,
    searchCriteria,
    suggestionSearch,
    handleSelectOption,
    handleSearchChange,
  ]);

  useEffect(() => {
    if (!isEmpty(currentUser)) {
      initNLP();
    }
  }, [currentUser]);

  const nlpLabel = isNLPActive
    ? t('message.natural-language-search-active')
    : t('label.use-natural-language-search');

  return (
    <Box
      align="center"
      className="tw:relative tw:min-w-0 tw:flex-auto tw:rounded-xl tw:border tw:border-bg-secondary_subtle tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs"
      data-testid="customise-search-container"
      justify="center"
      ref={searchContainerRef}>
      {isNLPEnabled && (
        <ButtonUtility
          aria-pressed={isNLPActive}
          className={classNames(
            'tw:size-6 tw:shrink-0 tw:rounded-lg tw:p-0 tw:transition-none',
            isNLPActive
              ? 'tw:bg-transparent tw:hover:bg-transparent'
              : 'tw:border-[0.5px] tw:border-utility-blue-light-200 tw:bg-utility-brand-50 tw:hover:bg-utility-brand-50'
          )}
          color="tertiary"
          data-testid="nlp-suggestions-button"
          icon={
            isNLPActive ? (
              <IconSuggestionsActive className="tw:size-6 tw:fill-none" />
            ) : (
              <IconSuggestionsBlue className="tw:size-3.5 tw:fill-transparent" />
            )
          }
          tooltip={nlpLabel}
          onClick={() => setNLPActive(!isNLPActive)}
        />
      )}
      <Input
        autoComplete="off"
        className="tw:flex-1"
        fontSize="sm"
        id="searchBox"
        inputClassName="tw:px-3 tw:py-2 tw:text-sm tw:leading-5.5 tw:text-primary"
        inputDataTestId="searchBox"
        isDisabled={disabled}
        placeholder={t('label.search-for-type', {
          type: `${t('label.table-plural')}, ${t('label.database')}, ${t(
            'label.schema'
          )}...`,
        })}
        value={searchValue}
        wrapperClassName="tw:bg-transparent tw:shadow-none! tw:outline-0! tw:focus-within:outline-0!"
        onChange={(value) => {
          debounceOnSearch(value);
          handleSearchChange(value);
        }}
        onFocus={() => setIsSearchBoxOpen(isNLPActive || Boolean(searchValue))}
        onKeyDown={handleKeyDown}
      />
      <SelectPopover
        isNonModal
        className="tw:max-h-100! tw:overflow-y-auto tw:rounded-xl tw:px-0! tw:py-4! tw:shadow-lg"
        containerPadding={0}
        data-testid="customise-search-popover"
        isOpen={isSearchBoxOpen}
        offset={12}
        placement="bottom"
        size="sm"
        style={{ width: searchContainerRef.current?.offsetWidth }}
        triggerRef={searchContainerRef}
        onOpenChange={setIsSearchBoxOpen}>
        {popoverContent}
      </SelectPopover>
    </Box>
  );
};

export default CustomiseSearchBar;
