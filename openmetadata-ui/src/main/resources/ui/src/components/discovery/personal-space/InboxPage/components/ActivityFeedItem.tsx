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
  BadgeWithIcon,
  Box,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { MessageDotsCircle } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import Reactions from '../../../../../components/ActivityFeed/Reactions/Reactions';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { ReactionOperation } from '../../../../../enums/reactions.enum';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { Thread } from '../../../../../generated/entity/feed/thread';
import { Reaction, ReactionType } from '../../../../../generated/type/reaction';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../../../hooks/user-profile/useUserProfile';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getFrontEndFormat } from '../../../../../utils/FeedUtilsPure';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import searchClassBase from '../../../../../utils/SearchClassBase';
import {
  formatActivityTime,
  getActivityActionLabel,
  getActivityEventLabel,
  getChatConversationTitle,
  isChatCollaboratorThread,
  toggleActivityReaction,
  toggleThreadReaction,
} from '../inbox.utils';
import './activity-feed-item.less';

export interface ActivityFeedItemSelection {
  activity?: ActivityEvent;
  feed?: Thread;
}

export interface ActivityFeedItemProps {
  // Exactly one of `activity` (2.0 event) or `feed` (conversation fallback).
  activity?: ActivityEvent;
  feed?: Thread;
  isActive?: boolean;
  onClick: (selection: ActivityFeedItemSelection) => void;
}

/**
 * A single Inbox card: actor + action + entity chip, the message body, and a
 * footer with reactions (plus a comment affordance for conversations —
 * change-event activities are read-only). Renders either a 2.0 activity event
 * or a conversation thread. Clicking opens the detail drawer, except on a
 * collaborator invite, which opens the conversation it invites you to.
 */
const ActivityFeedItem: React.FC<ActivityFeedItemProps> = ({
  activity,
  feed,
  isActive,
  onClick,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const isActivity = Boolean(activity);

  const actorName = isActivity
    ? activity?.actor?.name ?? ''
    : feed?.createdBy ?? '';
  const [, , user] = useUserProfile({ permission: false, name: actorName });

  const sourceReactions = ((isActivity
    ? activity?.reactions
    : feed?.reactions) ?? []) as Reaction[];
  const [reactions, setReactions] = useState<Reaction[]>(sourceReactions);

  useEffect(() => {
    setReactions(
      ((isActivity ? activity?.reactions : feed?.reactions) ?? []) as Reaction[]
    );
  }, [activity?.reactions, feed?.reactions, isActivity]);

  // `entityRef` resolves to the invitee's user record, not the conversation, so
  // the chip takes its title and icon from the thread instead.
  const isConversationThread =
    !isActivity && !!feed && isChatCollaboratorThread(feed);

  const authorName =
    getEntityName(user) ||
    (isActivity ? activity?.actor?.displayName : undefined) ||
    actorName;
  const actionLabel = activity
    ? getActivityEventLabel(activity, t)
    : feed
    ? getActivityActionLabel(feed, t)
    : '';
  const entity = isActivity ? activity?.entity : feed?.entityRef;
  const entityName = isConversationThread
    ? getChatConversationTitle(feed as Thread) ?? t('label.conversation')
    : entity?.displayName || entity?.name || entity?.type;
  const timestamp = isActivity
    ? activity?.timestamp
    : feed?.threadTs ?? feed?.updatedAt;
  const commentCount = feed?.postsCount ?? feed?.posts?.length ?? 0;

  const message = useMemo(
    () =>
      getFrontEndFormat(
        isActivity ? activity?.summary ?? '' : feed?.message ?? ''
      ),
    [isActivity, activity?.summary, feed?.message]
  );

  // A collaborator invite is about the conversation it grants access to, so it
  // opens there; every other card opens the detail drawer.
  const handleActivate = useCallback(() => {
    if (isConversationThread && feed?.entityUrlLink) {
      navigate(feed.entityUrlLink);
    } else {
      onClick(isActivity ? { activity } : { feed });
    }
  }, [isConversationThread, feed, activity, isActivity, navigate, onClick]);

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
          : await toggleThreadReaction(
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
      className={`tw:group tw:relative tw:cursor-pointer tw:rounded-xl tw:px-2 tw:py-3 tw:transition ${
        isActive ? 'tw:bg-utility-brand-50' : 'tw:hover:bg-utility-gray-blue-50'
      }`}
      data-testid="activity-feed-item"
      direction="col"
      gap={2}
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}>
      <Box align="center" className="tw:justify-between tw:gap-2">
        <Box
          align="center"
          className="tw:relative tw:z-[3] tw:flex-wrap"
          gap={2}>
          <ProfilePicture
            displayName={authorName}
            name={actorName}
            width="28"
          />
          <Typography
            className="tw:text-primary-900"
            size="text-sm"
            weight="medium">
            {authorName}
          </Typography>
          <Typography className="tw:text-primary-900" size="text-sm">
            {actionLabel}
          </Typography>
          {entityName && (
            <Badge className="tw:shrink-0 tw:gap-1" size="sm" type="modern">
              {isConversationThread ? (
                <span className="tw:flex tw:items-center tw:gap-2">
                  <span className="tw:flex tw:items-center">
                    <MessageDotsCircle className="tw:size-4" />
                  </span>
                </span>
              ) : (
                entity?.type && (
                  <span className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:flex tw:items-center tw:[&_img]:size-4 tw:[&_svg]:size-4">
                      {searchClassBase.getEntityIcon(entity.type)}
                    </span>
                  </span>
                )
              )}
              <Typography
                className="tw:text-secondary"
                size="text-xs"
                weight="semibold">
                {entityName}
              </Typography>
            </Badge>
          )}
        </Box>
        <Typography
          className="tw:text-text-secondary tw:whitespace-nowrap"
          size="text-sm">
          {formatActivityTime(timestamp)}
        </Typography>
      </Box>

      <Card
        className={classNames(
          'tw:ml-10 tw:bg-utility-gray-blue-50 tw:border-utility-gray-blue-100 tw:border-[0.6px] tw:px-4 tw:py-3 tw:transition-colors tw:group-hover:bg-white',
          {
            'tw:bg-active': isActive,
          }
        )}>
        <RichTextEditorPreviewerV1
          className="inbox-feed-message tw:text-sm"
          markdown={message}
        />
      </Card>

      <Box
        align="center"
        className="inbox-feed-actions tw:ml-10 tw:gap-2"
        onClick={(e) => e.stopPropagation()}>
        <Reactions
          key={reactions
            .map((reaction) => `${reaction.reactionType}:${reaction.user?.id}`)
            .join('|')}
          reactions={reactions}
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

export default ActivityFeedItem;
