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

import { DefaultOptionType } from 'antd/lib/select';
import { HTMLAttributes } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { SORT_ORDER } from '../../../enums/common.enum';
import { Query } from '../../../generated/entity/data/query';
import { EntityReference } from '../../../generated/type/entityReference';
import { SearchDropdownOption } from '../../SearchDropdown/SearchDropdown.interface';

export enum QueryVoteType {
  'votedUp' = 'votedUp',
  'votedDown' = 'votedDown',
  'unVoted' = 'unVoted',
}

export type QueryVote = {
  updatedVoteType: QueryVoteType;
};

export interface TableQueriesProp {
  isTableDeleted?: boolean;
  tableId: string;
}

export type QueryFilterType = {
  initialOptions: SearchDropdownOption[];
  options: SearchDropdownOption[];
  selected: SearchDropdownOption[];
};

export type FetchFilteredQueriesType = {
  tags?: SearchDropdownOption[];
  owners?: SearchDropdownOption[];
  pageNumber?: number;
  timeRange?: { startTs: number; endTs: number };
  sortField?: string;
  sortOrder?: SORT_ORDER;
};

export interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  isExpanded: boolean;
  query: Query;
  selectedId?: string;
  permission: OperationPermission;
  onQuerySelection?: (query: Query) => void;
  onQueryUpdate: (updatedQuery: Query, key: keyof Query) => Promise<void>;
  onUpdateVote: (data: QueryVote, id?: string) => Promise<void>;
  afterDeleteAction: () => void;
}

export type QueryUsedByTable = {
  topThreeTable: EntityReference[];
  remainingTable: EntityReference[];
};

export interface QueryUsedByOtherTableProps {
  query: Query;
  isEditMode: boolean;
  onChange: (value: DefaultOptionType[]) => void;
}

export type QuerySearchParams = {
  queryFrom?: number;
  after?: string;
  tableId?: string;
  query?: string;
};

export type QuerySearchShouldFilterType = {
  term: {
    'tags.tagFQN': string;
  };
};
export type QuerySearchMustFilterType = {
  term?: {
    'queryUsedIn.id': string;
  };
  bool?: {
    should: QuerySearchShouldFilterType[];
  };
};
