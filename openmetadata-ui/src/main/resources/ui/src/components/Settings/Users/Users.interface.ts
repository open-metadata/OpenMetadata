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

import { PersonalAccessToken } from '../../../generated/auth/personalAccessToken';
import { User } from '../../../generated/entity/teams/user';

export interface Props {
  userData: User;
  queryFilters: {
    myData: string;
    following: string;
  };
  handlePaginate: (page: string | number) => void;
  afterDeleteAction: (isSoftDelete?: boolean, version?: number) => void;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
  authenticationMechanism?: PersonalAccessToken;
}

export enum UserPageTabs {
  ACTIVITY = 'activity_feed',
  TASK = 'task',
  MY_DATA = 'mydata',
  FOLLOWING = 'following',
  ACCESS_TOKEN = 'access-token',
  PERMISSIONS = 'permissions',
}
