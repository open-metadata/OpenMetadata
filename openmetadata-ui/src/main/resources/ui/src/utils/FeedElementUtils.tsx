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

import { isEmpty, isEqual } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { Fragment } from 'react';
import { ThreadType } from '../generated/entity/feed/thread';
import { getEntityFeedLink } from './EntityUtils';
import { getThreadField } from './FeedUtils';
import SVGIcons, { Icons } from './SvgUtils';

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
    <button
      className="link-text"
      data-testid="field-thread"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onThreadLinkSelect?.(
          threadValue.entityLink,
          isTaskType ? ThreadType.Task : ThreadType.Conversation
        );
      }}>
      <span className="tw-flex">
        <SVGIcons
          alt="comments"
          icon={isTaskType ? Icons.TASK_ICON : Icons.COMMENT}
        />
        <span className="tw-ml-1" data-testid="field-thread-count">
          {threadValue.count}
        </span>
      </span>
    </button>
  ) : (
    <Fragment>
      {entityType && entityFqn && entityField && flag && !isTaskType ? (
        <button
          className="link-text"
          data-testid="start-field-thread"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onThreadLinkSelect?.(
              getEntityFeedLink(entityType, entityFqn, entityField)
            );
          }}>
          <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} />
        </button>
      ) : null}
    </Fragment>
  );
};
