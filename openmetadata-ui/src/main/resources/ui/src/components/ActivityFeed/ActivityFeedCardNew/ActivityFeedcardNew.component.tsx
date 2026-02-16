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
import { Card, Col, Input, Skeleton, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isUndefined, orderBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ASSET_CARD_STYLES } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ActivityEvent } from '../../../generated/entity/activity/activityEvent';
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
  getActivityEventHeaderText,
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
import ActivityEventFooter from '../ActivityFeedCardV2/FeedCardFooter/ActivityEventFooter';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab.less';
import CommentCard from './CommentCard.component';

interface ActivityFeedCardNewProps {
  feed?: Thread;
  activity?: ActivityEvent;
  isPost?: boolean;
  isActive?: boolean;
  post?: Post;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  isForFeedTab?: boolean;
  isOpenInDrawer?: boolean;
  isFeedWidget?: boolean;
  isFullSizeWidget?: boolean;
  onActivityClick?: (activity: ActivityEvent) => void;
}

const ActivityFeedCardNew = ({
  feed,
  activity,
  isPost = false,
  post,
  showActivityFeedEditor,
  showThread,
  isActive,
  isForFeedTab,
  isOpenInDrawer = false,
  isFeedWidget = false,
  isFullSizeWidget = false,
  onActivityClick,
}: ActivityFeedCardNewProps) => {
  const isActivityEvent = !isUndefined(activity);

  const { entityFQN, entityType } = useMemo(() => {
    const aboutValue = feed?.about ?? activity?.about ?? '';
    const entityFQN =
      getEntityFQN(aboutValue) ?? activity?.entity?.fullyQualifiedName ?? '';
    const entityType =
      getEntityType(aboutValue) ?? (activity?.entity?.type as EntityType) ?? '';

    return { entityFQN, entityType };
  }, [feed?.about, activity?.about, activity?.entity]);

  const createdBy = useMemo(() => {
    return feed?.createdBy ?? activity?.actor?.name ?? '';
  }, [feed?.createdBy, activity?.actor?.name]);

  const feedId = feed?.id ?? activity?.id ?? '';

  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const {
    selectedThread,
    postFeed,
    updateFeed,
    isPostsLoading,
    postActivityComment,
    activityThread,
  } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy,
  });

  useEffect(() => {
    setShowFeedEditor(false);
  }, [feedId]);

  const onSave = (message: string) => {
    if (isActivityEvent && activity) {
      postActivityComment(message, activity).catch(() => {
        // ignore since error is displayed in toast in the parent promise.
      });
    } else {
      postFeed(message, selectedThread?.id ?? '').catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    }
    setShowFeedEditor(false);
  };

  const onUpdate = (message: string) => {
    if (!feed) {
      return;
    }
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post?.id ?? '', !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  const { isUserOrTeam } = useMemo(() => {
    return {
      entityCheck: !isUndefined(entityFQN) && !isUndefined(entityType),
      isUserOrTeam: [EntityType.USER, EntityType.TEAM].includes(entityType),
    };
  }, [entityFQN, entityType, feed?.cardStyle]);
  const entityRef = feed?.entityRef ?? activity?.entity;

  const renderEntityLink = useMemo(() => {
    if (
      isUserOrTeam &&
      !ASSET_CARD_STYLES.includes(feed?.cardStyle as CardStyle)
    ) {
      return (
        <UserPopOverCard
          showUserName
          showUserProfile={false}
          userName={createdBy}>
          <Link
            className="break-all text-body header-link"
            data-testid="entity-link"
            to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}>
            <span
              className={classNames('text-sm', {
                'max-one-line': !showThread,
              })}>
              {entityRef
                ? getEntityName(entityRef)
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
                {entityRef
                  ? getEntityName(entityRef)
                  : entityDisplayName(entityType, entityFQN)}
              </span>
            </Link>
          </div>
        </EntityPopOverCard>
      );
    }
  }, [
    feed?.cardStyle,
    entityType,
    entityFQN,
    isUserOrTeam,
    entityRef,
    createdBy,
  ]);

  const feedHeaderText = useMemo(() => {
    if (isActivityEvent && activity) {
      return getActivityEventHeaderText(
        activity.eventType,
        activity.fieldName,
        entityType
      );
    }

    return getFeedHeaderTextFromCardStyle(
      feed?.fieldOperation,
      feed?.cardStyle,
      feed?.feedInfo?.fieldName,
      entityType
    );
  }, [isActivityEvent, activity, feed, entityType]);

  const timestampValue = post?.postTs ?? activity?.timestamp;
  const timestamp = timestampValue ? (
    <Tooltip
      color="white"
      overlayClassName="timestamp-tooltip"
      title={formatDateTime(timestampValue)}>
      <Typography.Text
        className="feed-card-header-v2-timestamp"
        data-testid="timestamp">
        {getRelativeTime(timestampValue)}
      </Typography.Text>
    </Tooltip>
  ) : null;

  const closeFeedEditor = () => {
    setShowFeedEditor(false);
  };

  const posts = useMemo(() => {
    if (!showThread) {
      return null;
    }

    // For activity events, use activityThread; for regular feeds, use feed
    const threadToDisplay = isActivityEvent ? activityThread : feed;

    if (!threadToDisplay) {
      return null;
    }

    if (isPostsLoading) {
      return (
        <Space className="m-y-md" direction="vertical" size={16}>
          <Skeleton active />
          <Skeleton active />
          <Skeleton active />
        </Space>
      );
    }

    const orderedPosts = orderBy(threadToDisplay.posts, ['postTs'], ['desc']);

    if (orderedPosts.length === 0) {
      return null;
    }

    return (
      <Col className="p-l-0 p-r-0" data-testid="feed-replies">
        {orderedPosts.map((reply, index, arr) => (
          <CommentCard
            closeFeedEditor={closeFeedEditor}
            feed={threadToDisplay}
            isLastReply={index === arr.length - 1}
            key={reply.id}
            post={reply}
          />
        ))}
      </Col>
    );
  }, [
    feed,
    showThread,
    closeFeedEditor,
    isPostsLoading,
    isActivityEvent,
    activityThread,
  ]);

  const feedMessage = useMemo(() => {
    if (isActivityEvent) {
      return activity?.summary ?? '';
    }
    if (!isPost) {
      return feed?.feedInfo?.entitySpecificInfo?.entity?.description ?? '';
    }

    return post?.message ?? '';
  }, [isActivityEvent, activity, isPost, feed, post]);

  if (isFeedWidget) {
    return (
      <Card
        className={classNames(
          'relative activity-feed-card-new',
          {
            'activity-feed-card-new-right-panel m-0 gap-0':
              showThread || isPost || isOpenInDrawer,
          },
          { 'activity-feed-reply-card': isPost },
          { 'active-card is-active': isActive }
        )}
        data-testid="feed-card-v2-sidebar">
        <Space align="start" className="w-full">
          <Space className="d-flex" direction="vertical">
            <div className="flex gap-2 items-start w-full relative">
              <div className="relative z-10">
                <UserPopOverCard profileWidth={24} userName={createdBy} />
              </div>

              {/* Horizontal line connecting popover to end of container */}
              <div className="horizontal-line " />

              <div className="d-flex flex-col w-full min-w-0 overflow-hidden">
                <div className="d-flex flex-col align-start">
                  <div
                    className={classNames(
                      'd-flex align-center w-full justify-between',
                      {
                        'header-container-card': !showThread,
                        'header-container-right-panel': showThread,
                      }
                    )}>
                    <div
                      className={classNames('mr-2', {
                        'activity-feed-user-name': !isPost,
                        'reply-card-user-name': isPost,
                      })}>
                      <UserPopOverCard
                        className={classNames('mr-2', {
                          'activity-feed-user-name': !isPost,
                          'reply-card-user-name': isPost,
                        })}
                        userName={createdBy}>
                        <Link to={getUserPath(createdBy)}>
                          {getEntityName(user)}
                        </Link>
                      </UserPopOverCard>
                    </div>
                    {timestamp}
                  </div>
                  {!isPost && (
                    <Space
                      className={classNames('d-flex gap-1', {
                        'header-container-card': !showThread,
                        'flex-wrap':
                          showThread &&
                          entityRef?.type !== EntityType.CONTAINER,
                        'items-start':
                          showThread &&
                          entityRef?.type === EntityType.CONTAINER,
                        ' items-center':
                          showThread &&
                          entityRef?.type !== EntityType.CONTAINER,
                      })}>
                      <Typography.Text
                        className="card-style-feed-header text-sm"
                        data-testid="headerText">
                        {feedHeaderText}
                      </Typography.Text>

                      {renderEntityLink}
                    </Space>
                  )}
                </div>
                <FeedCardBodyNew
                  activity={activity}
                  feed={feed}
                  isEditPost={isEditPost}
                  isFeedWidget={isFeedWidget}
                  isForFeedTab={isForFeedTab}
                  isPost={isPost}
                  message={feedMessage}
                  showThread={showThread}
                  onEditCancel={() => setIsEditPost(false)}
                  onUpdate={onUpdate}
                />
                {isFullSizeWidget && !isActivityEvent && feed && (
                  <div className="m-b-md">
                    <FeedCardFooterNew
                      isForFeedTab
                      feed={feed}
                      isPost={isPost}
                      post={post}
                    />
                  </div>
                )}
                {isFullSizeWidget && isActivityEvent && activity && (
                  <div className="m-b-md">
                    <ActivityEventFooter
                      activity={activity}
                      isForFeedTab={isForFeedTab}
                      onActivityClick={onActivityClick}
                    />
                  </div>
                )}
              </div>
            </div>
          </Space>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      className={classNames(
        'relative activity-feed-card-new',
        {
          'activity-feed-card-new-right-panel m-0 gap-0':
            showThread || isPost || isOpenInDrawer,
        },
        { 'activity-feed-reply-card': isPost },
        { 'active-card is-active': isActive }
      )}
      data-testid="feed-card-v2-sidebar">
      <Space align="start" className="w-full">
        <Space className="d-flex" direction="vertical">
          <Space
            className={classNames('d-inline-flex justify-start', {
              'items-center': !showThread,
              'items-start':
                showThread && entityRef?.type === EntityType.CONTAINER,
            })}>
            <UserPopOverCard userName={createdBy}>
              <div className="d-flex items-center">
                <ProfilePicture
                  key={feedId}
                  name={createdBy}
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
                    userName={createdBy}>
                    <Link to={getUserPath(createdBy)}>
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
                      showThread && entityRef?.type !== EntityType.CONTAINER,
                    'items-start':
                      showThread && entityRef?.type === EntityType.CONTAINER,
                    ' items-center':
                      showThread && entityRef?.type !== EntityType.CONTAINER,
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
            activity={activity}
            feed={feed}
            isEditPost={isEditPost}
            isForFeedTab={isForFeedTab}
            isPost={isPost}
            message={feedMessage}
            showThread={showThread}
            onEditCancel={() => setIsEditPost(false)}
            onUpdate={onUpdate}
          />

          {(isPost || (!showThread && !isPost)) && !isActivityEvent && feed && (
            <FeedCardFooterNew
              feed={feed}
              isForFeedTab={isForFeedTab}
              isPost={isPost}
              post={post}
            />
          )}

          {isActivityEvent && activity && (
            <ActivityEventFooter
              activity={activity}
              isForFeedTab={isForFeedTab}
              onActivityClick={onActivityClick}
            />
          )}
        </Space>
      </Space>
      {(showThread || isOpenInDrawer) && (
        <div className="activity-feed-comments-container d-flex flex-col">
          {(showActivityFeedEditor || isOpenInDrawer) && (
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
              onSave={onSave}
            />
          ) : (
            <div className="d-flex gap-2">
              <div>
                <UserPopOverCard userName={currentUser?.name ?? ''}>
                  <div className="d-flex items-center">
                    <ProfilePicture
                      key={feedId}
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

          {posts}
        </div>
      )}
    </Card>
  );
};

export default ActivityFeedCardNew;
