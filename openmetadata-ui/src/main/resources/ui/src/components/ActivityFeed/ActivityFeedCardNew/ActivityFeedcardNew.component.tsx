/*
 *  Copyright 2025 Collate.
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
import { Card, Col, Input, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ASSET_CARD_STYLES } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { CardStyle, Post, Thread } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  entityDisplayName,
  getEntityFQN,
  getEntityType,
  getFeedHeaderTextFromCardStyle,
} from '../../../utils/FeedUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import EntityPopOverCard from '../../common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyNew from '../ActivityFeedCard/FeedCardBody/FeedCardBodyNew';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab.less';
import CommentCard from './CommentCard.component';

interface ActivityFeedCardNewProps {
  feed: Thread;
  isPost?: boolean;
  isActive?: boolean;
  post: Post;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  isForFeedTab?: boolean;
  isOpenInDrawer?: boolean;
  onSave?: (message: string) => void;
  updateAnnouncementThreads?: () => void;
  isAnnouncementTab?: boolean;
}

const ActivityFeedCardNew = ({
  feed,
  isPost = false,
  post,
  showActivityFeedEditor,
  showThread,
  isActive,
  isForFeedTab,
  isOpenInDrawer = false,
  onSave: onSaveAnnouncement,
  updateAnnouncementThreads,
  isAnnouncementTab,
}: ActivityFeedCardNewProps) => {
  const { entityFQN, entityType } = useMemo(() => {
    const entityFQN = getEntityFQN(feed.about) ?? '';
    const entityType = getEntityType(feed.about) ?? '';

    return { entityFQN, entityType };
  }, [feed.about]);
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { postFeed } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const { updateFeed } = useActivityFeedProvider();
  const [, , user] = useUserProfile({
    permission: true,
    name: feed.createdBy ?? '',
  });

  useEffect(() => {
    setShowFeedEditor(false);
  }, [feed.id]);

  const onSave = (message: string) => {
    postFeed(message, feed?.id ?? '').catch(() => {
      // ignore since error is displayed in toast in the parent promise.
      // Added block for sonar code smell
    });
    setShowFeedEditor(false);
  };
  const onUpdate = (message: string) => {
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post?.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  const { isUserOrTeam } = useMemo(() => {
    return {
      entityCheck: !isUndefined(entityFQN) && !isUndefined(entityType),
      isUserOrTeam: [EntityType.USER, EntityType.TEAM].includes(entityType),
    };
  }, [entityFQN, entityType, feed.cardStyle]);
  const renderEntityLink = useMemo(() => {
    if (
      isUserOrTeam &&
      !ASSET_CARD_STYLES.includes(feed.cardStyle as CardStyle)
    ) {
      return (
        <UserPopOverCard
          showUserName
          showUserProfile={false}
          userName={feed.createdBy as string}>
          <Link
            className="break-all text-body header-link"
            data-testid="entity-link"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            <span
              className={classNames('text-sm', {
                'max-one-line': !showThread,
              })}>
              {feed?.entityRef
                ? getEntityName(feed.entityRef)
                : entityDisplayName(entityType, entityFQN)}
            </span>
          </Link>
        </UserPopOverCard>
      );
    } else {
      return (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <div
            className={classNames('text-sm', {
              'max-one-line': !showThread,
            })}>
            {searchClassBase.getEntityIcon(entityType ?? '') && (
              <span className="w-4 h-4 m-r-xss d-inline-flex align-middle">
                {searchClassBase.getEntityIcon(entityType ?? '')}
              </span>
            )}
            <Link
              className="break-word text-sm header-link"
              data-testid="entity-link"
              to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
              <span>
                {feed?.entityRef
                  ? getEntityName(feed.entityRef)
                  : entityDisplayName(entityType, entityFQN)}
              </span>
            </Link>
          </div>
        </EntityPopOverCard>
      );
    }
  }, [feed.cardStyle, entityType, entityFQN, isUserOrTeam]);
  const feedHeaderText = getFeedHeaderTextFromCardStyle(
    feed.fieldOperation,
    feed.cardStyle,
    feed.feedInfo?.fieldName,
    entityType
  );
  const timestamp = post?.postTs ? (
    <Tooltip
      color="white"
      overlayClassName="timestamp-tooltip"
      title={formatDateTime(post.postTs)}>
      <Typography.Text
        className="feed-card-header-v2-timestamp"
        data-testid="timestamp">
        {getRelativeTime(post.postTs)}
      </Typography.Text>
    </Tooltip>
  ) : null;

  const closeFeedEditor = () => {
    setShowFeedEditor(false);
  };

  return (
    <Card
      className={classNames(
        'relative activity-feed-card-new',
        {
          'activity-feed-card-new-right-panel m-0 gap-0':
            showThread || isPost || isOpenInDrawer,
        },
        { 'activity-feed-reply-card': isPost },
        { 'active-card is-active': isActive },
        { 'p-0': isAnnouncementTab }
      )}
      data-testid="feed-card-v2-sidebar">
      <Space align="start" className="w-full">
        <Space className="d-flex" direction="vertical">
          <Space
            className={classNames('d-inline-flex justify-start', {
              'items-center': !showThread,
              'items-start':
                showThread && feed.entityRef?.type === EntityType.CONTAINER,
            })}>
            <UserPopOverCard userName={feed.createdBy ?? ''}>
              <div className="d-flex items-center">
                <ProfilePicture
                  key={feed.id}
                  name={feed.createdBy ?? ''}
                  width={showThread ? '40' : '32'}
                />
              </div>
            </UserPopOverCard>
            <Space className="d-flex flex-col align-start gap-2" size={0}>
              <Space
                className={classNames('d-flex align-center gap-2', {
                  'header-container-card': !showThread,
                  'header-container-right-panel': showThread,
                })}
                size={0}>
                <Typography.Text
                  className={classNames('mr-2', {
                    'activity-feed-user-name': !isPost,
                    'reply-card-user-name': isPost,
                  })}>
                  <UserPopOverCard
                    className={classNames('mr-2', {
                      'activity-feed-user-name': !isPost,
                      'reply-card-user-name': isPost,
                    })}
                    userName={feed.createdBy ?? ''}>
                    <Link to={getUserPath(feed.createdBy ?? '')}>
                      {getEntityName(user)}
                    </Link>
                  </UserPopOverCard>
                </Typography.Text>
                {timestamp}
              </Space>
              {!isPost && (
                <Space
                  className={classNames('d-flex gap-1', {
                    'header-container-card': !showThread,
                    'flex-wrap':
                      showThread &&
                      feed.entityRef?.type !== EntityType.CONTAINER,
                    'items-start':
                      showThread &&
                      feed.entityRef?.type === EntityType.CONTAINER,
                    ' items-center':
                      showThread &&
                      feed.entityRef?.type !== EntityType.CONTAINER,
                  })}>
                  <Typography.Text
                    className="card-style-feed-header text-sm"
                    data-testid="headerText">
                    {feedHeaderText}
                  </Typography.Text>

                  {renderEntityLink}
                </Space>
              )}
            </Space>
          </Space>

          <FeedCardBodyNew
            feed={feed}
            isEditPost={isEditPost}
            isForFeedTab={isForFeedTab}
            isPost={isPost}
            message={
              !isPost
                ? feed.feedInfo?.entitySpecificInfo?.entity?.description
                : post?.message
            }
            showThread={showThread}
            onEditCancel={() => setIsEditPost(false)}
            onUpdate={onUpdate}
          />

          {(isPost || (!showThread && !isPost)) && (
            <FeedCardFooterNew
              feed={feed}
              isForFeedTab={isForFeedTab}
              isPost={isPost}
              post={post}
              updateAnnouncementThreads={updateAnnouncementThreads}
            />
          )}
        </Space>
      </Space>
      {(showThread || isOpenInDrawer) && (
        <div className="activity-feed-comments-container d-flex flex-col">
          {(showActivityFeedEditor || isOpenInDrawer || isAnnouncementTab) && (
            <Typography.Text className="activity-feed-comments-title m-b-md">
              {t('label.comment-plural')}
            </Typography.Text>
          )}
          {showFeedEditor ? (
            <ActivityFeedEditorNew
              className={classNames(
                'm-t-md feed-editor activity-feed-editor-container-new',
                {
                  'm-b-md':
                    (showActivityFeedEditor && feed?.posts?.length === 0) ||
                    isOpenInDrawer,
                }
              )}
              onSave={isAnnouncementTab ? onSaveAnnouncement : onSave}
            />
          ) : (
            <div className="d-flex gap-2">
              <div>
                <UserPopOverCard userName={currentUser?.name ?? ''}>
                  <div className="d-flex items-center">
                    <ProfilePicture
                      key={feed.id}
                      name={currentUser?.name ?? ''}
                      width="32"
                    />
                  </div>
                </UserPopOverCard>
              </div>

              <Input
                className="comments-input-field"
                data-testid="comments-input-field"
                placeholder={t('message.input-placeholder')}
                onClick={() => setShowFeedEditor(true)}
              />
            </div>
          )}

          {showThread && feed?.posts && feed?.posts?.length > 0 && (
            <Col className="p-l-0 p-r-0" data-testid="feed-replies">
              {feed?.posts
                ?.slice()
                .sort((a, b) => (b.postTs as number) - (a.postTs as number))
                .map((reply, index, arr) => (
                  <CommentCard
                    closeFeedEditor={closeFeedEditor}
                    feed={feed}
                    isAnnouncementTab={isAnnouncementTab}
                    isLastReply={index === arr.length - 1}
                    key={reply.id}
                    post={reply}
                    updateAnnouncementThreads={updateAnnouncementThreads}
                  />
                ))}
            </Col>
          )}
        </div>
      )}
    </Card>
  );
};

export default ActivityFeedCardNew;
