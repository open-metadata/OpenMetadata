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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { observer } from 'mobx-react';
import React, { FC, useEffect, useState } from 'react';
import AppState from '../../../AppState';
import { updatePost, updateThread } from '../../../axiosAPIs/feedsAPI';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { Post } from '../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import { useAuth } from '../../../hooks/authHooks';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
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
  isThread,
  onConfirmation,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

  const { isAdminUser } = useAuth();
  const currentUser = AppState.getCurrentUserDetails();

  const [reactions, setReactions] = useState<Post['reactions']>(
    feed.reactions || []
  );

  const onFeedUpdate = (data: Operation[]) => {
    if (isThread) {
      updateThread(feed.id, data)
        .then((res: AxiosResponse) => {
          setReactions(res.data.reactions || []);
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    } else {
      updatePost(threadId, feed.id, data)
        .then((res: AxiosResponse) => {
          setReactions(res.data.reactions || []);
        })
        .catch((err: AxiosError) => {
          showErrorToast(err);
        });
    }
  };

  const onReactionSelect = (
    reactionType: ReactionType,
    reactionOperation: ReactionOperation
  ) => {
    let updatedReactions = reactions || [];
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
    const patch = compare(feed, { ...feed, reactions: updatedReactions });

    onFeedUpdate(patch);
  };

  useEffect(() => {
    setReactions(feed.reactions || []);
  }, []);

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
        className="tw-ml-8 tw-bg-white tw-border-main tw-rounded-md tw-break-all tw-flex tw-justify-between "
        isAuthor={Boolean(feed.from === currentUser?.name || isAdminUser)}
        isThread={isThread}
        message={feed.message}
        postId={feed.id}
        reactions={reactions}
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
