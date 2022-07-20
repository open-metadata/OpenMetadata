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
import { ReactComponent as IconTask } from '../../assets/svg/ic-task.svg';

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
  // TODO: remove comments when Backend support for Mention is done
  //   {
  //     name: 'Mention',
  //     key: 'Conversation',
  //     icon: (
  //       <Icon
  //         component={IconMentions}
  //         style={{
  //           marginRight: '8px',
  //         }}
  //       />
  //     ),
  //   },
];
