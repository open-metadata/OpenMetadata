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

import { Popover } from 'antd';
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
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { ActivityFeedCardProp } from './ActivityFeedCard.interface';
import FeedCardBody from './FeedCardBody/FeedCardBody';
import FeedCardFooter from './FeedCardFooter/FeedCardFooter';
import FeedCardHeader from './FeedCardHeader/FeedCardHeader';
import PopoverContent from './PopoverContent';

const ActivityFeedCard: FC<ActivityFeedCardProp> = ({
  feed,
  feedType,
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
  onReply,
  taskDetails,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

  const { isAdminUser } = useAuth();
  const currentUser = AppState.getCurrentUserDetails();

  const [feedDetail, setFeedDetail] = useState<Post>(feed);

  const [visible, setVisible] = useState<boolean>(false);

  const isAuthor = Boolean(
    feedDetail.from === currentUser?.name || isAdminUser
  );

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

  const handleVisibleChange = (newVisible: boolean) => setVisible(newVisible);

  const onHide = () => setVisible(false);

  useEffect(() => {
    setFeedDetail(feed);
  }, [feed]);

  return (
    <div
      className={classNames(className, 'hover:tw-bg-gray-100', {
        'tw-bg-gray-100': visible,
      })}>
      <Popover
        destroyTooltipOnHide
        align={{ targetOffset: [0, -35] }}
        content={
          <PopoverContent
            isAuthor={isAuthor}
            isThread={isThread}
            postId={feedDetail.id}
            reactions={feedDetail.reactions || []}
            threadId={threadId}
            onConfirmation={onConfirmation}
            onPopoverHide={onHide}
            onReactionSelect={onReactionSelect}
            onReply={onReply}
          />
        }
        key="reaction-options-popover"
        overlayClassName="ant-popover-feed"
        placement="topRight"
        trigger="hover"
        visible={visible}
        zIndex={9999}
        onVisibleChange={handleVisibleChange}>
        <div className="tw-flex">
          <UserPopOverCard userName={feedDetail.from}>
            <span className="tw-cursor-pointer" data-testid="authorAvatar">
              <ProfilePicture id="" name={feedDetail.from} width="32" />
            </span>
          </UserPopOverCard>
          <div className="tw-flex tw-flex-col">
            <FeedCardHeader
              createdBy={feedDetail.from}
              entityFQN={entityFQN as string}
              entityField={entityField as string}
              entityType={entityType as string}
              feedType={feedType}
              isEntityFeed={isEntityFeed}
              taskDetails={taskDetails}
              timeStamp={feedDetail.postTs}
            />
            <FeedCardBody
              className="tw-pl-2 tw-break-all"
              isThread={isThread}
              message={feedDetail.message}
              reactions={feedDetail.reactions || []}
              onReactionSelect={onReactionSelect}
            />
          </div>
        </div>
        <FeedCardFooter
          className="tw-mt-2"
          isFooterVisible={isFooterVisible}
          lastReplyTimeStamp={lastReplyTimeStamp}
          repliedUsers={repliedUsers}
          replies={replies}
          threadId={threadId}
          onThreadSelect={onThreadSelect}
        />
      </Popover>
    </div>
  );
};

export default observer(ActivityFeedCard);
