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
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronUp,
  MessageDotsCircle,
  Plus,
  RefreshCcw01,
  ThumbsUp,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { uniqBy } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Reactions from '../../../../../components/ActivityFeed/Reactions/Reactions';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  ReactionOperation,
  ReactionsVariant,
} from '../../../../../enums/reactions.enum';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../../../generated/entity/feed/conversation';
import { EntityReference } from '../../../../../generated/type/entityReference';
import { Reaction, ReactionType } from '../../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../../../hooks/user-profile/useUserProfile';
import {
  formatDateTime,
  formatDateTimeLong,
} from '../../../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../../../utils/EntityLink';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { getFrontEndFormat } from '../../../../../utils/FeedUtilsPure';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { ActivityKind, ACTIVITY_TYPE_KIND } from '../activityKind';
import {
  ACTIVITY_CLOCK_FORMAT,
  ACTIVITY_DATE_FORMAT,
  applyReaction,
  getActivityChange,
  getActivityEventLabel,
  getActivityTypeKey,
  getFeedSortTimestamp,
  isSameLocalDay,
  sendReaction,
} from '../inbox.utils';
import { createThreadReply, useActivityReplies } from '../useActivityReplies';
import { writeInboxReactions } from '../useInboxActivity';
import ActivityChangePanel from './ActivityChangePanel';
import ActivityThread from './ActivityThread';
import AuthorPopover from './AuthorPopover';

// Repliers shown on the collapsed thread toggle.
const MAX_REPLY_FACES = 3;

export interface ActivityFeedItemProps {
  // Exactly one of `activity` (2.0 event) or `feed` (conversation fallback).
  activity?: ActivityEvent;
  feed?: Conversation;
  // Luxon format for the time; a day-grouped feed shows only the clock time.
  timeFormat?: string;
  // The item, or a reply under it, names the viewer or one of their teams.
  isMentioned?: boolean;
}

const getActorName = (
  isActivity: boolean,
  activity?: ActivityEvent,
  feed?: Conversation
): string =>
  isActivity ? activity?.actor?.name ?? '' : feed?.createdBy?.name ?? '';

const getSourceReactions = (
  isActivity: boolean,
  activity?: ActivityEvent,
  feed?: Conversation
): Reaction[] =>
  ((isActivity ? activity?.reactions : feed?.reactions) ?? []) as Reaction[];

const getAuthorName = (
  user: Parameters<typeof getEntityName>[0],
  isActivity: boolean,
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  actorName: string
): string =>
  getEntityName(user) ||
  (isActivity ? activity?.actor?.displayName : feed?.createdBy?.displayName) ||
  actorName;

const getActionLabel = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  t: TFunction
): string => {
  if (activity) {
    return getActivityEventLabel(activity, t);
  }
  if (feed) {
    return t('message.activity-started-conversation');
  }

  return '';
};

const getEventEntity = (
  isActivity: boolean,
  activity?: ActivityEvent,
  feed?: Conversation
) => {
  const entity = isActivity ? activity?.entity : feed?.entityRef;

  return {
    entity,
    entityName: entity?.displayName || entity?.name || entity?.type,
  };
};

type ActivityBadge = Pick<ActivityKind, 'icon' | 'badgeClassName'>;

const DELETED_BADGE = {
  icon: Trash01,
  badgeClassName: 'tw:bg-utility-error-600',
};
const CONVERSATION_BADGE = {
  icon: MessageDotsCircle,
  badgeClassName: 'tw:bg-utility-gray-600',
};

// Lifecycle events filter as Other but read better with their own badge.
const LIFECYCLE_BADGE: Partial<Record<ActivityEventType, ActivityBadge>> = {
  [ActivityEventType.EntityCreated]: {
    icon: Plus,
    badgeClassName: 'tw:bg-utility-success-600',
  },
  [ActivityEventType.EntityRestored]: {
    icon: RefreshCcw01,
    badgeClassName: 'tw:bg-utility-success-600',
  },
  [ActivityEventType.EntityDeleted]: DELETED_BADGE,
  [ActivityEventType.EntitySoftDeleted]: DELETED_BADGE,
};

// The badge on the actor's avatar that says what kind of change this is.
const getActivityBadge = (activity?: ActivityEvent): ActivityBadge =>
  activity
    ? LIFECYCLE_BADGE[activity.eventType] ??
      ACTIVITY_TYPE_KIND[getActivityTypeKey(activity)]
    : CONVERSATION_BADGE;

/**
 * Where the asset line points. A column-level change reads "table.column" and
 * links to the column; anything else names and links to the entity itself.
 */
