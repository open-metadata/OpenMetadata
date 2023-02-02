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

import { isEmpty, isEqual, isUndefined } from 'lodash';
import React, { Fragment } from 'react';
import { entityUrlMap } from '../constants/Feeds.constants';
import { ThreadType } from '../generated/entity/feed/thread';
import { EntityReference } from '../generated/entity/teams/user';
import { EntityFieldThreads } from '../interface/feed.interface';
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
      className="link-text tw-self-start tw-w-7 tw-h-7 tw-mr-1 tw-flex tw-items-center hover-cell-icon"
      data-testid="field-thread"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onThreadLinkSelect?.(
          threadValue.entityLink,
          isTaskType ? ThreadType.Task : ThreadType.Conversation
        );
      }}>
      <SVGIcons
        alt="comments"
        className="tw-mt-0.5"
        height="16px"
        icon={isTaskType ? Icons.TASK_ICON : Icons.COMMENT}
        width="16px"
      />
      <span className="tw-ml-1" data-testid="field-thread-count">
        {threadValue.count}
      </span>
    </button>
  ) : (
    <Fragment>
      {entityType && entityFqn && entityField && flag && !isTaskType ? (
        <button
          className="link-text tw-self-start tw-w-7 tw-h-7 tw-mr-1 tw-flex-none hover-cell-icon"
          data-testid="start-field-thread"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onThreadLinkSelect?.(
              getEntityFeedLink(entityType, entityFqn, entityField)
            );
          }}>
          <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} width="16px" />
        </button>
      ) : null}
    </Fragment>
  );
};

export const getDefaultValue = (owner: EntityReference) => {
  const message = 'Can you add a description?';
  if (isUndefined(owner)) {
    return `${message}`;
  } else {
    const name = owner.name;
    const displayName = owner.displayName;
    const entityType = owner.type;
    const mention = `<a href=${`/${
      entityUrlMap[entityType as keyof typeof entityUrlMap]
    }/${name}`}>@${displayName}</a>`;

    return `${mention} ${message}`;
  }
};
