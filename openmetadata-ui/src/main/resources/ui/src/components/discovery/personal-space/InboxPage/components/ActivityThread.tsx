/*
 *  Copyright 2026 Collate.
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

import {
  Box,
  Button,
  ButtonUtility,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import Reactions from '../../../../../components/ActivityFeed/Reactions/Reactions';
import DeleteModal from '../../../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  ReactionOperation,
  ReactionsVariant,
} from '../../../../../enums/reactions.enum';
import { ConversationReply } from '../../../../../generated/entity/feed/conversation';
import { Access } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import { Reaction, ReactionType } from '../../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../../../hooks/user-profile/useUserProfile';
import {
  addConversationReplyReaction,
  deleteConversationReply,
  patchConversationReply,
  removeConversationReplyReaction,
} from '../../../../../rest/conversationsAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { formatActivityTime } from '../inbox.utils';
import { useFeedDeleteAccess } from '../useFeedDeleteAccess';
import AuthorPopover from './AuthorPopover';
import InboxCommentComposer from './InboxCommentComposer';

// Admins bypass policy evaluation server-side. ConditionalAllow → author
// only: exact for the default isOwner() rule; an approximation for other
// conditional rules, since the blanket permissions endpoint never evaluates
// conditions (see useFeedDeleteAccess). The backend re-authorizes on click.
const canDeleteReply = (
  isAdmin: boolean,
  deleteAccess: Access | undefined,
  isAuthor: boolean
) =>
  isAdmin ||
  deleteAccess === Access.Allow ||
  (deleteAccess === Access.ConditionalAllow && isAuthor);

interface ReplyReactionsProps {
  reactions?: Reaction[];
  onReactionSelect: (
    reactionType: ReactionType,
    operation: ReactionOperation
  ) => void;
}

// Apart from the text above; a lone smiley's icon lines up with the text, past
// the button's inset.
const ReplyReactions = ({
  reactions,
  onReactionSelect,
}: ReplyReactionsProps) => (
  <Box
    className={classNames(
      'inbox-feed-actions tw:mt-2',
      isEmpty(reactions) && 'tw:-ml-1.5'
    )}>
    <Reactions
      reactions={reactions ?? []}
      variant={ReactionsVariant.Pill}
      onReactionSelect={onReactionSelect}
    />
  </Box>
);

interface ReplyRowProps {
  reply: ConversationReply;
  threadId: string;
  deleteAccess?: Access;
  // Re-read the thread after an edit, delete or reaction.
  onChanged: () => void;
}

/**
 * One reply. The author can edit it; delete is gated on the server-evaluated
 * conversation Delete permission so the icon never shows when the API would
 * 403. Anyone can react to it.
 */
