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
import { Col, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import withSuspenseFallback from '../../../components/AppRouter/withSuspenseFallback';
import { ReactionOperation } from '../../../enums/reactions.enum';
import { EntityReference } from '../../../generated/entity/type';
import { Reaction, ReactionType } from '../../../generated/type/reaction';
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
import Reactions from '../Reactions/Reactions';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import '../ActivityFeedTab/activity-feed-tab.less';
import { COMMENT_ACTIONS_HOVER_REVEAL } from '../Shared/ActivityFeedActions.constants';
const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);

interface CommentCardProps {
  author: EntityReference;
  createdAt: number;
  message: string;
  reactions?: Reaction[];
  isLastReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (message: string) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Omitted by callers with no reactions support - hides the footer entirely. */
  onReaction?: (
    type: ReactionType,
    operation: ReactionOperation
  ) => Promise<void>;
  /**
   * Lets the owning feed dismiss its own reply editor when this card opens
   * one, so the two are never open at the same time. Optional because callers
   * outside the activity feed have no second editor to close.
   */
  closeFeedEditor?: () => void;
}

const CommentCard = ({
  author,
  createdAt,
  message,
  reactions,
  isLastReply,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onReaction,
  closeFeedEditor,
}: CommentCardProps) => {
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [postMessage, setPostMessage] = useState<string>('');
  const seperator = '.';
  const editorRef = useRef<HTMLDivElement>(null);
  const authorName = author.name ?? author.fullyQualifiedName ?? '';

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
    name: authorName,
  });

  const onEditPost = () => {
    closeFeedEditor?.();
    setIsEditPost(!isEditPost);
  };

  const handleSave = useCallback(async () => {
    try {
      await onEdit(postMessage ?? '');
      setIsEditPost(false);
    } catch {
      // Keep the editor open and the draft intact so the edit can be retried.
      // The caller owns reporting the failure.
    }
  }, [onEdit, postMessage]);

  const defaultValue = useMemo(
    () => MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(message)),
    [message]
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
        markdown={getFrontEndFormat(message)}
      />
    );
  }, [isEditPost, postMessage, handleSave]);

  return (
    <div
      className={classNames(
        'd-flex items-start justify-start relative reply-card gap-2 tw:group/comment',
        {
          'reply-card-border-bottom': !isLastReply,
        }
      )}
      data-testid="feed-reply-card">
      <div className="profile-picture">
        <UserPopOverCard userName={authorName}>
          <div className="d-flex items-center">
            <ProfilePicture name={authorName} width="32" />
          </div>
        </UserPopOverCard>
      </div>
      <div className="w-full">
        <div className="d-flex items-center gap-2 flex-wrap">
          <Typography.Text className="activity-feed-user-name reply-card-user-name">
            <UserPopOverCard userName={authorName}>
              <Link
                className="reply-card-user-name"
                to={getUserPath(authorName)}>
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
              title={formatDateTime(createdAt)}>
              <Typography.Text
                className="feed-card-header-v2-timestamp mr-2"
                data-testid="timestamp">
                {getRelativeTime(createdAt)}
              </Typography.Text>
            </Tooltip>
          </Typography.Text>
        </div>
        {feedBodyRender}

        {onReaction && (
          <Row align="top" className="m-y-md">
            <Col
              className="reply-card-footer"
              data-testid="feed-card-footer"
              span={24}>
              <div className="d-flex items-center gap-2 w-full">
                <Reactions
                  reactions={reactions ?? []}
                  onReactionSelect={onReaction}
                />
              </div>
            </Col>
          </Row>
        )}
      </div>

      <ActivityFeedActions
        isReply
        canDelete={canDelete}
        canEdit={canEdit}
        className={COMMENT_ACTIONS_HOVER_REVEAL}
        onDelete={onDelete}
        onEditPost={onEditPost}
      />
    </div>
  );
};

export default CommentCard;
