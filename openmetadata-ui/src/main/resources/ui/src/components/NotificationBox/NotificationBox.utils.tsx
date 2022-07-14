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

import React from 'react';
import Icon from '@ant-design/icons';
import { ReactComponent as IconTask } from '../../assets/svg/ic-task.svg';
import { ReactComponent as IconMentions } from '../../assets/svg/ic-mentions.svg';
import { ReactComponent as AllApplication } from '../../assets/svg/ic-all-application.svg';

export const tabsInfo = [
  {
    name: 'Task',
    key: 'Task',
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
    name: 'Mention',
    key: 'Mention',
    icon: (
      <Icon
        component={IconMentions}
        style={{
          marginRight: '8px',
        }}
      />
    ),
  },
  {
    name: 'Conversation',
    key: 'Conversation',
    icon: (
      <Icon
        component={AllApplication}
        style={{
          marginRight: '8px',
        }}
      />
    ),
  },
];
