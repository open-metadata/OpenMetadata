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

import { FilterObject } from 'components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { Aggregations } from '../../../interface/search.interface';

export interface FacetFilterProps {
  aggregations?: Aggregations;
  filters?: FilterObject;
  showDeleted?: boolean;
  onSelectHandler: (checked: boolean, name: string, key: string) => void;
  onClearFilter: (filter: FilterObject) => void;
  onChangeShowDeleted: (checked: boolean) => void;
}

export interface FilterContainerProp {
  name: string;
  count?: number;
  onSelect: (checked: boolean, name: string, type: keyof FilterObject) => void;
  isSelected: boolean;
  type?: keyof FilterObject;
  isDisabled?: boolean;
  label?: string;
}
