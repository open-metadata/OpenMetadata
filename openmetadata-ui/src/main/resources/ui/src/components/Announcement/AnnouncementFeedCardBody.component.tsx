/*
 *  Copyright 2024 Collate.
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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Avatar, Button, Col, Row } from 'antd';
import { Popover } from '../common/AntdCompat';;
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowBottom } from '../../assets/svg/ic-arrow-down.svg';
import { ReactionOperation } from '../../enums/reactions.enum';
import {
  AnnouncementDetails,
  ThreadType,
} from '../../generated/api/feed/createThread';
import { Post } from '../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../generated/type/reaction';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../utils/FeedUtils';
import FeedCardBody from '../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBody';
import FeedCardHeader from '../ActivityFeed/ActivityFeedCard/FeedCardHeader/FeedCardHeader';
import PopoverContent from '../ActivityFeed/ActivityFeedCard/PopoverContent';
import UserPopOverCard from '../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import EditAnnouncementModal from '../Modals/AnnouncementModal/EditAnnouncementModal';
import { AnnouncementFeedCardBodyProp } from './Announcement.interface';
import './announcement.less';

const AnnouncementFeedCardBody = ({
  feed,
  entityLink,
  isThread,
  editPermission,
  showRepliesButton = true,
  showReplyThread,
  onReply,
  announcementDetails,
  onConfirmation,
  updateThreadHandler,
  task,
  isReplyThreadOpen,
}: AnnouncementFeedCardBodyProp) => {
  const { t } = useTranslation();
  const entityType = getEntityType(entityLink ?? '');
  const entityFQN = getEntityFQN(entityLink ?? '');
  const entityField = getEntityField(entityLink ?? '');
  const { currentUser } = useApplicationStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [feedDetail, setFeedDetail] = useState<Post>(feed);

  const [visible, setVisible] = useState<boolean>(false);
  const [isEditAnnouncement, setIsEditAnnouncement] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);

  const isAuthor = feedDetail.from === currentUser?.name;

  const { id: threadId, type: feedType, posts } = task;

  const repliesPostAvatarGroup = useMemo(() => {
    return (
      <Avatar.Group>
        {(posts ?? []).map((u) => (
          <ProfilePicture
            avatarType="outlined"
            key={u.id}
            name={u.from}
            width="18"
          />
        ))}
      </Avatar.Group>
    );
  }, [posts]);

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

    if (!isEmpty(patch)) {
      onFeedUpdate(patch);
    }
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

    if (!isEmpty(patch)) {
      onFeedUpdate(patch);
    }
    setIsEditAnnouncement(false);
  };

  const handlePostUpdate = (message: string) => {
    const updatedPost = { ...feedDetail, message };

    const patch = compare(feedDetail, updatedPost);

    if (!isEmpty(patch)) {
      onFeedUpdate(patch);
    }
    setIsEditPost(false);
  };

  const handleThreadEdit = () => {
    if (announcementDetails) {
      setIsEditAnnouncement(true);
    } else {
      setIsEditPost(true);
    }
  };

  const handleVisibleChange = (newVisible: boolean) => setVisible(newVisible);

  const onHide = () => setVisible(false);

  useEffect(() => {
    setFeedDetail(feed);
  }, [feed]);

  return (
    <div
      className={classNames(
        'bg-grey-1-hover m--x-sm w-full p-x-sm m--t-xss py-2 m-b-xss rounded-4',
        {
          'bg-grey-1-hover': visible,
        }
      )}
      data-testid="main-message"
      ref={containerRef}>
      <Popover
        align={{ targetOffset: [0, -16] }}
        content={
          <PopoverContent
            editAnnouncementPermission={editPermission}
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
        onOpenChange={handleVisibleChange}>
        <Row gutter={[10, 0]} wrap={false}>
          <Col className="avatar-column d-flex flex-column items-center justify-between">
            <UserPopOverCard userName={feedDetail.from} />

            {showRepliesButton && repliesPostAvatarGroup}
          </Col>
          <Col flex="auto">
            <div>
              <FeedCardHeader
                isEntityFeed
                createdBy={feedDetail.from}
                entityFQN={entityFQN}
                entityField={entityField ?? ''}
                entityType={entityType}
                feedType={feedType ?? ThreadType.Conversation}
                task={task}
                timeStamp={feedDetail.postTs}
              />
              <FeedCardBody
                announcementDetails={announcementDetails}
                isEditPost={isEditPost}
                isThread={isThread}
                message={feedDetail.message}
                reactions={feedDetail.reactions || []}
                onCancelPostUpdate={() => setIsEditPost(false)}
                onPostUpdate={handlePostUpdate}
                onReactionSelect={onReactionSelect}
              />
              {!isEmpty(task.posts) && showRepliesButton ? (
                <Button
                  className="p-0 h-auto line-height-16 text-announcement m-r-xs m-t-xs d-flex items-center"
                  data-testid="show-reply-thread"
                  type="text"
                  onClick={showReplyThread}>
                  {`${task.postsCount} ${t('label.reply-lowercase-plural')}`}

                  <Icon
                    className={classNames('arrow-icon', {
                      'rotate-180': isReplyThreadOpen,
                    })}
                    component={ArrowBottom}
                  />
                </Button>
              ) : null}
            </div>
          </Col>
        </Row>
      </Popover>

      {isEditAnnouncement && announcementDetails && (
        <EditAnnouncementModal
          announcement={announcementDetails}
          announcementTitle={feedDetail.message}
          open={isEditAnnouncement}
          onCancel={() => setIsEditAnnouncement(false)}
          onConfirm={handleAnnouncementUpdate}
        />
      )}
    </div>
  );
};

export default AnnouncementFeedCardBody;
