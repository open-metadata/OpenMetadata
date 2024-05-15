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

import { SortingField } from '../../components/Explore/SortingDropDown';
import { SORT_ORDER } from '../../enums/common.enum';

export interface QueryFieldValueInterface {
  term: Record<string, string>;
  exists?: ExistsType;
}

export type ExistsType = {
  field: string;
};

export interface QueryFieldInterface {
  bool: {
    must?: Array<QueryFieldValueInterface>;
    must_not?: Array<QueryFieldValueInterface>;
    should?: Array<QueryFieldValueInterface>;
  };
}

export interface QueryFilterInterface {
  query: {
    bool: {
      must?: QueryFieldInterface[];
      must_not?: QueryFieldInterface[];
      should?: QueryFieldInterface[];
    };
  };
}

export type TabsInfoData = {
  label: string;
  sortingFields: SortingField[];
  sortField: string;
  sortOrder?: SORT_ORDER;
  path: string;
  icon: React.ReactNode;
};
