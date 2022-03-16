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

import classNames from 'classnames';
import React, { FC } from 'react';
import AppState from '../../../AppState';
import { useAuth } from '../../../hooks/authHooks';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';
import FeedCardBody from '../FeedCardBody/FeedCardBody';
import FeedCardFooter from '../FeedCardFooter/FeedCardFooter';
import FeedCardHeader from '../FeedCardHeader/FeedCardHeader';
import { ActivityFeedCardProp } from './ActivityFeedCard.interface';

const ActivityFeedCard: FC<ActivityFeedCardProp> = ({
  feed,
  className,
  replies,
  repliedUsers,
  entityLink,
  isEntityFeed,
  threadId,
  lastReplyTimeStamp,
  onThreadSelect,
  isFooterVisible = false,
  onConfirmation,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

  const { isAdminUser } = useAuth();
  const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

  return (
    <div className={classNames(className)}>
      <FeedCardHeader
        createdBy={feed.from}
        entityFQN={entityFQN as string}
        entityField={entityField as string}
        entityType={entityType as string}
        isEntityFeed={isEntityFeed}
        timeStamp={feed.postTs}
      />
      <FeedCardBody
        className="tw-mx-7 tw-ml-9 tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-break-all tw-flex tw-justify-between "
        isAuthor={Boolean(feed.from === currentUser || isAdminUser)}
        message={feed.message}
        postId={feed.id}
        threadId={threadId as string}
        onConfirmation={onConfirmation}
      />
      <FeedCardFooter
        className="tw-ml-9 tw-mt-3"
        isFooterVisible={isFooterVisible}
        lastReplyTimeStamp={lastReplyTimeStamp}
        repliedUsers={repliedUsers}
        replies={replies}
        threadId={threadId}
        onThreadSelect={onThreadSelect}
      />
    </div>
  );
};

export default ActivityFeedCard;
