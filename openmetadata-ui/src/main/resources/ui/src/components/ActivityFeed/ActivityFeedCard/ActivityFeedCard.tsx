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

import { Popover, Space } from 'antd';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import React, { FC, useEffect, useRef, useState } from 'react';
import AppState from '../../../AppState';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { AnnouncementDetails } from '../../../generated/api/feed/createThread';
import { Post } from '../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import EditAnnouncementModal from '../../Modals/AnnouncementModal/EditAnnouncementModal';
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
  announcementDetails,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

  const currentUser = AppState.getCurrentUserDetails();
  const containerRef = useRef<HTMLDivElement>(null);
  const [feedDetail, setFeedDetail] = useState<Post>(feed);

  const [visible, setVisible] = useState<boolean>(false);
  const [isEditAnnouncement, setEditAnnouncement] = useState<boolean>(false);
  const [isEditPost, setEditPost] = useState<boolean>(false);

  const isAuthor = feedDetail.from === currentUser?.name;

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

  const handleAnnouncementUpdate = (
    title: string,
    announcement: AnnouncementDetails
  ) => {
    const existingAnnouncement = {
      ...feedDetail,
      announcement: announcementDetails,
    };

    const updatedAnnouncement = {
      ...feedDetail,
      message: title,
      announcement,
    };

    const patch = compare(existingAnnouncement, updatedAnnouncement);

    onFeedUpdate(patch);
    setEditAnnouncement(false);
  };

  const handlePostUpdate = (message: string) => {
    const updatedPost = { ...feedDetail, message };

    const patch = compare(feedDetail, updatedPost);

    onFeedUpdate(patch);
    setEditPost(false);
  };

  const handleThreadEdit = () => {
    if (announcementDetails) {
      setEditAnnouncement(true);
    } else {
      setEditPost(true);
    }
  };

  const handleVisibleChange = (newVisible: boolean) => setVisible(newVisible);

  const onHide = () => setVisible(false);

  useEffect(() => {
    setFeedDetail(feed);
  }, [feed]);

  return (
    <>
      <div
        className={classNames(
          className,
          'hover:tw-bg-gray-100 tw--mx-2.5 tw-px-2.5 tw--mt-1 tw-py-2 tw-mb-1 tw-rounded',
          {
            'tw-bg-gray-100': visible,
          }
        )}
        ref={containerRef}>
        <Popover
          align={{ targetOffset: [0, -16] }}
          content={
            <PopoverContent
              isAnnouncement={!isUndefined(announcementDetails)}
              isAuthor={isAuthor}
              isThread={isThread}
              postId={feedDetail.id}
              reactions={feedDetail.reactions || []}
              threadId={threadId}
              onConfirmation={onConfirmation}
              onEdit={handleThreadEdit}
              onPopoverHide={onHide}
              onReactionSelect={onReactionSelect}
              onReply={onReply}
            />
          }
          destroyTooltipOnHide={{ keepParent: false }}
          getPopupContainer={() => containerRef.current || document.body}
          key="reaction-options-popover"
          open={visible && !isEditPost}
          overlayClassName="ant-popover-feed"
          placement="topRight"
          trigger="hover"
          zIndex={100}
          onOpenChange={handleVisibleChange}>
          <Space align="start" className="w-full">
            <UserPopOverCard userName={feedDetail.from}>
              <span className="tw-cursor-pointer" data-testid="authorAvatar">
                <ProfilePicture id="" name={feedDetail.from} width="32" />
              </span>
            </UserPopOverCard>
            <div className="tw-flex tw-flex-col tw-flex-1">
              <FeedCardHeader
                className="tw-pl-2"
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
                announcementDetails={announcementDetails}
                className="tw-pl-2 tw-break-all"
                isEditPost={isEditPost}
                isThread={isThread}
                message={feedDetail.message}
                reactions={feedDetail.reactions || []}
                onCancelPostUpdate={() => setEditPost(false)}
                onPostUpdate={handlePostUpdate}
                onReactionSelect={onReactionSelect}
              />
            </div>
          </Space>
          {isFooterVisible && (
            <FeedCardFooter
              className="tw-mt-2"
              isFooterVisible={isFooterVisible}
              lastReplyTimeStamp={lastReplyTimeStamp}
              repliedUsers={repliedUsers}
              replies={replies}
              threadId={threadId}
              onThreadSelect={onThreadSelect}
            />
          )}
        </Popover>
      </div>
      {isEditAnnouncement && announcementDetails && (
        <EditAnnouncementModal
          announcement={announcementDetails}
          announcementTitle={feedDetail.message}
          open={isEditAnnouncement}
          onCancel={() => setEditAnnouncement(false)}
          onConfirm={handleAnnouncementUpdate}
        />
      )}
    </>
  );
};

export default observer(ActivityFeedCard);
