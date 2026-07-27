/*
 *  Copyright 2023 Collate.
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
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  ExploreSearchIndex,
  SearchHitCounts,
} from '../../components/Explore/ExplorePage.interface';
import { ROUTES } from '../../constants/constants';
import { EntityTabs } from '../../enums/entity.enum';
import { CurrentTourPageType } from '../../enums/tour.enum';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import type { SearchResponse } from '../../interface/search.interface';

interface Props {
  children: ReactNode;
}

export interface TourProviderContextProps {
  isTourOpen: boolean;
  isTourPage: boolean;
  currentTourPage: CurrentTourPageType;
  activeTabForTourDatasetPage: EntityTabs;
  tourSearchValue: string;
  tourMockSearchResults?: SearchResponse<ExploreSearchIndex>;
  tourMockSearchHitCounts?: SearchHitCounts;
  tourMockDatasetData?: unknown;
  updateIsTourOpen: (value: boolean) => void;
  updateTourPage: (value: CurrentTourPageType) => void;
  updateActiveTab: (value: EntityTabs) => void;
  updateTourSearch: (value: string) => void;
  updateTourMockData?: (payload: {
    searchResults: SearchResponse<ExploreSearchIndex>;
    searchHitCounts: SearchHitCounts;
    datasetData: unknown;
  }) => void;
}

export const TourContext = createContext({} as TourProviderContextProps);

const TourProvider: FC<Props> = ({ children }) => {
  const location = useCustomLocation();
  const isTourPage = useMemo(
    () => location.pathname.includes(ROUTES.TOUR),
    [location.pathname]
  );
  const [isTourOpen, setIsTourOpen] = useState<boolean>(isTourPage);
  const [currentTourPage, setCurrentTourPage] = useState<CurrentTourPageType>(
    CurrentTourPageType.MY_DATA_PAGE
  );
  const [activeTabForTourDatasetPage, setActiveTabForTourDatasetPage] =
    useState<EntityTabs>(EntityTabs.SCHEMA);
  const [searchValue, setSearchValue] = useState('');
  const [tourMockSearchResults, setTourMockSearchResults] =
    useState<SearchResponse<ExploreSearchIndex>>();
  const [tourMockSearchHitCounts, setTourMockSearchHitCounts] =
    useState<SearchHitCounts>();
  const [tourMockDatasetData, setTourMockDatasetData] = useState<unknown>();

  useEffect(() => {
    if (isTourPage) {
      setIsTourOpen(true);
    }
  }, [isTourPage]);

  const handleIsTourOpen = useCallback((value: boolean) => {
    setIsTourOpen(value);
  }, []);

  const handleTourPageChange = useCallback(
    (value: CurrentTourPageType) => setCurrentTourPage(value),
    []
  );

  const handleActiveTabChange = useCallback(
    (value: EntityTabs) => setActiveTabForTourDatasetPage(value),
    []
  );

  const handleUpdateTourSearch = useCallback(
    (value: string) => setSearchValue(value),
    []
  );

  const handleUpdateTourMockData = useCallback(
    (payload: {
      searchResults: SearchResponse<ExploreSearchIndex>;
      searchHitCounts: SearchHitCounts;
      datasetData: unknown;
    }) => {
      setTourMockSearchResults(payload.searchResults);
      setTourMockSearchHitCounts(payload.searchHitCounts);
      setTourMockDatasetData(payload.datasetData);
    },
    []
  );

  return (
    <TourContext.Provider
      value={{
        isTourOpen,
        isTourPage,
        currentTourPage,
        tourSearchValue: searchValue,
        activeTabForTourDatasetPage,
        tourMockSearchResults,
        tourMockSearchHitCounts,
        tourMockDatasetData,
        updateActiveTab: handleActiveTabChange,
        updateIsTourOpen: handleIsTourOpen,
        updateTourPage: handleTourPageChange,
        updateTourSearch: handleUpdateTourSearch,
        updateTourMockData: handleUpdateTourMockData,
      }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTourProvider = () => useContext(TourContext);

export default TourProvider;
