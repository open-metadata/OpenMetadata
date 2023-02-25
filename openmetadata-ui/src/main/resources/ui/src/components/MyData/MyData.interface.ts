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

import { SearchDataFunctionType } from 'Models';
import { FeedFilter } from '../../enums/mydata.enum';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { User } from '../../generated/entity/teams/user';
import { EntitiesCount } from '../../generated/entity/utils/entitiesCount';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { ThreadUpdatedFunc } from '../../interface/feed.interface';

export interface MyDataProps {
  activityFeeds?: Thread[] | undefined;
  onRefreshFeeds?: () => void;
  error: string;
  data: MyDataState;
  followedDataCount: number;
  pendingTaskCount: number;
  ownedDataCount: number;
  userDetails?: User;
  ownedData: Array<EntityReference>;
  followedData: Array<EntityReference>;
  isLoadingOwnedData: boolean;
  feedData: Thread[];
  paging: Paging;
  isFeedLoading: boolean;
  fetchFeedHandler: (
    filterType: FeedFilter,
    after?: string,
    threadType?: ThreadType
  ) => void;
  fetchData?: (value: SearchDataFunctionType) => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler?: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
}

export interface MyDataState {
  entityCounts: EntitiesCount;
  entityCountLoading?: boolean;
}
