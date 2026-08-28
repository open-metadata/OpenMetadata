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
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import {
  Conversation,
  ConversationReply,
} from '../../../generated/entity/feed/conversation';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../utils/FeedUtilsPure';
import { getUserPath } from '../../../utils/RouterUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import FeedCardFooterNew from '../ActivityFeedCardV2/FeedCardFooter/FeedCardFooterNew';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);

interface CommentCardInterface {
  conversation?: Conversation;
  conversationId: string;
  reply: ConversationReply;
  isLastReply: boolean;
  closeFeedEditor: () => void;
}

const CommentCard = ({
  conversation,
  conversationId,
  reply,
  isLastReply,
  closeFeedEditor,
}: CommentCardInterface) => {
  const { updateFeed } = useActivityFeedProvider();
  const [isHovered, setIsHovered] = useState(false);
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [postMessage, setPostMessage] = useState<string>('');
  const seperator = '.';
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditPost &&
        editorRef.current &&
        !editorRef.current.contains(event.target as Node)
      ) {
        setIsEditPost(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditPost]);

  const [, , user] = useUserProfile({
    permission: true,
    name: reply.author.name ?? reply.author.fullyQualifiedName ?? '',
  });

  const onEditPost = () => {
    closeFeedEditor();
    setIsEditPost(!isEditPost);
  };

  const onUpdate = async (message: string) => {
    const updatedReply = { ...reply, message };
    const patch = compare(reply, updatedReply);
    updateFeed(conversationId, reply.id, false, patch);
    setIsEditPost(!isEditPost);
  };

  const handleSave = useCallback(() => {
    onUpdate?.(postMessage ?? '');
  }, [onUpdate, postMessage]);

  const defaultValue = useMemo(
    () => MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(reply.message)),
    [reply.message]
  );

  const feedBodyRender = useMemo(() => {
    if (isEditPost) {
      return (
        <div ref={editorRef}>
          <ActivityFeedEditor
            focused
            className="mb-8 reply-feed-editor"
            defaultValue={defaultValue}
            editorClass="is_edit_post"
            onSave={handleSave}
            onTextChange={(message) => setPostMessage(message)}
          />
        </div>
      );
    }

    return (
      <RichTextEditorPreviewerV1
        className="text-wrap text-xs"
        markdown={getFrontEndFormat(reply.message)}
      />
    );
  }, [isEditPost, postMessage, handleSave]);

  return (
    <div
      className={classNames('d-flex justify-start relative reply-card gap-2', {
        'reply-card-border-bottom': !isLastReply,
      })}
      data-testid="feed-reply-card"
      role="presentation"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className="profile-picture">
        <UserPopOverCard
          userName={reply.author.name ?? reply.author.fullyQualifiedName ?? ''}>
          <div className="d-flex items-center">
            <ProfilePicture
              key={reply.id}
              name={reply.author.name ?? reply.author.fullyQualifiedName ?? ''}
              width="32"
            />
          </div>
        </UserPopOverCard>
      </div>
      <div className="w-full">
        <div className="d-flex items-center gap-2 flex-wrap">
          <Typography.Text className="activity-feed-user-name reply-card-user-name">
            <UserPopOverCard
              userName={
                reply.author.name ?? reply.author.fullyQualifiedName ?? ''
              }>
              <Link
                className="reply-card-user-name"
                to={getUserPath(
                  reply.author.name ?? reply.author.fullyQualifiedName ?? ''
                )}>
                {getEntityName(user)}
              </Link>
            </UserPopOverCard>
          </Typography.Text>
          <Typography.Text className="seperator m-b-xss">
            {seperator}
          </Typography.Text>
          <Typography.Text>
            <Tooltip
              color="white"
              overlayClassName="timestamp-tooltip"
              title={formatDateTime(reply.createdAt)}>
              <Typography.Text
                className="feed-card-header-v2-timestamp mr-2"
                data-testid="timestamp">
                {getRelativeTime(reply.createdAt)}
              </Typography.Text>
            </Tooltip>
          </Typography.Text>
        </div>
        {feedBodyRender}

        <FeedCardFooterNew
          isReply
          conversation={conversation}
          conversationId={conversationId}
          reply={reply}
        />
      </div>

      {isHovered && (
        <ActivityFeedActions
          isReply
          conversation={conversation}
          conversationId={conversationId}
          reply={reply}
          onEditPost={onEditPost}
        />
      )}
    </div>
  );
};

export default CommentCard;
