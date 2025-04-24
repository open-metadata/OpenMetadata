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

import { Avatar, Col, Input, Row } from 'antd';
import classNames from 'classnames';
import { compare, Operation } from 'fast-json-patch';
import { t } from 'i18next';
import _, { isEmpty, noop } from 'lodash';
import React, { useMemo, useState } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
import {
  AnnouncementDetails,
  GeneratedBy,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityUtils';
import { updateThreadData } from '../../../utils/FeedUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import ProfilePictureNew from '../../common/ProfilePicture/ProfilePictureNew';
import EditAnnouncementModal from '../../Modals/AnnouncementModal/EditAnnouncementModal';
import FeedCardBodyV1 from '../ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import './activity-feed-card-v2.less';
import { ActivityFeedCardV2Props } from './ActivityFeedCardV2.interface';
import FeedCardFooter from './FeedCardFooter/FeedCardFooter';
import FeedCardHeaderV2 from './FeedCardHeader/FeedCardHeaderV2';

const ActivityFeedCardV2 = ({
  post,
  feed,
  className = '',
  isPost = false,
  isActive = false,
  showThread = false,
  isOpenInDrawer = false,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
  isAnnouncementTab = false,
  updateAnnouncementThreads,
  permissions,
  onSave,
}: Readonly<ActivityFeedCardV2Props>) => {
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const { updateFeed, fetchUpdatedThread } = useActivityFeedProvider();
  const [isEditAnnouncement, setIsEditAnnouncement] = useState<boolean>(false);
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const { currentUser } = useApplicationStore();
  const postLength = useMemo(
    () => feed?.posts?.length ?? 0,
    [feed?.posts?.length]
  );

  const onEditPost = () => {
    setIsEditPost(!isEditPost);
    !isPost && setIsEditAnnouncement(!isEditAnnouncement); // do not open Edit Announcement Modal is its a post
  };

  const handleMouseEnter = () => {
    setShowActions(true);
  };

  const handleMouseLeave = () => {
    setShowActions(false);
  };

  const onUpdate = (message: string) => {
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  const updateThreadHandler = async (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ): Promise<void> => {
    await updateThreadData(threadId, postId, isThread, data, noop);
    await fetchUpdatedThread(threadId);
  };
  const handleAnnouncementUpdate = async (
    title: string,
    announcement: AnnouncementDetails
  ) => {
    const existingAnnouncement = {
      ...feed,
      announcement: feed.announcement,
    };

    const updatedAnnouncement = {
      ...feed,
      message: title,
      announcement,
    };

    const isAnnouncementTimeUpdated =
      _.isEqual(
        existingAnnouncement?.announcement?.startTime,
        updatedAnnouncement?.announcement?.startTime * 1000
      ) &&
      _.isEqual(
        existingAnnouncement?.announcement?.endTime,
        updatedAnnouncement?.announcement?.endTime * 1000
      );

    const patch = compare(existingAnnouncement, updatedAnnouncement);

    if (!isEmpty(patch)) {
      updateThreadHandler(feed.id, feed.id, true, patch);
      if (isAnnouncementTab) {
        updateAnnouncementThreads && updateAnnouncementThreads(); // if its Announcement tab in service page
      } else {
        !isAnnouncementTimeUpdated && // refetch new announcements only if announcements timings are updated
          updateAnnouncementThreads &&
          updateAnnouncementThreads();
      }
    }

    setIsEditAnnouncement(false);
  };
  const repliesPostAvatarGroup = useMemo(() => {
    return (
      <Avatar.Group>
        {(feed.posts ?? []).map((u) => (
          <ProfilePicture
            avatarType="outlined"
            key={u.id}
            name={u.from}
            width="18"
          />
        ))}
      </Avatar.Group>
    );
  }, [feed.posts]);
  const isAnnouncementWithRepliesVisible =
    feed.type === ThreadType.Announcement &&
    !isPost &&
    componentsVisibility.showRepliesContainer;

  const isActivityFeedCardSidebarVisible =
    feed.type !== ThreadType.Announcement ||
    (feed.type === ThreadType.Announcement &&
      !componentsVisibility.showRepliesContainer);

  return (
    <div
      className={classNames(
        'feed-card-v2-container p-sm',
        {
          active: isActive && feed.type !== ThreadType.Announcement,
          'announcement-active':
            isActive && feed.type === ThreadType.Announcement,
          'announcement-gap': feed.type === ThreadType.Announcement,
        },
        className
      )}
      data-testid="activity-feed-card-v2">
      {isAnnouncementWithRepliesVisible && (
        <Col className="avatar-column d-flex flex-column items-center justify-between">
          <UserPopOverCard userName={post.from} />

          {repliesPostAvatarGroup}
        </Col>
      )}
      {isActivityFeedCardSidebarVisible && (
        <div
          className={classNames('feed-card-v2-sidebar', {
            'feed-card-v2-post-sidebar': isPost,
          })}>
          <ProfilePicture
            avatarType="outlined"
            name={post.from}
            size={isPost ? 28 : 30}
            width={isPost ? '28' : '30'}
          />
        </div>
      )}
      <Row
        className="w-full"
        gutter={[0, 10]}
        style={{ whiteSpace: 'pre-wrap' }}>
        <Col
          className={classNames('feed-card-v2', {
            'feed-reply-card-v2': isPost,
            'drawer-feed-card-v2': isOpenInDrawer,
          })}
          span={24}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}>
          <Row className="w-full">
            <Col span={24}>
              <FeedCardHeaderV2
                about={!isPost ? feed.about : undefined}
                cardStyle={feed.cardStyle}
                createdBy={post.from}
                feed={feed}
                fieldName={feed.feedInfo?.fieldName as EntityField}
                fieldOperation={feed.fieldOperation}
                isAnnouncementTab={isAnnouncementTab}
                isEntityFeed={isPost}
                timeStamp={post.postTs}
              />
            </Col>
            <Col span={24}>
              <FeedCardBodyV1
                announcement={!isPost ? feed.announcement : undefined}
                feed={feed}
                isEditPost={isEditPost}
                isPost={isPost}
                message={post.message}
                onEditCancel={() => setIsEditPost(false)}
                onUpdate={onUpdate}
              />
            </Col>
            <Col span={24}>
              <FeedCardFooter
                componentsVisibility={componentsVisibility}
                feed={feed}
                isAnnouncementTab={isAnnouncementTab}
                isPost={isPost}
                post={post}
                updateAnnouncementThreads={updateAnnouncementThreads}
              />
            </Col>
          </Row>
          {showActions &&
            (feed.generatedBy !== GeneratedBy.System || isPost) && (
              <ActivityFeedActions
                feed={feed}
                isAnnouncementTab={isAnnouncementTab}
                isPost={isPost}
                permissions={permissions}
                post={post}
                updateAnnouncementThreads={updateAnnouncementThreads}
                onEditPost={onEditPost}
              />
            )}
        </Col>
        {showFeedEditor && showThread ? (
          <ActivityFeedEditorNew
            className={classNames(
              'm-t-md feed-editor activity-feed-editor-container-new'
            )}
            onSave={onSave}
          />
        ) : (
          showThread && (
            <div className="d-flex gap-2">
              <div>
                <ProfilePictureNew
                  avatarType="outlined"
                  key={feed.id}
                  name={getEntityName(currentUser)}
                  size={32}
                />
              </div>

              <Input
                className="comments-input-field"
                data-testid="comments-input-field"
                placeholder={t('message.input-placeholder')}
                onClick={() => setShowFeedEditor(true)}
              />
            </div>
          )
        )}
        {showThread && postLength > 0 && (
          <Col className="feed-replies" data-testid="feed-replies" span={24}>
            {feed?.posts?.map((reply) => (
              <ActivityFeedCardV2
                isPost
                componentsVisibility={componentsVisibility}
                feed={feed}
                isAnnouncementTab={isAnnouncementTab}
                isOpenInDrawer={isOpenInDrawer}
                key={reply.id}
                post={reply}
                updateAnnouncementThreads={updateAnnouncementThreads}
              />
            ))}
          </Col>
        )}
      </Row>
      {isEditAnnouncement && (
        <EditAnnouncementModal
          announcement={feed.announcement as AnnouncementDetails}
          announcementTitle={feed.message}
          open={isEditAnnouncement}
          onCancel={() => setIsEditAnnouncement(false)}
          onConfirm={handleAnnouncementUpdate}
        />
      )}
    </div>
  );
};

export default ActivityFeedCardV2;
