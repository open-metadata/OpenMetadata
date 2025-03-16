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

import { ExploreSearchIndex } from '../Explore/ExplorePage.interface';

export interface SearchDropdownProps {
  triggerButtonSize?: 'large' | 'middle' | 'small';
  label: string;
  isSuggestionsLoading?: boolean;
  options: SearchDropdownOption[];
  searchKey: string;
  selectedKeys: SearchDropdownOption[];
  highlight?: boolean;
  showProfilePicture?: boolean;
  fixedOrderOptions?: boolean;
  index?: ExploreSearchIndex;
  onChange: (values: SearchDropdownOption[], searchKey: string) => void;
  onGetInitialOptions?: (searchKey: string) => void;
  onSearch: (searchText: string, searchKey: string) => void;
  independent?: boolean; // flag to indicate if the filters are independent of aggregations
  hideCounts?: boolean; // Determines if the count should be displayed or not.
  hasNullOption?: boolean; // Determines if the null option should be displayed or not. For e.g No Owner, No Tier etc
}

export interface SearchDropdownOption {
  key: string;
  label: string;
  count?: number;
}
