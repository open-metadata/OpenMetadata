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
import { ReactComponent as CloseTabIcon } from '../../../assets/svg/close-tab.svg';
import { Thread } from '../../../generated/entity/feed/thread';
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
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyNew from '../ActivityFeedCard/FeedCardBody/FeedCardBodyNew';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import ActivityFeedEditorNew from '../ActivityFeedEditor/ActivityFeedEditorNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import '../ActivityFeedTab/activity-feed-tab-new.less';
import CommentCard from './ReplyCard.component';
const { Text } = Typography;

interface ActivityFeedCardNewProps {
  componentsVisibility: any;
  feed: Thread;
  isPost?: boolean;
  isActive?: boolean;
  post?: any;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
  handlePanelResize?: () => void;
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
  const [, , user] = useUserProfile({
    permission: true,
    name: post.from ?? '',
  });
  const { t } = useTranslation();
  const { selectedThread, postFeed } = useActivityFeedProvider();
  const [showFeedEditor, setShowFeedEditor] = useState<boolean>(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [postMessage, setPostMessage] = useState<string>('');
  const { updateFeed } = useActivityFeedProvider();
  // const [isHovered, setIsHovered] = useState(false);

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
    updateFeed(feed.id, post.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  return (
    <Card
      bordered={showThread ? false : true}
      className={`realtive activity-feed-card-new ${
        showThread || isPost
          ? 'activity-feed-card-new-right-panel m-0 gap-0'
          : ''
      } ${isPost && 'activity-feed-reply-card'} ${isActive && 'active-card'}`}
      style={
        isActive
          ? {
              background: '#E6F1FE',
            }
          : {}
      }>
      <Space align="start" style={{ width: 'inherit' }}>
        <Space className="d-flex" direction="vertical">
          <Space
            className={classNames('d-inline-flex justify-start items-start', {
              'items-center': showThread,
            })}
            style={showThread ? { marginBottom: '-8px' } : {}}>
            <ProfilePicture
              avatarType="outlined"
              key={feed.id}
              name={feed.updatedBy!}
              size={showThread ? 40 : 32}
            />
            <Space className="d-flex flex-col align-start gap-2" size={0}>
              <Space
                className="d-flex align-center gap-2"
                size={0}
                style={
                  showThread ? { marginTop: '-4px' } : { marginTop: '-6px' }
                }>
                <Typography.Text
                  className={`mr-2 ${
                    !isPost ? 'activity-feed-user-name' : 'reply-card-user-name'
                  }`}>
                  {feed.updatedBy}
                </Typography.Text>
                {post.postTs && (
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
                )}
              </Space>
              {!isPost && (
                <Space
                  className="d-flex align-center gap-1"
                  style={
                    !showThread
                      ? { marginTop: '-6px' }
                      : { marginTop: '-6px', alignItems: 'flex-start' }
                  }>
                  <Typography.Text
                    className="card-style-feed-header"
                    style={{ fontSize: '14px' }}>
                    {getFeedHeaderTextFromCardStyle(
                      feed.fieldOperation,
                      feed.cardStyle,
                      feed.feedInfo?.fieldName,
                      entityType
                    )}
                  </Typography.Text>

                  <Link
                    className="break-all"
                    data-testid="entity-link"
                    style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
                    to={entityUtilClassBase.getEntityLink(
                      entityType,
                      entityFQN
                    )}>
                    <span
                      className={!showThread ? `max-one-line` : ''}
                      style={{ fontSize: '14px' }}>
                      {feed?.entityRef
                        ? getEntityName(feed.entityRef)
                        : entityDisplayName(entityType, entityFQN)}
                    </span>
                  </Link>
                  {showThread && (
                    <CloseTabIcon
                      className="close-tab-icon"
                      height={16}
                      onClick={handlePanelResize}
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
                : post.message
            }
            showThread={showThread}
            onEditCancel={() => setIsEditPost(false)}
            onUpdate={onUpdate}
          />

          {(isPost || (!showThread && !isPost)) && (
            <FeedCardFooterNew feed={feed} isPost={isPost} post={post} />
          )}

          {/* {(feed.generatedBy !== GeneratedBy.System ||
            (isPost && isHovered)) && ( */}
          {/* <ActivityFeedActions
            feed={feed}
            isPost={isPost}
            post={post}
            onEditPost={onEditPost}
          /> */}
          {/* )} */}
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
              <div style={{ width: '32px', height: '32px' }}>
                <ProfilePicture
                  avatarType="outlined"
                  key={feed.id}
                  name="admin"
                  size={32}
                />
              </div>

              <Input
                className="comments-input-field"
                placeholder="Use @mention to tag and comment..."
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
