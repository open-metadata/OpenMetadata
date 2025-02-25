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
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as CloseTabIcon } from '../../../assets/svg/ic-close-tab.svg';
import { Post, Thread } from '../../../generated/entity/feed/thread';
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
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyNew from '../ActivityFeedCard/FeedCardBody/FeedCardBodyNew';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab-new.less';
import CommentCard from './CommentCard.component';

interface ActivityFeedCardNewProps {
  feed: Thread;
  isPost?: boolean;
  isActive?: boolean;
  post: Post;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  handlePanelResize?: (isFullWidth: boolean) => void;
}

const ActivityFeedCardNew = ({
  feed,
  isPost = false,
  post,
  showActivityFeedEditor,
  showThread,
  isActive,
  handlePanelResize,
}: ActivityFeedCardNewProps) => {
  const { entityFQN, entityType } = useMemo(() => {
    const entityFQN = getEntityFQN(feed.about) ?? '';
    const entityType = getEntityType(feed.about) ?? '';

    return { entityFQN, entityType };
  }, [feed.about]);
  const { t } = useTranslation();
  const { selectedThread, postFeed } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const { updateFeed } = useActivityFeedProvider();

  const onSave = (message: string) => {
    postFeed(message, selectedThread?.id ?? '').catch(() => {
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
  const entityName = feed?.entityRef
    ? getEntityName(feed.entityRef)
    : entityDisplayName(entityType, entityFQN);
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

  return (
    <Card
      bordered={showThread ? false : true}
      className={classNames(
        'relative activity-feed-card-new',
        {
          'activity-feed-card-new-right-panel m-0 gap-0': showThread || isPost,
        },
        { 'activity-feed-reply-card': isPost },
        { 'active-card is-active': isActive }
      )}
      data-testid="feed-card-v2-sidebar">
      <Space align="start" className="w-full">
        <Space className="d-flex" direction="vertical">
          <Space
            className={classNames('d-inline-flex justify-start items-start', {
              'items-center': showThread,
            })}>
            <ProfilePicture
              avatarType="outlined"
              key={feed.id}
              name={feed.updatedBy!}
              size={showThread ? 40 : 32}
            />
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
                  {feed.updatedBy}
                </Typography.Text>
                {timestamp}
              </Space>
              {!isPost && (
                <Space
                  className={classNames('d-flex align-center gap-1', {
                    'header-container-card': !showThread,
                    'header-container-card align-start': showThread,
                  })}>
                  <Typography.Text className="card-style-feed-header text-sm">
                    {feedHeaderText}
                  </Typography.Text>

                  <Link
                    className="break-word header-link"
                    data-testid="entity-link"
                    to={entityUtilClassBase.getEntityLink(
                      entityType,
                      entityFQN
                    )}>
                    <span
                      className={classNames('text-sm', {
                        'max-one-line': !showThread,
                      })}>
                      {entityName}
                    </span>
                  </Link>
                  {showThread && (
                    <CloseTabIcon
                      className="close-tab-icon"
                      height={16}
                      onClick={() => handlePanelResize?.(true)}
                    />
                  )}
                </Space>
              )}
            </Space>
          </Space>

          <FeedCardBodyNew
            feed={feed}
            isEditPost={isEditPost}
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
            <FeedCardFooterNew feed={feed} isPost={isPost} post={post} />
          )}
        </Space>
      </Space>
      {showThread && (
        <div className="activity-feed-comments-container d-flex flex-col">
          {showActivityFeedEditor && (
            <Typography.Text className="activity-feed-comments-title m-b-md">
              {t('label.comment-plural')}
            </Typography.Text>
          )}
          {showFeedEditor ? (
            <ActivityFeedEditorNew
              className="m-t-md feed-editor activity-feed-editor-container-new"
              onSave={onSave}
            />
          ) : (
            <div className="d-flex gap-2">
              <div>
                <ProfilePicture
                  avatarType="outlined"
                  key={feed.id}
                  name="admin"
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
          )}

          {showThread && feed?.posts && feed?.posts?.length > 0 && (
            <Col className="p-l-0 p-r-0" data-testid="feed-replies">
              {feed?.posts
                ?.slice()
                .sort((a, b) => (b.postTs as number) - (a.postTs as number))
                .map((reply, index, arr) => (
                  <CommentCard
                    feed={feed}
                    isLastReply={index === arr.length - 1}
                    key={reply.id}
                    post={reply}
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
