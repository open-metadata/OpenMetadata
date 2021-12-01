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

import { AggregationType, FilterObject } from 'Models';

export type FacetProp = {
  aggregations: Array<AggregationType>;
  onSelectHandler: (
    checked: boolean,
    name: string,
    type: keyof FilterObject
  ) => void;
  filters: FilterObject;
  onClearFilter: (value: keyof FilterObject) => void;
};

export type FilterContainerProp = {
  name: string;
  count: number;
  onSelect: (checked: boolean, name: string, type: keyof FilterObject) => void;
  isSelected: boolean;
  type: keyof FilterObject;
  isDisabled: boolean;
};
