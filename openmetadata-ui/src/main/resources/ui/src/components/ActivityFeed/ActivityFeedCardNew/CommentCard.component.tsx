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
import { Box, Tooltip, Typography } from '@openmetadata/ui-core-components';
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
import { getSettingsLink } from '../../../utils/SettingsModalLinkUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import '../ActivityFeedTab/activity-feed-tab.less';
import Reactions from '../Reactions/Reactions';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import { getReplyLayout } from './CommentCard.utils';
const ActivityFeedEditor = withSuspenseFallback(
  lazy(() => import('../ActivityFeedEditor/ActivityFeedEditorNew'))
);
const CommentEditForm = withSuspenseFallback(
  lazy(() =>
    import('../../common/CommentComposer/CommentComposer').then((module) => ({
      default: module.CommentEditForm,
    }))
  )
);

/**
 * The comment being rendered. Declared structurally rather than as
 * ConversationReply or TaskComment so one card serves both: the activity feed
 * passes a conversation reply, the task and incident tabs pass a task comment,
 * and these four fields are all this component reads from either. There is no
 * `conversation` counterpart because a task comment has none - anything that
 * needs the surrounding thread is handled by the caller through the callbacks
 * below.
 */
export interface CommentCardReply {
  author: EntityReference;
  createdAt: number;
  message: string;
  reactions?: Reaction[];
}

interface CommentCardProps {
  reply: CommentCardReply;
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
  /**
   * In the activity thread panels: Edit / Delete sit in a menu, and the reply
   * is edited in the comment edit form.
   */
  isThreadPanel?: boolean;
}

const CommentCard = ({
  reply,
  isLastReply,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onReaction,
  closeFeedEditor,
  isThreadPanel,
}: CommentCardProps) => {
  // Unpacked once here so the rest of the component reads the same field names
  // regardless of which comment shape the caller handed over.
  const { author, createdAt, message, reactions } = reply;
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [postMessage, setPostMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
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
    // The editor stays open while the save is in flight, so guard against a
    // second submit firing a concurrent edit.
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await onEdit(postMessage ?? '');
      setIsEditPost(false);
    } catch {
      // Keep the editor open and the draft intact so the edit can be retried.
      // The caller owns reporting the failure.
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, onEdit, postMessage]);

  const defaultValue = useMemo(
    () => MarkdownToHTMLConverter.makeHtml(getFrontEndFormat(message)),
    [message]
  );

  const handleFormSave = useCallback(
    async (updatedMessage: string) => {
      await onEdit(updatedMessage);
      setIsEditPost(false);
    },
    [onEdit]
  );

  const feedBodyRender = useMemo(() => {
    if (isEditPost && isThreadPanel) {
      return (
        <Box direction="col" ref={editorRef}>
          <CommentEditForm
            message={message}
            testId="edit-message"
            onCancel={() => setIsEditPost(false)}
            onSave={handleFormSave}
          />
        </Box>
      );
    }
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
  }, [
    isEditPost,
    isThreadPanel,
    message,
    defaultValue,
    handleSave,
    handleFormSave,
  ]);

  const layout = getReplyLayout(isThreadPanel, isLastReply);

  return (
    <div className={layout.root} data-testid="feed-reply-card">
      <div className={layout.avatar}>
        <UserPopOverCard userName={authorName}>
          <div className="d-flex items-center">
            <ProfilePicture name={authorName} size={layout.avatarSize} />
          </div>
        </UserPopOverCard>
      </div>
      <div className={layout.body}>
        <div className="d-flex items-center gap-2 tw:justify-between">
          <div className={layout.header}>
            <Typography
              className={classNames(
                'activity-feed-user-name reply-card-user-name not-prose',
                layout.name
              )}>
              <UserPopOverCard userName={authorName}>
                <Link
                  className="reply-card-user-name"
                  to={getSettingsLink(getUserPath(authorName))}>
                  {getEntityName(user)}
                </Link>
              </UserPopOverCard>
            </Typography>
            {layout.showSeparator && (
              <Typography
                className="m-b-xss"
                color="secondary"
                size="text-lg"
                weight="bold">
                {seperator}
              </Typography>
            )}
            <Tooltip
              excludeTriggerFromTabOrder
              title={formatDateTime(createdAt)}>
              <Typography
                className="feed-card-header-v2-timestamp mr-2"
                color="secondary"
                data-testid="timestamp"
                size="text-xs">
                {getRelativeTime(createdAt)}
              </Typography>
            </Tooltip>
          </div>
          <ActivityFeedActions
            isReply
            asMenu={isThreadPanel}
            canDelete={canDelete}
            canEdit={canEdit}
            onDelete={onDelete}
            onEditPost={onEditPost}
          />
        </div>
        {feedBodyRender}

        {onReaction && (
          <div className={layout.reactions}>
            <div className="w-full" data-testid="feed-card-footer">
              <div className="d-flex items-center gap-2 w-full">
                <Reactions
                  reactions={reactions ?? []}
                  variant={layout.reactionsVariant}
                  onReactionSelect={onReaction}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentCard;
