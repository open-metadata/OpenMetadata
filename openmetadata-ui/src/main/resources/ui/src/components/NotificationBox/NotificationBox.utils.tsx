/*
 *  Copyright 2022 Collate
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

import Icon from '@ant-design/icons';
import React from 'react';
import { ReactComponent as IconMentions } from '../../assets/svg/ic-mentions.svg';
import { ReactComponent as IconTask } from '../../assets/svg/ic-task.svg';
import { FeedFilter } from '../../enums/mydata.enum';
import {
  NotificationTabsKey,
  NotificationTabsName,
} from '../../enums/notification.enum';
import { ThreadType } from '../../generated/api/feed/createThread';

export const tabsInfo = [
  {
    name: NotificationTabsName.TASK,
    key: NotificationTabsKey.TASK,
    icon: (
      <Icon
        component={IconTask}
        style={{
          marginRight: '8px',
        }}
      />
    ),
  },
  {
    name: NotificationTabsName.MENTION,
    key: NotificationTabsKey.CONVERSATION,
    icon: (
      <Icon
        component={IconMentions}
        style={{
          marginRight: '8px',
        }}
      />
    ),
  },
];

export const getFilters = (activeTab: ThreadType) => ({
  threadType: activeTab,
  feedFilter:
    activeTab === ThreadType.Task
      ? FeedFilter.ASSIGNED_TO
      : FeedFilter.MENTIONS,
});
