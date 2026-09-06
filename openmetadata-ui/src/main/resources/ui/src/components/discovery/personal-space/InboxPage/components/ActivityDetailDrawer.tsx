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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Maximize02, Minimize02, Trash01, X } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import DeleteModal from '../../../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../../../generated/entity/feed/conversation';
import { Access } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../../../hooks/user-profile/useUserProfile';
import {
  createConversationReply,
  deleteConversationReply,
  listConversationReplies,
  patchConversationReply,
} from '../../../../../rest/conversationsAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../../utils/FeedUtilsPure';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import {
  formatActivityTime,
  getActivityEventLabel,
  getFeedTimestamp,
} from '../inbox.utils';
import { useFeedDeleteAccess } from '../useFeedDeleteAccess';
import './activity-detail-drawer.less';
import InboxCommentComposer from './InboxCommentComposer';

export interface ActivityDetailDrawerProps {
  // Exactly one of `activity` (2.0 event) or `feed` (conversation fallback).
  activity?: ActivityEvent;
  feed?: Conversation;
  open: boolean;
  onClose: () => void;
  // Notify the parent that a comment was added so it can refresh counts.
  onPosted?: (conversationId: string) => void;
}

const CommentsSkeleton: React.FC = () => (
  <Box data-testid="comments-skeleton" direction="col" gap={4}>
    {Array.from({ length: 3 }).map((_, index) => (
      // eslint-disable-next-line react/no-array-index-key -- static fixed-length skeleton, never reordered
      <Box direction="col" gap={2} key={index}>
        <Box align="center" gap={2}>
          <Skeleton height={26} variant="circular" width={26} />
          <Skeleton height={14} variant="text" width={120} />
        </Box>
        <Skeleton height={56} variant="rounded" width="100%" />
      </Box>
    ))}
  </Box>
);

interface CommentRowProps {
  reply: ConversationReply;
  conversationId: string;
  // Evaluated `feed` Delete access, preflighted once at drawer level
  // (undefined while loading, on failure, or for admins who skip the fetch).
  deleteAccess?: Access;
  // Reload the conversation's replies after an edit or delete.
  onChanged: () => void;
}

/**
 * A single comment. The author can edit it; delete is gated on the
 * server-evaluated `feed` Delete permission so the icon never shows when the
 * API would 403.
 */