const ReplyRow = ({
  reply,
  threadId,
  deleteAccess,
  onChanged,
}: ReplyRowProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const authorLogin = reply.author?.name ?? '';
  const [, , user] = useUserProfile({ permission: false, name: authorLogin });
  const authorName =
    getEntityName(user) || reply.author?.displayName || authorLogin;
  const isAuthor =
    Boolean(currentUser?.name) && authorLogin === currentUser?.name;
  const canDelete = canDeleteReply(
    Boolean(currentUser?.isAdmin),
    deleteAccess,
    isAuthor
  );

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditSave = useCallback(
    async (message: string) => {
      if (!message) {
        return;
      }
      try {
        const patch = compare(reply, { ...reply, message });
        await patchConversationReply(threadId, reply.id, patch);
        setIsEditing(false);
        onChanged();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [reply, threadId, onChanged]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteConversationReply(threadId, reply.id);
      onChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      // Close on failure too — retry clicks stack identical error toasts.
      setShowDeleteDialog(false);
      setIsDeleting(false);
    }
  }, [reply.id, threadId, onChanged]);

  const handleReaction = useCallback(
    async (reactionType: ReactionType, operation: ReactionOperation) => {
      try {
        await (operation === ReactionOperation.ADD
          ? addConversationReplyReaction(threadId, reply.id, reactionType)
          : removeConversationReplyReaction(threadId, reply.id, reactionType));
        onChanged();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [reply.id, threadId, onChanged]
  );

  return (
    <Box className="tw:group" data-testid="feed-reply-card" gap={3}>
      <AuthorPopover decorative userName={authorLogin}>
        <ProfilePicture
          borderless
          displayName={authorName}
          name={authorLogin}
          size="xs"
        />
      </AuthorPopover>
      <Box className="tw:min-w-0 tw:flex-1 tw:gap-0.5" direction="col">
        {/* The text's height: the hover actions overflow it rather than push
            the message down. */}
        <Box align="center" className="tw:h-5" gap={2}>
          <AuthorPopover userName={authorLogin}>
            <Typography size="text-sm" weight="semibold">
              {authorName}
            </Typography>
          </AuthorPopover>
          <Typography className="tw:text-quaternary" size="text-xs">
            {formatActivityTime(reply.createdAt)}
          </Typography>
          {!isEditing && (
            <Box
              align="center"
              className="tw:ml-auto tw:opacity-0 tw:transition-opacity tw:group-hover:opacity-100 tw:focus-within:opacity-100"
              data-testid="feed-actions"
              gap={1}>
              {isAuthor && (
                <ButtonUtility
                  color="tertiary"
                  data-testid="edit-message"
                  icon={<Edit01 height={16} width={16} />}
                  size="xs"
                  tooltip={t('label.edit')}
                  onClick={() => setIsEditing(true)}
                />
              )}
              {canDelete && (
                <ButtonUtility
                  color="tertiary"
                  data-testid="delete-message"
                  icon={<Trash01 height={16} width={16} />}
                  size="xs"
                  tooltip={t('label.delete')}
                  onClick={() => setShowDeleteDialog(true)}
                />
              )}
            </Box>
          )}
        </Box>
        {isEditing ? (
          <Box data-testid="edit-message-editor" direction="col" gap={2}>
            <ActivityFeedEditorNew
              focused
              defaultValue={MarkdownToHTMLConverter.makeHtml(
                getFrontEndFormat(reply.message)
              )}
              onSave={handleEditSave}
            />
            <Box align="center" className="tw:justify-end">
              <Button
                color="link-gray"
                data-testid="cancel-edit-message"
                size="sm"
                onPress={() => setIsEditing(false)}>
                {t('label.cancel')}
              </Button>
            </Box>
          </Box>
        ) : (
          <RichTextEditorPreviewerV1
            className="inbox-feed-message tw:text-sm"
            markdown={getFrontEndFormat(reply.message)}
          />
        )}
        <ReplyReactions
          reactions={reply.reactions}
          onReactionSelect={handleReaction}
        />
      </Box>

      <DeleteModal
        entityTitle={t('label.comment')}
        isDeleting={isDeleting}
        message={t('message.confirm-delete-message')}
        open={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onDelete={handleDelete}
      />
    </Box>
  );
};

export interface ActivityThreadProps {
  threadId: string;
  replies: ConversationReply[];
  isLoading: boolean;
  // Focus the composer: the thread was opened with Reply.
  focusComposer: boolean;
  onReply: (message: string) => void;
  onChanged: () => void;
}

/** A card's replies, in order, with the composer beneath them. */
const ActivityThread = ({
  threadId,
  replies,
  isLoading,
  focusComposer,
  onReply,
  onChanged,
}: ActivityThreadProps) => {
  const { t } = useTranslation();
  const deleteAccess = useFeedDeleteAccess(true);

  return (
    <Box
      className="tw:border-t tw:border-secondary tw:px-5 tw:pt-4"
      data-testid="activity-thread"
      direction="col"
      gap={4}>
      {isLoading ? (
        <Skeleton height={56} variant="rounded" width="100%" />
      ) : (
        replies.map((reply) => (
          <ReplyRow
            deleteAccess={deleteAccess}
            key={reply.id}
            reply={reply}
            threadId={threadId}
            onChanged={onChanged}
          />
        ))
      )}
      <InboxCommentComposer
        focused={focusComposer}
        placeHolder={t('label.reply-in-conversation')}
        onSave={onReply}
      />
    </Box>
  );
};

export default ActivityThread;
