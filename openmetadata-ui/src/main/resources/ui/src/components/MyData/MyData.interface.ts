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

import {
  EntityCounts,
  EntityThread,
  FormatedTableData,
  SearchDataFunctionType,
  SearchResponse,
} from 'Models';
import { FeedFilter } from '../../enums/mydata.enum';
import { User } from '../../generated/entity/teams/user';

export interface MyDataProps {
  error: string;
  ingestionCount: number;
  countServices: number;
  userDetails?: User;
  searchResult: SearchResponse | undefined;
  ownedData: Array<FormatedTableData>;
  followedData: Array<FormatedTableData>;
  feedData: EntityThread[];
  feedFilter: FeedFilter;
  feedFilterHandler: (v: FeedFilter) => void;
  fetchData?: (value: SearchDataFunctionType) => void;
  entityCounts: EntityCounts;
  isFeedLoading?: boolean;
  postFeedHandler: (value: string, id: string) => void;
}