const CommentRow: React.FC<CommentRowProps> = ({
  reply,
  conversationId,
  deleteAccess,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  // A reply carries its author as an EntityReference rather than the bare
  // username the legacy post did.
  const authorLogin = reply.author?.name ?? '';
  const [, , user] = useUserProfile({
    permission: false,
    name: authorLogin,
  });
  const authorName =
    getEntityName(user) || reply.author?.displayName || authorLogin;

  const isAuthor =
    Boolean(currentUser?.name) && authorLogin === currentUser?.name;
  const canEdit = isAuthor;
  const isAdmin = Boolean(currentUser?.isAdmin);
  // Admins bypass policy evaluation server-side. ConditionalAllow → author
  // only: exact for the default isOwner() rule; an approximation for other
  // conditional rules, since the blanket permissions endpoint never evaluates
  // conditions (see useFeedDeleteAccess). The backend re-authorizes on click.
  const canDelete =
    isAdmin ||
    deleteAccess === Access.Allow ||
    (deleteAccess === Access.ConditionalAllow && isAuthor);

  const [isHovered, setIsHovered] = useState(false);
  const [isEditPost, setIsEditPost] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditSave = useCallback(
    async (message: string) => {
      if (!message) {
        return;
      }
      try {
        const patch = compare(reply, { ...reply, message });
        await patchConversationReply(conversationId, reply.id, patch);
        setIsEditPost(false);
        onChanged();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [reply, conversationId, onChanged]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteConversationReply(conversationId, reply.id);
      onChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      // Close on failure too — retry clicks stack identical error toasts.
      setShowDeleteDialog(false);
      setIsDeleting(false);
    }
  }, [reply.id, conversationId, onChanged]);

  const canShowActions = isHovered && !isEditPost;

  return (
    <Box
      className="tw:relative"
      data-testid="feed-reply-card"
      direction="col"
      gap={2}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <Box align="center" className="tw:justify-between" gap={2}>
        <Box align="center" gap={2}>
          <ProfilePicture
            displayName={authorName}
            name={authorLogin}
            width="26"
          />
          <Typography size="text-sm" weight="medium">
            {authorName}
          </Typography>
        </Box>
        {canShowActions && (canEdit || canDelete) && (
          <Box align="center" data-testid="feed-actions" gap={1}>
            {canEdit && (
              <Edit01
                className="tw:cursor-pointer tw:text-secondary"
                data-testid="edit-message"
                height={16}
                width={16}
                onClick={() => setIsEditPost(true)}
              />
            )}
            {canDelete && (
              <Trash01
                className="tw:cursor-pointer tw:text-error-primary"
                data-testid="delete-message"
                height={16}
                width={16}
                onClick={() => setShowDeleteDialog(true)}
              />
            )}
          </Box>
        )}
      </Box>
      {isEditPost ? (
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
              onPress={() => setIsEditPost(false)}>
              {t('label.cancel')}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box className="tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:bg-utility-gray-blue-50 tw:px-4 tw:py-3 tw:border-[0.6px]">
          <RichTextEditorPreviewerV1
            className="inbox-feed-message tw:text-sm"
            markdown={getFrontEndFormat(reply.message)}
          />
        </Box>
      )}
      <Typography className="tw:text-secondary" size="text-xs">
        {formatActivityTime(reply.createdAt)}
      </Typography>

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

/**
 * Right-anchored side modal showing a single activity or conversation.
 * Conversations carry a comment thread and composer; change-event activities
 * are read-only (upstream parity, open-metadata/OpenMetadata#30879).
 */
const ActivityDetailDrawer: React.FC<ActivityDetailDrawerProps> = ({
  activity,
  feed,
  open,
  onClose,
  onPosted,
}) => {
  const { t } = useTranslation();
  const isActivity = Boolean(activity);
  const [isExpanded, setIsExpanded] = useState(false);
  const [replies, setReplies] = useState<ConversationReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const actorName = isActivity
    ? activity?.actor?.name ?? ''
    : feed?.createdBy?.name ?? '';
  const [, , author] = useUserProfile({ permission: false, name: actorName });
  const authorName =
    getEntityName(author) ||
    (isActivity
      ? activity?.actor?.displayName
      : feed?.createdBy?.displayName) ||
    actorName;

  // Replies are their own resource in Conversation V2 rather than a field on
  // the root, so refreshing the list is a reply read, not a re-read of the
  // conversation.
  // Skeleton on the first read only: swapping the mounted list for it on a
  // refresh unmounts every CommentRow, dropping the hover state its edit and
  // delete actions live behind.
  const loadReplies = useCallback(
    async (showSkeleton = false) => {
      if (!feed?.id) {
        return;
      }
      if (showSkeleton) {
        setIsLoading(true);
      }
      try {
        const res = await listConversationReplies(feed.id);
        setReplies(res.data ?? []);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (showSkeleton) {
          setIsLoading(false);
        }
      }
    },
    [feed?.id]
  );

  // Only conversations carry replies; change-event activities are read-only
  // (open-metadata/OpenMetadata#30879).
  useEffect(() => {
    setReplies([]);
    if (open && feed?.id) {
      loadReplies(true);
    }
  }, [open, feed?.id, loadReplies]);

  const handleSave = useCallback(
    async (message: string) => {
      if (!message || !feed?.id) {
        return;
      }
      try {
        await createConversationReply(feed.id, { message });
        await loadReplies();
        onPosted?.(feed.id);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [feed?.id, loadReplies, onPosted]
  );

  // Reload replies and the parent's comment count after an edit or delete.
  const handleCommentChanged = useCallback(() => {
    if (feed?.id) {
      loadReplies();
      onPosted?.(feed.id);
    }
  }, [loadReplies, onPosted, feed?.id]);

  // Read-only activities never comment, so only conversations preflight.
  const canComment = Boolean(feed?.id);
  const feedDeleteAccess = useFeedDeleteAccess(open && canComment);
  // Guard: the drawer renders even when nothing is selected (both undefined).
  let actionLabel = '';
  if (activity) {
    actionLabel = getActivityEventLabel(activity, t);
  } else if (feed) {
    actionLabel = t('label.posted-on');
  }
  const entity = isActivity ? activity?.entity : feed?.entityRef;
  const entityName = entity?.displayName || entity?.name || entity?.type;
  const bodyMessage = isActivity
    ? activity?.summary ?? ''
    : feed?.message ?? '';
  const timestamp = isActivity
    ? activity?.timestamp
    : feed && getFeedTimestamp(feed);
  // Mirrors ChatDrawer's expand/collapse chrome.
  const panelWidth = isExpanded ? '100%' : '45%';

  return (
    <ModalOverlay
      isDismissable
      className="ai-activity-detail-overlay tw:items-stretch tw:p-0 tw:backdrop-blur-none tw:sm:justify-end"
      isOpen={open}
      onOpenChange={(isModalOpen) => {
        if (!isModalOpen) {
          onClose();
        }
      }}>
      <Modal
        className="tw:h-full tw:max-h-full tw:min-w-[420px] tw:rounded-none"
        style={{ width: panelWidth, maxWidth: panelWidth }}>
        <Dialog
          className="tw:h-full tw:w-full tw:items-stretch tw:rounded-none"
          width={Infinity}>
          {(activity || feed) && (
            // rounded-2xl matches the core Dialog panel radius: the less hack
            // sets the panel's overflow to visible (mention popup must escape),
            // so this box is no longer clipped and must round itself.
            <Box
              className="tw:flex tw:h-full tw:flex-col tw:rounded-2xl tw:bg-primary"
              data-testid="activity-detail-drawer"
              direction="col">
              <Box
                align="center"
                className="tw:shrink-0 tw:justify-between tw:gap-2 tw:border-b tw:border-secondary tw:px-5 tw:py-4">
                {/* One line: name + action never shrink; the badge truncates. */}
                <Box
                  align="center"
                  className="tw:min-w-0 tw:flex-1 tw:overflow-hidden"
                  gap={2}>
                  <ProfilePicture
                    displayName={authorName}
                    name={actorName}
                    width="28"
                  />
                  <Typography
                    className="tw:shrink-0 tw:whitespace-nowrap"
                    size="text-sm"
                    weight="medium">
                    {authorName}
                  </Typography>
                  <Typography
                    className="tw:shrink-0 tw:whitespace-nowrap tw:text-secondary"
                    size="text-sm">
                    {actionLabel}
                  </Typography>
                  {entityName && (
                    // max-w-full caps Badge's own `tw:size-max` so the name
                    // can truncate.
                    <Badge
                      className="tw:min-w-0 tw:max-w-full"
                      size="sm"
                      type="color">
                      <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-1">
                        {entity?.type && (
                          <span className="tw:flex tw:shrink-0 tw:items-center tw:[&_img]:size-4 tw:[&_svg]:size-4">
                            {searchClassBase.getEntityIcon(entity.type)}
                          </span>
                        )}
                        <span className="tw:truncate">{entityName}</span>
                      </span>
                    </Badge>
                  )}
                </Box>
                <Box align="center" gap={1}>
                  <ButtonUtility
                    aria-label={
                      isExpanded ? t('label.collapse') : t('label.expand')
                    }
                    color="tertiary"
                    icon={
                      isExpanded ? (
                        <Minimize02 height={16} width={16} />
                      ) : (
                        <Maximize02 height={16} width={16} />
                      )
                    }
                    size="sm"
                    onClick={() => setIsExpanded((v) => !v)}
                  />
                  <ButtonUtility
                    aria-label={t('label.close')}
                    color="tertiary"
                    data-testid="close-drawer"
                    icon={<X height={16} width={16} />}
                    size="sm"
                    onClick={onClose}
                  />
                </Box>
              </Box>

              <Box
                className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4"
                direction="col"
                gap={3}>
                <Box
                  className="tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:bg-utility-gray-blue-50 tw:px-4 tw:py-3 tw:border-[0.6px]"
                  direction="col"
                  gap={1}>
                  <RichTextEditorPreviewerV1
                    className="inbox-feed-message tw:text-sm"
                    markdown={getFrontEndFormat(bodyMessage)}
                  />
                </Box>
                <Typography className="tw:text-secondary" size="text-xs">
                  {formatActivityTime(timestamp)}
                </Typography>

                {canComment && <InboxCommentComposer onSave={handleSave} />}

                {isLoading && <CommentsSkeleton />}

                {!isLoading && feed?.id && replies.length > 0 && (
                  <Box direction="col" gap={4}>
                    {replies.map((reply) => (
                      <CommentRow
                        conversationId={feed.id}
                        deleteAccess={feedDeleteAccess}
                        key={reply.id}
                        reply={reply}
                        onChanged={handleCommentChanged}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ActivityDetailDrawer;
