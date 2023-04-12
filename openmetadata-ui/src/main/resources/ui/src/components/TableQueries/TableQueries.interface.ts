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

import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { SearchDropdownOption } from 'components/SearchDropdown/SearchDropdown.interface';
import { Query } from 'generated/entity/data/query';
import { EntityReference } from 'generated/type/entityReference';
import { HTMLAttributes } from 'react';

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

export interface QueryCardProp extends HTMLAttributes<HTMLDivElement> {
  isExpanded: boolean;
  query: Query;
  selectedId?: string;
  tableId?: string;
  permission: OperationPermission;
  onQuerySelection?: (query: Query) => void;
  onQueryUpdate: (updatedQuery: Query, key: keyof Query) => Promise<void>;
  onUpdateVote: (data: QueryVote, id?: string) => Promise<void>;
}

export type QueryUsedByTable = {
  topThreeTable: EntityReference[];
  remainingTable: EntityReference[];
};

export interface QueryUsedByOtherTableProps {
  query: Query;
  tableId?: string;
}

export interface QueryFiltersProps {
  onFilterChange: (value: SearchDropdownOption[]) => void;
}

export type QuerySearchParams = {
  queryFrom?: number;
  after?: string;
  tableId?: string;
  query?: string;
  owner?: SearchDropdownOption[];
};

export type QuerySearchShouldFilterType = {
  term: {
    'owner.id': string;
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
export type QuerySearchFilterType = {
  query: {
    bool: {
      must: QuerySearchMustFilterType[];
    };
  };
};
