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

import { AssetsDataType } from 'Models';
import { FeedFilter } from '../../enums/mydata.enum';
import { Thread, ThreadType } from '../../generated/entity/feed/thread';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { ThreadUpdatedFunc } from '../../interface/feed.interface';

export interface Option {
  label: string;
  value: string;
}
export interface PatchObject {
  id: string;
  name: string;
  type: string;
}

export type UserDetails = Record<
  string,
  string | Array<string> | boolean | Array<PatchObject>
>;

export interface Props {
  userData: User;
  followingEntities: AssetsDataType;
  ownedEntities: AssetsDataType;
  username: string;
  tab: string;
  feedData: Thread[];
  paging: Paging;
  isFeedLoading: boolean;
  isUserEntitiesLoading: boolean;
  isAdminUser: boolean;
  isLoggedinUser: boolean;
  isAuthDisabled: boolean;
  updateUserDetails: (data: UserDetails) => Promise<void>;
  fetchFeedHandler: (
    threadType: ThreadType,
    after?: string,
    feedFilter?: FeedFilter
  ) => void;
  postFeedHandler: (value: string, id: string) => void;
  deletePostHandler?: (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => void;
  updateThreadHandler: ThreadUpdatedFunc;
  feedFilter: FeedFilter;
  setFeedFilter: (value: FeedFilter) => void;
  threadType: ThreadType.Task | ThreadType.Conversation;
  onFollowingEntityPaginate: (page: string | number) => void;
  onOwnedEntityPaginate: (page: string | number) => void;
  onSwitchChange: (checked: boolean) => void;
}
