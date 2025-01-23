/*
 *  Copyright 2025 Collate.
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
import { ActivityFeedTabs } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  ACTIVITY_FEED_FILTER_LIST,
  TASK_FEED_FILTER_LIST,
} from '../../constants/Widgets.constant';
import { FeedFilter } from '../../enums/mydata.enum';
import i18n from '../i18next/LocalUtil';

export const getFeedFilterWidgets = (
  tab: ActivityFeedTabs,
  isAdmin?: boolean
) => {
  return tab === ActivityFeedTabs.TASKS
    ? TASK_FEED_FILTER_LIST
    : [
        {
          title: i18n.t('label.all'),
          key: isAdmin ? FeedFilter.ALL : FeedFilter.OWNER_OR_FOLLOWS,
          description: i18n.t('message.feed-filter-all'),
        },
        ...ACTIVITY_FEED_FILTER_LIST,
      ];
};
