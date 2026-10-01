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
  BadgeWithIcon,
  Box,
  Button,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit05,
  File02,
  Globe01,
  MessageDotsCircle,
  Plus,
  RefreshCcw01,
  Tag01,
  ThumbsUp,
  Trash01,
  UserCheck01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { formatDateTime } from '../../../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../../../utils/EntityLink';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import { getFrontEndFormat } from '../../../../../utils/FeedUtilsPure';
import searchClassBase from '../../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import {
  formatActivityTime,
  getActivityChange,
  getActivityEventLabel,
  toggleActivityReaction,
  toggleConversationReaction,
} from '../inbox.utils';
import './activity-feed-item.less';
import ActivityChangePanel from './ActivityChangePanel';

export interface ActivityFeedItemSelection {
  activity?: ActivityEvent;
  feed?: Conversation;
}

export interface ActivityFeedItemProps {
  // Exactly one of `activity` (2.0 event) or `feed` (conversation fallback).
  activity?: ActivityEvent;
  feed?: Conversation;
  isActive?: boolean;
  onClick: (selection: ActivityFeedItemSelection) => void;
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
    return t('label.posted-on');
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

interface ActivityKind {
  icon: typeof Tag01;
  className: string;
}

const TAGS_KIND = { icon: Tag01, className: 'tw:bg-utility-purple-600' };
const DESCRIPTION_KIND = { icon: File02, className: 'tw:bg-utility-blue-600' };
const DELETED_KIND = { icon: Trash01, className: 'tw:bg-utility-error-600' };
const DEFAULT_KIND = { icon: Edit05, className: 'tw:bg-utility-gray-600' };
const CONVERSATION_KIND = {
  icon: MessageDotsCircle,
  className: 'tw:bg-utility-gray-600',
};

// The badge on the actor's avatar that says what kind of change this is.
const ACTIVITY_KIND: Partial<Record<ActivityEventType, ActivityKind>> = {
  [ActivityEventType.TagsUpdated]: TAGS_KIND,
  [ActivityEventType.ColumnTagsUpdated]: TAGS_KIND,
  [ActivityEventType.DescriptionUpdated]: DESCRIPTION_KIND,
  [ActivityEventType.ColumnDescriptionUpdated]: DESCRIPTION_KIND,
  [ActivityEventType.OwnerUpdated]: {
    icon: UserCheck01,
    className: 'tw:bg-utility-indigo-600',
  },
  [ActivityEventType.DomainUpdated]: {
    icon: Globe01,
    className: 'tw:bg-utility-blue-light-600',
  },
  [ActivityEventType.EntityCreated]: {
    icon: Plus,
    className: 'tw:bg-utility-success-600',
  },
  [ActivityEventType.EntityRestored]: {
    icon: RefreshCcw01,
    className: 'tw:bg-utility-success-600',
  },
  [ActivityEventType.EntityDeleted]: DELETED_KIND,
  [ActivityEventType.EntitySoftDeleted]: DELETED_KIND,
};

const getActivityKind = (activity?: ActivityEvent): ActivityKind =>
  activity
    ? ACTIVITY_KIND[activity.eventType] ?? DEFAULT_KIND
    : CONVERSATION_KIND;

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
const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  feed,
  isActive,
  onClick,
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
  const commentCount = feed?.replyCount ?? 0;
  const { icon: KindIcon, className: kindClassName } =
    getActivityKind(activity);
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

  const handleActivate = useCallback(() => {
    onClick(isActivity ? { activity } : { feed });
  }, [feed, activity, isActivity, onClick]);

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
      className={classNames(
        'tw:cursor-pointer tw:rounded-xl tw:border tw:bg-primary tw:px-5 tw:py-4 tw:shadow-xs tw:transition-colors',
        isActive
          ? 'tw:border-brand'
          : 'tw:border-secondary tw:hover:border-primary'
      )}
      data-testid="activity-feed-item"
      direction="col"
      gap={3}
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        // Keys pressed on the asset link or a reaction are theirs, not the card's.
        if (
          e.target === e.currentTarget &&
          (e.key === 'Enter' || e.key === ' ')
        ) {
          e.preventDefault();
          handleActivate();
        }
      }}>
      <Box gap={3}>
        <span className="tw:relative tw:h-10 tw:shrink-0">
          <ProfilePicture
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
            <Tooltip title={formatDateTime(timestamp)}>
              <TooltipTrigger className="tw:shrink-0 tw:whitespace-nowrap tw:text-sm tw:text-quaternary">
                {formatActivityTime(timestamp)}
              </TooltipTrigger>
            </Tooltip>
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
                    to={target.path}
                    onClick={(e) => e.stopPropagation()}>
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

      <Box
        align="center"
        className="inbox-feed-actions tw:ml-13 tw:gap-2"
        onClick={(e) => e.stopPropagation()}>
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
            .map((reaction) => `${reaction.reactionType}:${reaction.user?.id}`)
            .join('|')}
          reactions={otherReactions}
          onReactionSelect={handleReactionSelect}
        />
        {/* Change-event activities are read-only (no comments) — the
            affordance renders for conversations only. */}
        {!isActivity && (
          <button
            className="tw:cursor-pointer tw:border-none tw:bg-transparent tw:p-0"
            type="button"
            onClick={handleActivate}>
            <BadgeWithIcon
              color="gray"
              iconLeading={MessageDotsCircle}
              size="sm"
              type="modern">
              {`${commentCount} ${t('label.comment-plural')}`}
            </BadgeWithIcon>
          </button>
        )}
      </Box>
    </Box>
  );
};

// Selecting a card re-renders the tab; only the card whose isActive changed
// needs to render again, not every card and its markdown.
export default React.memo(ActivityFeedItem);
