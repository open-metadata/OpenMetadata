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

import { Tooltip } from 'antd';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React from 'react';
import { ReactComponent as IconComments } from '../assets/svg/comment.svg';
import { entityUrlMap } from '../constants/Feeds.constants';
import { ThreadType } from '../generated/entity/feed/thread';
import { EntityReference } from '../generated/entity/teams/user';
import { EntityFieldThreads } from '../interface/feed.interface';
import { getEntityFeedLink } from './EntityUtils';
import { getThreadField } from './FeedUtils';

const iconsProps = {
  height: 14,
  name: 'comments',
  width: 14,
  style: { color: DE_ACTIVE_COLOR },
};

export const getFieldThreadElement = (
  columnName: string,
  columnField: string,
  entityFieldThreads: EntityFieldThreads[],
  onThreadLinkSelect: (value: string, threadType?: ThreadType) => void,
  entityType?: string,
  entityFqn?: string,
  entityField?: string
) => {
  let threadValue: EntityFieldThreads = {} as EntityFieldThreads;

  entityFieldThreads?.forEach((thread) => {
    const threadField = getThreadField(thread.entityField);
    if (threadField[0] === columnName && threadField[1] === columnField) {
      threadValue = thread;
    }
  });

  return (
    <Tooltip
      destroyTooltipOnHide
      overlayClassName="ant-popover-request-description"
      title={t('label.list-entity', {
        entity: t('label.conversation'),
      })}>
      <IconComments
        {...iconsProps}
        className="hover-cell-icon cursor-pointer"
        data-testid="field-thread"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          isEmpty(threadValue)
            ? onThreadLinkSelect(
                getEntityFeedLink(entityType, entityFqn, entityField)
              )
            : onThreadLinkSelect(
                threadValue.entityLink,
                ThreadType.Conversation
              );
        }}
      />
    </Tooltip>
  );
};

export const getDefaultValue = (owner: EntityReference) => {
  const message = t('message.can-you-add-a-description');
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
