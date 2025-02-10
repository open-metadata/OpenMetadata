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
import { Tooltip, Typography } from 'antd';
import { compare } from 'fast-json-patch';
import React, { useCallback, useMemo, useState } from 'react';
import { Thread } from '../../../generated/entity/feed/thread';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
// import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditorNew';

const { Text } = Typography;

interface CommentCardInterface {
  feed: Thread;
  post: any;
}

const CommentCard = ({ feed, post }: CommentCardInterface) => {
  const [isHovered, setIsHovered] = useState(false);
  //   const { entityFQN, entityType } = useMemo(() => {
  //     const entityFQN = getEntityFQN(feed.about) ?? '';
  //     const entityType = getEntityType(feed.about) ?? '';

  //     return { entityFQN, entityType };
  //   }, [feed.about]);
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
    updateFeed(feed.id, post.id, false, patch);
    setIsEditPost(!isEditPost);
  };
  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);
  const getDefaultValue = (defaultMessage: string) => {
    return MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(defaultMessage));
  };
  const feedBodyRender = useMemo(() => {
    if (isEditPost) {
      return (
        <ActivityFeedEditor
          focused
          className="mb-8"
          defaultValue={getDefaultValue(post.message)}
          //   editAction={
          //     <div className="d-flex justify-end gap-2 m-r-xss">
          //       <Button
          //         className="border border-primary text-primary rounded-4"
          //         data-testid="cancel-button"
          //         size="small"
          //         // onClick={onEditCancel}
          //       >
          //         {t('label.cancel')}
          //       </Button>
          //       <Button
          //         className="rounded-4"
          //         data-testid="save-button"
          //         disabled={!post.message.length}
          //         size="small"
          //         type="primary"
          //         onClick={handleSave}>
          //         {t('label.save')}
          //       </Button>
          //     </div>
          //   }
          editorClass="is_edit_post"
          onSave={handleSave}
          onTextChange={(message) => setPostMessage(message)}
        />
      );
    }

    return null;
  }, [isEditPost, postMessage, handleSave]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '16px 0px 0px 0px',
        // margin: '10px 0px',
        borderBottom: '1.5px solid  #E4E4E4',
        position: 'relative',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <ProfilePicture
        avatarType="outlined"
        // key={user.id}
        name="admin"
        size={32}
      />
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
          <Typography.Text
            className={` 
                              activity-feed-user-name reply-card-user-name'
                            `}>
            {feed.updatedBy}
          </Typography.Text>
          <Typography.Text
            style={{
              verticalAlign: 'middle',
              fontSize: '18px',
              fontWeight: 800,
              margin: 'auto 0px',
              color: '#A1A1AA',
              marginBottom: '8px',
            }}>
            {t('label.dot')}
          </Typography.Text>
          <Typography.Text>
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
          </Typography.Text>
        </div>
        {isEditPost ? (
          feedBodyRender
        ) : (
          <Text
            style={{
              color: '#4A4A4A',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              display: 'block',
              fontSize: '12px',
              fontWeight: 400,
            }}>
            {post.message}
          </Text>
        )}

        <div className="m-y-md">
          <FeedCardFooterNew isPost feed={feed} post={post} />
        </div>
      </div>

      {isHovered && (
        <ActivityFeedActions
          isPost
          feed={feed}
          post={post}
          onEditPost={onEditPost}
        />
      )}
    </div>
  );
};

export default CommentCard;
