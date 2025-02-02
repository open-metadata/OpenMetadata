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
import { compare } from 'fast-json-patch';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GeneratedBy, Thread } from '../../../generated/entity/feed/thread';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
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
import ActivityFeedActions from '../Shared/ActivityFeedActions';

const { Text, Link } = Typography;

interface ActivityFeedCardNewProps {
  componentsVisibility: any;
  feed: Thread;
  isPost?: boolean;
  isActive?: boolean;
  post?: any;
  showActivityFeedEditor?: boolean;
  showThread?: boolean;
}

const ActivityFeedCardNew = ({
  componentsVisibility,
  feed,
  isPost = false,
  post,
  showActivityFeedEditor,
  showThread,
  isActive,
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
  const [isHovered, setIsHovered] = useState(false);

  const onSave = (message: string) => {
    postFeed(message, selectedThread?.id ?? '').catch(() => {
      // ignore since error is displayed in toast in the parent promise.
      // Added block for sonar code smell
    });
    setShowFeedEditor(false);
  };
  const onEditPost = () => {
    setIsEditPost(!isEditPost);
  };
  const onUpdate = (message: string) => {
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };
  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);
  // const getDefaultValue = (defaultMessage: string) => {
  //   return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  // };
  // const feedBodyRender = useMemo(() => {
  //   if (isEditPost) {
  //     return (
  //       <ActivityFeedEditor
  //         focused
  //         className="mb-8"
  //         defaultValue={getDefaultValue(post.message)}
  //         editAction={
  //           <div className="d-flex justify-end gap-2 m-r-xss">
  //             <Button
  //               className="border border-primary text-primary rounded-4"
  //               data-testid="cancel-button"
  //               size="small"
  //               // onClick={onEditCancel}
  //             >
  //               {t('label.cancel')}
  //             </Button>
  //             <Button
  //               className="rounded-4"
  //               data-testid="save-button"
  //               // disabled={!message.length}
  //               size="small"
  //               type="primary"
  //               onClick={handleSave}>
  //               {t('label.save')}
  //             </Button>
  //           </div>
  //         }
  //         editorClass="is_edit_post"
  //         onSave={handleSave}
  //         onTextChange={(message) => setPostMessage(message)}
  //       />
  //     );
  //   }

  //   // return feedBodyStyleCardsRender;
  // }, [isEditPost, message]);
  return (
    <Card
      bordered={showThread ? false : true}
      className={`activity-feed-card-new ${
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
      }
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <Space align="start" style={{ width: 'inherit' }}>
        <Space className="d-flex" direction="vertical">
          <Space className="d-inline-flex justify-start">
            {/* <Badge
              dot
              offset={[-5, 30]}
              status="success"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'green',
              }}>
                 </Badge> */}
            <ProfilePicture
              avatarType="outlined"
              key={feed.id}
              name="admin"
              size={40}
            />

            <Space className="d-flex flex-col align-start gap-0" size={0}>
              <Space className="d-flex gap-0" size={0}>
                <Typography.Text
                  className={`mr-2 ${
                    !isPost ? 'activity-feed-user-name' : 'reply-card-user-name'
                  }`}>
                  {feed.updatedBy}
                </Typography.Text>
                <Typography.Text>
                  {post.postTs && (
                    <Tooltip
                      color="white"
                      overlayClassName="timestamp-tooltip"
                      title={formatDateTime(post.postTs)}>
                      <span
                        className="feed-card-header-v2-timestamp mr-2"
                        data-testid="timestamp">
                        {getRelativeTime(post.postTs)}
                      </span>
                    </Tooltip>
                  )}
                </Typography.Text>
              </Space>
              {!isPost && (
                <Space className="align-start">
                  <Typography.Text>
                    {getFeedHeaderTextFromCardStyle(
                      feed.fieldOperation,
                      feed.cardStyle,
                      feed.feedInfo?.fieldName,
                      entityType
                    )}
                  </Typography.Text>

                  <Link
                    className="break-all text-body"
                    data-testid="entity-link"
                    style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
                    // to={entityUtilClassBase.getEntityLink(entityType, entityFQN)}
                  >
                    <span>
                      {(() => {
                        const text = feed?.entityRef
                          ? getEntityName(feed.entityRef)
                          : entityDisplayName(entityType, entityFQN);
                        const safeText = text || ''; // Ensure text is always a string

                        return safeText.length > 50
                          ? `${safeText.slice(0, 50)}...`
                          : safeText;
                      })()}
                    </span>
                  </Link>
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
            onEditCancel={() => setIsEditPost(false)}
            onUpdate={onUpdate}
          />

          <Space className="mt-4">
            <FeedCardFooterNew feed={feed} isPost={isPost} post={post} />
          </Space>
          {(feed.generatedBy !== GeneratedBy.System ||
            (isPost && isHovered)) && (
            <ActivityFeedActions
              feed={feed}
              isPost={isPost}
              post={post}
              onEditPost={onEditPost}
            />
          )}
        </Space>
      </Space>
      {showThread && (
        <div className="activity-feed-comments-container d-flex flex-col">
          {showActivityFeedEditor && (
            <Typography.Text className="activity-feed-comments-title mb-2">
              {/* Comments */}
            </Typography.Text>
          )}
          {showFeedEditor ? (
            <ActivityFeedEditorNew
              className="m-t-md feed-editor activity-feed-editor-container-new"
              onSave={onSave}
            />
          ) : (
            <div className="d-flex gap-2">
              <ProfilePicture
                avatarType="outlined"
                key={feed.id}
                name="admin"
                size={40}
              />

              <Input
                className="comments-input-field"
                placeholder="Use @mention to tag and comment..."
                onMouseEnter={() => setShowFeedEditor(true)}
              />
            </div>
          )}

          {showThread && feed?.posts && feed?.posts?.length > 0 && (
            <Col className="p-l-0 p-r-0" data-testid="feed-replies">
              {feed?.posts?.map((reply) => (
                <ActivityFeedCardNew
                  isPost
                  componentsVisibility={componentsVisibility}
                  feed={feed}
                  isActive={isActive}
                  key={reply.id}
                  post={reply}
                  showActivityFeedEditor={false}
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