const getEntityTarget = (
  entity: EntityReference | undefined,
  entityName: string | undefined,
  about: string | undefined
) => {
  const isColumn = about ? EntityLink.split(about)[2] === 'columns' : false;
  const fqn =
    isColumn && about
      ? EntityLink.getEntityColumnFqn(about)
      : entity?.fullyQualifiedName;

  return {
    parent: isColumn ? `${entityName}.` : '',
    leaf: isColumn && about ? EntityLink.getTableColumnName(about) : entityName,
    path:
      entity?.type && fqn
        ? entityUtilClassBase.getEntityLink(entity.type, fqn)
        : undefined,
  };
};

// "Hide replies" while open; otherwise how many there are.
const getRepliesToggleLabel = (
  isOpen: boolean,
  count: number,
  t: TFunction
): string => {
  if (isOpen) {
    return t('label.hide-reply-plural');
  }

  return count === 1
    ? t('label.one-reply')
    : t('label.number-reply-plural', { number: count });
};

// A toggle (Like, the replies thread) reads brand while it is on: its text and
// icon, without the link underline a link-colored button draws on hover.
const TOGGLE_ON_CLASS =
  'tw:text-brand-secondary tw:hover:text-brand-secondary tw:*:data-icon:text-fg-brand-primary tw:hover:*:data-icon:text-fg-brand-primary';

// A liked card fills its thumb.
const FilledThumbsUp = ({ className }: { className?: string }) => (
  <ThumbsUp className={className} fill="currentColor" />
);

const getLikeLabel = (
  likeCount: number,
  isLiked: boolean,
  t: TFunction
): string => {
  if (isLiked) {
    return t('label.liked-with-count', { count: likeCount });
  }

  return likeCount
    ? t('label.like-with-count', { count: likeCount })
    : t('label.like');
};

interface LikeButtonProps {
  likeCount: number;
  isLiked: boolean;
  onToggle: () => void;
}

// Like is the thumbs-up reaction, toggled from its own button.
const LikeButton = ({ likeCount, isLiked, onToggle }: LikeButtonProps) => {
  const { t } = useTranslation();

  return (
    <Button
      aria-pressed={isLiked}
      // Its icon lines up with the body above, past the button's padding.
      className={classNames('tw:-ml-3', isLiked && TOGGLE_ON_CLASS)}
      color="tertiary"
      data-testid="activity-like"
      iconLeading={isLiked ? FilledThumbsUp : ThumbsUp}
      size="sm"
      onPress={onToggle}>
      {getLikeLabel(likeCount, isLiked, t)}
    </Button>
  );
};

interface RepliesToggleProps {
  isOpen: boolean;
  count: number;
  // Loaded only once the thread has been opened; until then no faces show.
  replies: ConversationReply[];
  onToggle: () => void;
}

// How many replied, and who once they are loaded; stays while the thread is
// open, so it can close even once its last reply is deleted.
const RepliesToggle = ({
  isOpen,
  count,
  replies,
  onToggle,
}: RepliesToggleProps) => {
  const { t } = useTranslation();
  const replyFaces = uniqBy(replies, ({ author }) => author?.name).slice(
    0,
    MAX_REPLY_FACES
  );

  return count > 0 || isOpen ? (
    <Button
      aria-expanded={isOpen}
      className={classNames(
        isOpen && TOGGLE_ON_CLASS,
        isOpen && 'tw:bg-brand-primary tw:hover:bg-brand-primary'
      )}
      color="tertiary"
      data-testid="activity-replies-toggle"
      iconLeading={
        <span className="tw:flex tw:items-center tw:-space-x-1">
          {replyFaces.map(({ id, author }) => (
            <ProfilePicture
              borderless
              // A white edge parts the overlapping faces.
              className="tw:outline-2 tw:outline-bg-primary"
              displayName={author?.displayName}
              key={id}
              name={author?.name ?? ''}
              size="xs"
            />
          ))}
        </span>
      }
      iconTrailing={isOpen ? ChevronUp : ChevronDown}
      size="sm"
      onPress={onToggle}>
      {getRepliesToggleLabel(isOpen, count, t)}
    </Button>
  ) : null;
};

const getEventTimestamp = (
  isActivity: boolean,
  activity?: ActivityEvent,
  feed?: Conversation
): number | undefined =>
  isActivity ? activity?.timestamp : feed?.createdAt ?? feed?.updatedAt;

// A conversation is filed under the day of its last reply; started on an
// earlier day, a bare clock time under that day's header would mislead, so the
// time carries its date.
const getCardTimeFormat = (
  timeFormat: string,
  timestamp?: number,
  feed?: Conversation
): string =>
  timeFormat === ACTIVITY_CLOCK_FORMAT &&
  feed &&
  !isSameLocalDay(timestamp, getFeedSortTimestamp(feed))
    ? ACTIVITY_DATE_FORMAT
    : timeFormat;

