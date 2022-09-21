/*
 *  Copyright 2021 Collate
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

import { FilterObject, SearchResponse } from 'Models';

export type UrlParams = {
  searchQuery: string;
  tab: string;
};

export type ExploreSearchData = {
  resSearchResults: SearchResponse;
  resAggServiceType: SearchResponse;
  resAggTier: SearchResponse;
  resAggTag: SearchResponse;
  resAggDatabase: SearchResponse;
  resAggDatabaseSchema: SearchResponse;
  resAggServiceName: SearchResponse;
};

export interface ExploreProps {
  tabCounts: TabCounts;
  searchText: string;
  initialFilter?: FilterObject;
  searchFilter?: FilterObject;
  sortValue: string;
  tab: string;
  searchQuery: string;
  showDeleted: boolean;
  isFilterSelected: boolean;
  fetchCount: () => void;
  handleFilterChange: (data: FilterObject) => void;
  handlePathChange: (path: string) => void;
  handleSearchText?: (text: string) => void;
  onShowDeleted: (checked: boolean) => void;
  handleTabCounts: (value: { [key: string]: number }) => void;
}

export interface AdvanceField {
  key: string;
  value: string | undefined;
}

export interface TabCounts {
  table: number;
  topic: number;
  dashboard: number;
  pipeline: number;
  mlmodel: number;
}
