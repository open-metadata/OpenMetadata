/*
 *  Copyright 2026 Collate.
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

// The quick-filter shape is consumed by hooks and utils as well as the Explore
// UI, so it sits below the component layer; SearchDropdown.interface and
// ExplorePage.interface re-export their halves.
import { ReactNode } from 'react';
import { SearchIndex } from '../enums/search.enum';

export interface SearchDropdownOption {
  key: string;
  label: string;
  labelKeyOptions?: Record<string, string | number | boolean>;
  count?: number;
  description?: string;
  icon?: ReactNode;
}

export interface ExploreQuickFilterField {
  key: string;
  label: string;
  labelKeyOptions?: Record<string, string | number | boolean>;
  options?: SearchDropdownOption[];
  value?: SearchDropdownOption[];
  hideCounts?: boolean;
  hideSearchBar?: boolean;
  searchIndex?: SearchIndex;
  searchKey?: string;
  dropdownClassName?: string;
  singleSelect?: boolean;
  sourceFields?: string;
}
