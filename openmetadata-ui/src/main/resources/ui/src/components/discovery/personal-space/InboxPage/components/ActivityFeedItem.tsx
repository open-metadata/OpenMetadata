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
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronUp,
  MessageCircle01,
  MessageDotsCircle,
  Plus,
  RefreshCcw01,
  ThumbsUp,
  Trash01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { uniqBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Link } from 'react-router-dom';
import Reactions from '../../../../../components/ActivityFeed/Reactions/Reactions';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { ReactionOperation } from '../../../../../enums/reactions.enum';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../../generated/entity/activity/activityEvent';
import { Conversation } from '../../../../../generated/entity/feed/conversation';
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
  ACTIVITY_DATE_FORMAT,
  getActivityChange,
  getActivityEventLabel,
  getActivityTypeKey,
  toggleActivityReaction,
  toggleConversationReaction,
} from '../inbox.utils';
import { createThreadReply, useActivityReplies } from '../useActivityReplies';
import './activity-feed-item.less';
import ActivityChangePanel from './ActivityChangePanel';
import ActivityThread from './ActivityThread';

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

const getEventTimestamp = (
  isActivity: boolean,
  activity?: ActivityEvent,
  feed?: Conversation
): number | undefined =>
  isActivity ? activity?.timestamp : feed?.createdAt ?? feed?.updatedAt;

/**
 * A single Inbox card: actor + action + entity chip, the message body, and a
 * footer with reactions (plus a comment affordance for conversations —
 * change-event activities are read-only). Renders either a 2.0 activity event
 * or a conversation. Clicking opens the detail drawer.
 */
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
      <Tooltip title={formatDateTime(timestamp)}>
        <TooltipTrigger className="tw:shrink-0 tw:whitespace-nowrap tw:text-sm tw:text-quaternary">
          {formatDateTimeLong(timestamp, timeFormat)}
        </TooltipTrigger>
      </Tooltip>
    </>
  );
};

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

  const [reactions, setReactions] = useState<Reaction[]>(() =>
    getSourceReactions(isActivity, activity, feed)
  );

  useEffect(() => {
    setReactions(getSourceReactions(isActivity, activity, feed));
  }, [activity, feed, isActivity]);

  const authorName = getAuthorName(user, isActivity, activity, feed, actorName);
  const actionLabel = getActionLabel(activity, feed, t);
  const { entity, entityName } = getEventEntity(isActivity, activity, feed);
  const timestamp = getEventTimestamp(isActivity, activity, feed);
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

  // Replies load once the card is on screen, so the collapsed toggle can show
  // their count and who wrote them.
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: '200px' });
  const threadIds = { activityId: activity?.id, conversationId: feed?.id };
  const { threadId, replies, isLoading, refetch } = useActivityReplies(
    threadIds,
    inView
  );
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  // Opened with Reply rather than the toggle: focus the composer.
  const [isReplying, setIsReplying] = useState(false);
  const replyFaces = uniqBy(replies, ({ author }) => author?.name).slice(
    0,
    MAX_REPLY_FACES
  );

  const openThread = (focusComposer: boolean) => {
    setIsThreadOpen(true);
    setIsReplying(focusComposer);
  };

  const handleReply = async (message: string) => {
    try {
      await createThreadReply(message, threadIds);
      refetch();
    } catch (error) {
      // e.g. a reply on an activity whose asset was deleted is refused.
      showErrorToast(error as AxiosError);
    }
  };

  const handleReactionSelect = async (
    reactionType: ReactionType,
    operation: ReactionOperation
  ) => {
    try {
      const updated =
        isActivity && activity
          ? await toggleActivityReaction(
              activity.id,
              reactions,
              reactionType,
              operation,
              currentUser
            )
          : await toggleConversationReaction(
              feed?.id as string,
              reactions,
              reactionType,
              operation,
              currentUser
            );
      setReactions(updated);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <Box
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:pb-4 tw:shadow-xs tw:transition-colors tw:hover:border-primary"
      data-testid="activity-feed-item"
      direction="col"
      gap={4}
      ref={ref}>
      <Box className="tw:px-5 tw:pt-4" direction="col" gap={3}>
        <Box gap={3}>
          <span className="tw:relative tw:h-10 tw:shrink-0">
            <ProfilePicture
              matchRingToFill
              displayName={authorName}
              name={actorName}
              width="40"
            />
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
                size="text-md">
                <span className="tw:font-semibold tw:text-primary">
                  {authorName}
                </span>{' '}
                {actionLabel}
              </Typography>
              <CardMeta
                isMentioned={isMentioned}
                timeFormat={timeFormat}
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
                      className="tw:font-semibold tw:text-primary tw:underline tw:decoration-border-primary tw:underline-offset-3 tw:hover:text-brand-secondary"
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
          <Button
            aria-pressed={isLiked}
            className={classNames({
              'tw:text-brand-secondary tw:*:data-icon:text-fg-brand-secondary':
                isLiked,
            })}
            color="tertiary"
            data-testid="activity-like"
            iconLeading={ThumbsUp}
            size="sm"
            onPress={() =>
              handleReactionSelect(
                ReactionType.ThumbsUp,
                isLiked ? ReactionOperation.REMOVE : ReactionOperation.ADD
              )
            }>
            {likes.length
              ? `${t('label.like')} · ${likes.length}`
              : t('label.like')}
          </Button>
          <Reactions
            key={otherReactions
              .map(
                (reaction) => `${reaction.reactionType}:${reaction.user?.id}`
              )
              .join('|')}
            reactions={otherReactions}
            onReactionSelect={handleReactionSelect}
          />
          <Button
            color="tertiary"
            data-testid="activity-reply"
            iconLeading={MessageCircle01}
            size="sm"
            onPress={() => openThread(true)}>
            {t('label.reply')}
          </Button>
          {replies.length > 0 && (
            <Button
              aria-expanded={isThreadOpen}
              className={classNames({
                'tw:bg-brand-primary tw:text-brand-secondary': isThreadOpen,
              })}
              color="tertiary"
              data-testid="activity-replies-toggle"
              iconLeading={
                <span className="tw:flex tw:items-center tw:-space-x-1">
                  {replyFaces.map(({ id, author }) => (
                    <ProfilePicture
                      displayName={author?.displayName}
                      key={id}
                      name={author?.name ?? ''}
                      width="20"
                    />
                  ))}
                </span>
              }
              iconTrailing={isThreadOpen ? ChevronUp : ChevronDown}
              size="sm"
              onPress={() =>
                isThreadOpen ? setIsThreadOpen(false) : openThread(false)
              }>
              {getRepliesToggleLabel(isThreadOpen, replies.length, t)}
            </Button>
          )}
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
