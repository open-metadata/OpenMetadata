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

import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Aggregations } from '../../interface/search.interface';
import { ExploreQuickFilterField } from './ExplorePage.interface';

export interface ExploreQuickFiltersProps {
  index: SearchIndex;
  fields: Array<ExploreQuickFilterField>;
  aggregations?: Aggregations;
  onFieldValueSelect: (field: ExploreQuickFilterField) => void;
  onAdvanceSearch?: () => void;
  showDeleted?: boolean;
  onChangeShowDeleted?: (showDeleted: boolean) => void;
  independent?: boolean; // flag to indicate if the filters are independent of aggregations
  fieldsWithNullValues?: EntityFields[];
  defaultQueryFilter?: Record<string, unknown>;
}
