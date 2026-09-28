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

import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import {
  Conversation,
  ConversationReply,
} from '../../../../../generated/entity/feed/conversation';
import { Access } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import { useUserProfile } from '../../../../../hooks/user-profile/useUserProfile';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getActivityEventLabel, getFeedTimestamp } from '../inbox.utils';
import {
  CommentRowDerivedState,
  TFunc,
} from './ActivityDetailDrawer.interface';

export const getCommentRowDerivedState = (
  reply: ConversationReply,
  currentUser: { name?: string; isAdmin?: boolean } | undefined,
  deleteAccess: Access | undefined,
  user: ReturnType<typeof useUserProfile>[2]
): CommentRowDerivedState => {
  const authorLogin = reply.author?.name ?? '';
  const authorName =
    getEntityName(user) || reply.author?.displayName || authorLogin;

  const isAuthor =
    Boolean(currentUser?.name) && authorLogin === currentUser?.name;
  const isAdmin = Boolean(currentUser?.isAdmin);
  // Admins bypass policy evaluation server-side. ConditionalAllow → author
  // only: exact for the default isOwner() rule; an approximation for other
  // conditional rules, since the blanket permissions endpoint never evaluates
  // conditions (see useFeedDeleteAccess). The backend re-authorizes on click.
  const canDelete =
    isAdmin ||
    deleteAccess === Access.Allow ||
    (deleteAccess === Access.ConditionalAllow && isAuthor);

  return { authorLogin, authorName, canDelete, canEdit: isAuthor };
};

export const getActorName = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  isActivity: boolean
): string =>
  isActivity ? activity?.actor?.name ?? '' : feed?.createdBy?.name ?? '';

export const getAuthorDisplayName = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  isActivity: boolean,
  actorName: string,
  author: ReturnType<typeof useUserProfile>[2]
): string =>
  getEntityName(author) ||
  (isActivity ? activity?.actor?.displayName : feed?.createdBy?.displayName) ||
  actorName;

export const getActionLabel = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  t: TFunc
): string => {
  if (activity) {
    return getActivityEventLabel(activity, t);
  }

  return feed ? t('label.posted-on') : '';
};

export const getEntityInfo = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  isActivity: boolean
) => {
  const entity = isActivity ? activity?.entity : feed?.entityRef;
  const entityName = entity?.displayName || entity?.name || entity?.type;

  return { entity, entityName };
};

export const getBodyMessage = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  isActivity: boolean
): string => (isActivity ? activity?.summary ?? '' : feed?.message ?? '');

export const getTimestamp = (
  activity: ActivityEvent | undefined,
  feed: Conversation | undefined,
  isActivity: boolean
) => (isActivity ? activity?.timestamp : feed && getFeedTimestamp(feed));