const UNDO_REACTION: Record<ReactionOperation, ReactionOperation> = {
  [ReactionOperation.ADD]: ReactionOperation.REMOVE,
  [ReactionOperation.REMOVE]: ReactionOperation.ADD,
};

// The header's right side: whether it names the viewer, and when it happened.
const CardMeta = ({
  isMentioned,
  timeFormat,
  timestamp,
}: {
  isMentioned: boolean;
  timeFormat: string;
  timestamp?: number;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {isMentioned && (
        <Badge
          className="tw:shrink-0"
          color="brand"
          data-testid="activity-mentioned-you"
          size="sm"
          type="color">
          {t('label.mentioned-you')}
        </Badge>
      )}
      <Tooltip
        title={formatDateTime(timestamp)}
        triggerClassName="tw:shrink-0 tw:whitespace-nowrap tw:text-sm tw:text-quaternary">
        {formatDateTimeLong(timestamp, timeFormat)}
      </Tooltip>
    </>
  );
};

/**
 * A single Inbox card for a 2.0 activity event or a conversation: actor +
 * action + entity link, the change (or message) body, and a footer with Like,
 * reactions, Reply and a replies toggle that opens the thread inline below.
 */
const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  feed,
  timeFormat = ACTIVITY_DATE_FORMAT,
  isMentioned = false,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isActivity = Boolean(activity);

  const actorName = getActorName(isActivity, activity, feed);
  const [, , user] = useUserProfile({ permission: false, name: actorName });

  const queryClient = useQueryClient();
  const [reactions, setReactions] = useState<Reaction[]>(() =>
    getSourceReactions(isActivity, activity, feed)
  );
  // Each reaction builds on the latest list, not the one its click rendered
  // with, so two quick reactions both land.
  const reactionsRef = useRef(reactions);
  const updateReactions = useCallback((next: Reaction[]) => {
    reactionsRef.current = next;
    setReactions(next);
  }, []);

  useEffect(() => {
    updateReactions(getSourceReactions(isActivity, activity, feed));
  }, [activity, feed, isActivity, updateReactions]);

  const authorName = getAuthorName(user, isActivity, activity, feed, actorName);
  const actionLabel = getActionLabel(activity, feed, t);
  const { entity, entityName } = getEventEntity(isActivity, activity, feed);
  const timestamp = getEventTimestamp(isActivity, activity, feed);
  const cardTimeFormat = getCardTimeFormat(timeFormat, timestamp, feed);
  const { icon: KindIcon, badgeClassName: kindClassName } =
    getActivityBadge(activity);
  const target = getEntityTarget(entity, entityName, activity?.about);
  const change = useMemo(
    () => (activity ? getActivityChange(activity) : undefined),
    [activity]
  );

  // Like is the thumbs-up reaction, kept out of the emoji row beside it.
  const likes = reactions.filter(
    ({ reactionType }) => reactionType === ReactionType.ThumbsUp
  );
  const isLiked = likes.some(({ user }) => user?.id === currentUser?.id);
  const otherReactions = reactions.filter(
    ({ reactionType }) => reactionType !== ReactionType.ThumbsUp
  );

  const message = useMemo(
    () =>
      getFrontEndFormat(
        isActivity ? activity?.summary ?? '' : feed?.message ?? ''
      ),
    [isActivity, activity?.summary, feed?.message]
  );

  const [isThreadOpen, setIsThreadOpen] = useState(false);
  // Replies load when the thread is opened. Until then a conversation counts
  // them from its own replyCount; an activity event carries no count, so its
  // collapsed card shows only Reply.
  const threadIds = { activityId: activity?.id, conversationId: feed?.id };
  const { threadId, replies, hasLoaded, isLoading, refetch } =
    useActivityReplies(threadIds, isThreadOpen);
  const replyCount = hasLoaded ? replies.length : feed?.replyCount ?? 0;
  // Opened with Reply rather than the toggle: focus the composer.
  const [isReplying, setIsReplying] = useState(false);

  const openThread = (focusComposer: boolean) => {
    setIsThreadOpen(true);
    setIsReplying(focusComposer);
  };

  // A refused reply (e.g. on an activity whose asset was deleted) rejects, so
  // the composer puts the draft back.
  const handleReply = async (message: string) => {
    try {
      await createThreadReply(message, threadIds);
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
    refetch();
  };

  // Shown at once and rolled back if the server refuses; a repeat of the same
  // reaction changes nothing and sends nothing.
  const handleReactionSelect = async (
    reactionType: ReactionType,
    operation: ReactionOperation
  ) => {
    const before = reactionsRef.current;
    const next = applyReaction(before, reactionType, operation, currentUser);
    if (next === before) {
      return;
    }
    updateReactions(next);
    try {
      await sendReaction(threadIds, reactionType, operation);
    } catch (error) {
      updateReactions(
        applyReaction(
          reactionsRef.current,
          reactionType,
          UNDO_REACTION[operation],
          currentUser
        )
      );
      showErrorToast(error as AxiosError);
    }
    writeInboxReactions(
      queryClient,
      activity?.id ?? feed?.id ?? '',
      reactionsRef.current
    );
  };

  return (
    <Box
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:pb-4 tw:shadow-xs tw:transition-colors tw:hover:border-primary"
      data-testid="activity-feed-item"
      direction="col"
      gap={4}>
      <Box className="tw:px-5 tw:pt-4" direction="col" gap={3}>
        <Box gap={3}>
          <span className="tw:relative tw:h-10 tw:shrink-0">
            <AuthorPopover decorative userName={actorName}>
              <ProfilePicture
                borderless
                displayName={authorName}
                name={actorName}
                size="md"
              />
            </AuthorPopover>
            <span
              className={classNames(
                'tw:absolute tw:-right-1 tw:-bottom-1 tw:flex tw:size-5 tw:items-center tw:justify-center tw:rounded-full tw:text-white tw:outline-2 tw:outline-bg-primary',
                kindClassName
              )}
              data-testid="activity-kind-badge">
              <KindIcon className="tw:size-3" />
            </span>
          </span>
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            <Box align="center" gap={2}>
              <Typography
                className="tw:min-w-0 tw:flex-1 tw:text-tertiary"
                size="text-sm">
                <AuthorPopover userName={actorName}>
                  <span className="tw:font-semibold tw:text-primary">
                    {authorName}
                  </span>
                </AuthorPopover>{' '}
                {actionLabel}
              </Typography>
              <CardMeta
                isMentioned={isMentioned}
                timeFormat={cardTimeFormat}
                timestamp={timestamp}
              />
            </Box>
            {target.leaf && (
              <Box align="center" className="tw:min-w-0 tw:gap-1.5">
                {entity?.type && (
                  <span className="tw:flex tw:shrink-0 tw:items-center tw:[&_img]:size-4 tw:[&_svg]:size-4">
                    {searchClassBase.getEntityIcon(entity.type)}
                  </span>
                )}
                <Typography
                  className="tw:truncate tw:text-quaternary"
                  size="text-sm"
                  weight="medium">
                  {target.parent}
                  {target.path ? (
                    <Link
                      // `!`: the Typography's prose styles color its links.
                      className="tw:font-semibold tw:text-primary! tw:no-underline! tw:hover:text-brand-secondary!"
                      data-testid="activity-entity-link"
                      to={target.path}>
                      {target.leaf}
                    </Link>
                  ) : (
                    <span className="tw:font-semibold tw:text-primary">
                      {target.leaf}
                    </span>
                  )}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Box className="tw:ml-13" direction="col">
          {change ? (
            <ActivityChangePanel change={change} />
          ) : (
            <RichTextEditorPreviewerV1
              className="inbox-feed-message tw:text-sm"
              markdown={message}
            />
          )}
        </Box>

        <Box align="center" className="inbox-feed-actions tw:ml-13 tw:gap-2">
          <LikeButton
            isLiked={isLiked}
            likeCount={likes.length}
            onToggle={() =>
              handleReactionSelect(
                ReactionType.ThumbsUp,
                isLiked ? ReactionOperation.REMOVE : ReactionOperation.ADD
              )
            }
          />
          <Reactions
            key={otherReactions
              .map(
                (reaction) => `${reaction.reactionType}:${reaction.user?.id}`
              )
              .join('|')}
            reactions={otherReactions}
            variant={ReactionsVariant.Pill}
            onReactionSelect={handleReactionSelect}
          />
          <Button
            color="tertiary"
            data-testid="activity-reply"
            iconLeading={MessageDotsCircle}
            size="sm"
            onPress={() => openThread(true)}>
            {t('label.reply')}
          </Button>
          <RepliesToggle
            count={replyCount}
            isOpen={isThreadOpen}
            replies={replies}
            onToggle={() =>
              isThreadOpen ? setIsThreadOpen(false) : openThread(false)
            }
          />
        </Box>
      </Box>

      {isThreadOpen && threadId && (
        <ActivityThread
          focusComposer={isReplying}
          isLoading={isLoading}
          replies={replies}
          threadId={threadId}
          onChanged={refetch}
          onReply={handleReply}
        />
      )}
    </Box>
  );
};

// Switching a filter or grouping re-renders the tab; the cards whose item did
// not change need not render again, nor their markdown.
export default React.memo(ActivityFeedItem);
