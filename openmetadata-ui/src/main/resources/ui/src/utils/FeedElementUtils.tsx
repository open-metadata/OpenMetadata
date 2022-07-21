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

import Icon from '@ant-design/icons';
import { Badge } from 'antd';
import { isEmpty, isEqual } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { Fragment } from 'react';
import { ThreadType } from '../generated/entity/feed/thread';
import { getEntityFeedLink } from './EntityUtils';
import { getThreadField } from './FeedUtils';
import { Comments, CommentsPlus, Tasks } from './SvgUtils';

export const getFieldThreadElement = (
  columnName: string,
  columnField: string,
  entityFieldThreads: EntityFieldThreads[],
  onThreadLinkSelect?: (value: string, threadType?: ThreadType) => void,
  entityType?: string,
  entityFqn?: string,
  entityField?: string,
  flag = true,
  threadType?: ThreadType
) => {
  let threadValue: EntityFieldThreads = {} as EntityFieldThreads;

  entityFieldThreads?.forEach((thread) => {
    const threadField = getThreadField(thread.entityField);
    if (threadField[0] === columnName && threadField[1] === columnField) {
      threadValue = thread;
    }
  });

  const isTaskType = isEqual(threadType, ThreadType.Task);

  return !isEmpty(threadValue) ? (
    <Badge color="#7147E8" count={threadValue.count} size="small">
      <Icon
        component={isTaskType ? Tasks : Comments}
        data-testid="field-thread"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onThreadLinkSelect?.(
            threadValue.entityLink,
            isTaskType ? ThreadType.Task : ThreadType.Conversation
          );
        }}
      />
    </Badge>
  ) : (
    <Fragment>
      {entityType && entityFqn && entityField && flag && !isTaskType ? (
        <Icon
          className="link-text tw-self-start tw-h-8 tw-opacity-0 group-hover:tw-opacity-100"
          component={CommentsPlus}
          data-testid="start-field-thread"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onThreadLinkSelect?.(
              getEntityFeedLink(entityType, entityFqn, entityField)
            );
          }}
        />
      ) : null}
    </Fragment>
  );
};
