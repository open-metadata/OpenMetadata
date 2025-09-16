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

import { AntdIconProps } from '@ant-design/icons/lib/components/AntdIcon';
import { ForwardRefExoticComponent, RefAttributes } from 'react';
import { SortingField } from '../../components/Explore/SortingDropDown';
import { SORT_ORDER } from '../../enums/common.enum';

export type TabsInfoData = {
  label: string;
  sortingFields: SortingField[];
  sortField: string;
  sortOrder?: SORT_ORDER;
  path: string;
  icon:
    | React.ReactNode
    | SvgComponent
    | ForwardRefExoticComponent<
        Omit<AntdIconProps, 'ref'> & RefAttributes<HTMLSpanElement>
      >;
};

export type FieldValue = string | boolean | null | number | undefined;

export interface EsTermQuery {
  value: FieldValue;
  case_insensitive?: boolean;
}

export type EsTermsQuery = {
  [property: string]: string | string[];
};

export interface EsExistsQuery {
  field: string;
}

export interface EsWildCard {
  wildcard: {
    [key: string]: { value: string };
  };
}

export interface EsBoolQuery {
  filter?: QueryFieldInterface | QueryFieldInterface[];
  must?: QueryFieldInterface | QueryFieldInterface[];
  must_not?: QueryFieldInterface | QueryFieldInterface[];
  should?: QueryFieldInterface | QueryFieldInterface[];
}

export interface QueryFieldInterface {
  bool?: EsBoolQuery;
  term?: Partial<Record<string, EsTermQuery | FieldValue>>;
  terms?: EsTermsQuery;
  exists?: EsExistsQuery;
}

export interface QueryFilterInterface {
  query: QueryFieldInterface;
}

export interface EsTerm {
  term: {
    [key: string]: string | boolean;
  };
}
