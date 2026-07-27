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

import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';
import { ExploreQuickFilterField } from '../ExplorePage.interface';

export interface ExploreQueryFilterChipsProps {
  fields: ExploreQuickFilterField[];
  // Browse-tree location levels, rendered as chips before the filter chips.
  browseFields?: ExploreQuickFilterField[];
  // Remove a single selected value from a filter field.
  onRemoveValue: (field: ExploreQuickFilterField, optionKey: string) => void;
  // Remove a browse level (and implicitly everything below it).
  onRemoveBrowseLevel?: (levelKey: string) => void;
  // Clear every active filter at once.
  onClearAll?: () => void;
  // Shown when nothing is active — keeps the QUERY bar persistent.
  emptyText?: string;
}

export interface QueryFilterChip {
  field: ExploreQuickFilterField;
  label: string;
  option: SearchDropdownOption;
}
