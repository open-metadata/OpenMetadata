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
import { compare, Operation } from 'fast-json-patch';
import { observer } from 'mobx-react';
import React, { FC, useEffect, useState } from 'react';
import AppState from '../../../AppState';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Post } from '../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useAuth } from '../../../hooks/authHooks';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';
import { ActivityFeedCardProp } from './ActivityFeedCard.interface';
import FeedCardBody from './FeedCardBody/FeedCardBody';
import FeedCardFooter from './FeedCardFooter/FeedCardFooter';
import FeedCardHeader from './FeedCardHeader/FeedCardHeader';

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
  isThread,
  onConfirmation,
  updateThreadHandler,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

  const { isAdminUser } = useAuth();
  const currentUser = AppState.getCurrentUserDetails();

  const [feedDetail, setFeedDetail] = useState<Post>(feed);

  const onFeedUpdate = (data: Operation[]) => {
    updateThreadHandler(
      threadId ?? feedDetail.id,
      feedDetail.id,
      Boolean(isThread),
      data
    );
  };

  const onReactionSelect = (
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => {
    let updatedReactions = feedDetail.reactions || [];
    if (reactionOperation === ReactionOperation.ADD) {
      const reactionObject = {
        reactionType,
        user: {
          id: currentUser?.id as string,
        },
      };

      updatedReactions = [...updatedReactions, reactionObject as Reaction];
    } else {
      updatedReactions = updatedReactions.filter(
        (reaction) =>
          !(
            reaction.reactionType === reactionType &&
            reaction.user.id === currentUser?.id
          )
      );
    }

    const patch = compare(
      { ...feedDetail, reactions: [...(feedDetail.reactions || [])] },
      {
        ...feedDetail,
        reactions: updatedReactions,
      }
    );

    onFeedUpdate(patch);
  };

  useEffect(() => {
    setFeedDetail(feed);
  }, [feed]);

  return (
    <div className={classNames(className)}>
      <FeedCardHeader
        createdBy={feedDetail.from}
        entityFQN={entityFQN as string}
        entityField={entityField as string}
        entityType={entityType as string}
        isEntityFeed={isEntityFeed}
        timeStamp={feedDetail.postTs}
      />
      <FeedCardBody
        className="tw-ml-8 tw-bg-white tw-border-main tw-rounded-md tw-break-all tw-flex tw-justify-between "
        isAuthor={Boolean(feedDetail.from === currentUser?.name || isAdminUser)}
        isThread={isThread}
        message={feedDetail.message}
        postId={feedDetail.id}
        reactions={feedDetail.reactions || []}
        threadId={threadId as string}
        onConfirmation={onConfirmation}
        onReactionSelect={onReactionSelect}
      />
      <div className="tw-filter-seperator" />
      <FeedCardFooter
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

export default observer(ActivityFeedCard);
