/*
 *  Copyright 2026 Collate.
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

import { MyDataTab } from '../../../../hooks/usePersonalSpaceStore';
import { UserPageTabs } from '../../../Settings/Users/Users.interface';

export enum TrackedFilter {
  OWNED = 'owned',
  FOLLOWING = 'following',
}

export interface TrackedListConfig {
  pillLabelKey: string;
  viewAllEntityKey: string;
  /** The My Data & Following modal tab that holds the full list (AI mode). */
  myDataTab: MyDataTab;
  /** The user-profile tab that holds the full list (Classic mode). */
  profileTab: UserPageTabs;
  listTestId: string;
}

export const TRACKED_LISTS: Record<TrackedFilter, TrackedListConfig> = {
  [TrackedFilter.OWNED]: {
    listTestId: 'owned-assets',
    myDataTab: 'owned',
    pillLabelKey: 'label.owned',
    profileTab: UserPageTabs.MY_DATA,
    viewAllEntityKey: 'label.owned-asset-plural',
  },
  [TrackedFilter.FOLLOWING]: {
    listTestId: 'followed-assets',
    myDataTab: 'following',
    pillLabelKey: 'label.following',
    profileTab: UserPageTabs.FOLLOWING,
    viewAllEntityKey: 'label.followed-asset-plural',
  },
};
