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

import { isString } from 'lodash';
import Qs from 'qs';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getExplorePath, TOUR_SEARCH_TERM } from '../../constants/constants';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { CurrentTourPageType } from '../../enums/tour.enum';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import TokenService from '../../utils/Auth/TokenService/TokenServiceUtil';
import {
  extractDetailsFromToken,
  isProtectedRoute,
  isTourRoute,
} from '../../utils/AuthProvider.util';
import { addToRecentSearched } from '../../utils/CommonUtils';
import { getOidcToken } from '../../utils/LocalStorageUtils';
import searchClassBase from '../../utils/SearchClassBase';
import NavBar from '../NavBar/NavBar';
import './app-bar.style.less';

const Appbar: React.FC = (): JSX.Element => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const location = useCustomLocation();
  const history = useHistory();
  const { isTourOpen, updateTourPage, updateTourSearch, tourSearchValue } =
    useTourProvider();

  const { isAuthenticated, searchCriteria } = useApplicationStore();

  const parsedQueryString = Qs.parse(
    location.search.startsWith('?')
      ? location.search.substr(1)
      : location.search
  );

  const searchQuery = isString(parsedQueryString.search)
    ? parsedQueryString.search
    : '';

  const [searchValue, setSearchValue] = useState(searchQuery);

  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (isTourOpen) {
      updateTourSearch(value);
    } else {
      value ? setIsOpen(true) : setIsOpen(false);
    }
  };

  const searchHandler = (value: string) => {
    if (!isTourOpen) {
      setIsOpen(false);
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

  const handleOnclick = () => {
    searchHandler(searchValue);
  };

  const handleClear = () => {
    setSearchValue('');
    searchHandler('');
  };

  useEffect(() => {
    setSearchValue(searchQuery);
  }, [searchQuery]);
  useEffect(() => {
    if (isTourOpen) {
      setSearchValue(tourSearchValue);
    }
  }, [tourSearchValue, isTourOpen]);

  useEffect(() => {
    const handleDocumentVisibilityChange = () => {
      if (
        isProtectedRoute(location.pathname) &&
        isTourRoute(location.pathname)
      ) {
        return;
      }
      const { isExpired } = extractDetailsFromToken(getOidcToken());
      if (!document.hidden && isExpired) {
        // force logout
        TokenService.getInstance().refreshToken();
      }
    };

    addEventListener('focus', handleDocumentVisibilityChange);

    return () => {
      removeEventListener('focus', handleDocumentVisibilityChange);
    };
  }, []);

  return (
    <>
      {isProtectedRoute(location.pathname) && isAuthenticated ? (
        <NavBar
          handleClear={handleClear}
          handleKeyDown={handleKeyDown}
          handleOnClick={handleOnclick}
          handleSearchBoxOpen={setIsOpen}
          handleSearchChange={handleSearchChange}
          isSearchBoxOpen={isOpen}
          pathname={location.pathname}
          searchValue={searchValue || ''}
        />
      ) : null}
    </>
  );
};

export default Appbar;
