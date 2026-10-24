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
  Avatar,
  Badge,
  BadgeWithDot,
  Box,
  ButtonUtility,
  Skeleton,
  Tabs,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import type { Key, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { getTaskById } from '../../../../../../rest/tasksAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  getUserOnlineStatus,
  getVisibleEmail,
} from '../../../../../../utils/UsersPureUtils';
import { TASK_ID_PREFIX } from '../../../../../MyData/Widgets/MyTasksWidget/MyTasksWidget.constants';
import { useUserActivityCount } from '../../../InboxPage/useInboxActivity';
import { useUserOpenTaskCount } from '../../../InboxPage/useUserTasks';
import { useUserAssetCount } from '../../../UserAssets/useUserAssetCount';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import {
  USER_DETAIL_TABS,
  USER_DETAIL_TAB_LABEL_KEYS,
} from './Members.constants';
import type {
  MembersUserDetailProps,
  MembersUserDetailView,
  UserDetailTab,
} from './Members.types';
import { buildMembersHeaderMaps } from './Members.utils';

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>
) => string;
type TabCounts = Partial<Record<UserDetailTab, number>>;

const buildLoadingHeader = (): Partial<ProfileHeaderOverride> => ({
  iconNode: <Skeleton height={44} variant="circular" width={44} />,
  titleInput: <Skeleton height={18} variant="rounded" width={220} />,
  description: '',
  meta: <Skeleton height={12} variant="rounded" width={320} />,
  tabs: (
    <Box align="center" className="tw:h-10" gap={7}>
      {USER_DETAIL_TABS.map((key) => (
        <Skeleton height={12} key={key} variant="rounded" width={64} />
      ))}
    </Box>
  ),
});

const buildStatusBadges = (
  t: TranslateFn,
  user: User,
  isSelf: boolean
): ReactNode => {
  const onlineStatus = getUserOnlineStatus(user);

  return (
    <Box align="center" className="tw:ml-1" gap={2}>
      {isSelf && (
        <Badge
          color="gray"
          data-testid="user-you-badge"
          size="sm"
          type="pill-color">
          {t('label.you')}
        </Badge>
      )}
      {user.isAdmin && !user.isBot && (
        <Badge color="brand" size="sm" type="pill-color">
          {t('label.admin')}
        </Badge>
      )}
      {user.isBot && (
        <Badge color="gray-blue" size="sm" type="pill-color">
          {t('label.bot')}
        </Badge>
      )}
      {user.deleted && (
        <Badge
          color="error"
          data-testid="user-deleted-badge"
          size="sm"
          type="pill-color">
          {t('label.deleted')}
        </Badge>
      )}
      {onlineStatus && (
        <span data-testid="user-online-status">
          <BadgeWithDot color="success" size="sm">
            {onlineStatus.text}
          </BadgeWithDot>
        </span>
      )}
    </Box>
  );
};

// Legacy parity: soft and hard delete share one entry point (the modal offers
// both); a deleted user can only be purged, since Restore lives in its banner.
const buildDeleteAction = (
  t: TranslateFn,
  user: User,
  onDelete: () => void
): ReactNode => {
  const label = user.deleted
    ? t('label.delete-permanently')
    : t('label.delete');

  return (
    <ButtonUtility
      aria-label={label}
      color="tertiary"
      data-testid={
        user.deleted
          ? 'user-detail-delete-permanently-button'
          : 'user-detail-delete-button'
      }
      icon={Trash01}
      size="sm"
      tooltip={label}
      onClick={onDelete}
    />
  );
};

const buildTabs = (
  t: TranslateFn,
  activeTab: UserDetailTab,
  counts: TabCounts,
  hiddenTabs: ReadonlySet<UserDetailTab>,
  onTabChange: (key: Key) => void
): ReactNode => (
  <Tabs
    data-testid="user-detail-tabs"
    selectedKey={activeTab}
    onSelectionChange={onTabChange}>
    <Tabs.List size="sm" type="underline">
      {USER_DETAIL_TABS.filter((tab) => !hiddenTabs.has(tab)).map((id) => (
        // A zero count is hidden, as in the design.
        <Tabs.Item
          badge={counts[id] || undefined}
          data-testid={`user-detail-tab-${id}`}
          id={id}
          key={id}>
          {t(USER_DETAIL_TAB_LABEL_KEYS[id])}
        </Tabs.Item>
      ))}
    </Tabs.List>
  </Tabs>
);

/**
 * The avatar, name, status badges and `@username · email` line shared by the
 * user-detail header and your own Profile header. A masked email is left out.
 */
export const buildUserIdentityHeader = (
  t: TranslateFn,
  user: User,
  isSelf: boolean
): Partial<ProfileHeaderOverride> => {
  const displayName = getEntityName(user);
  const email = getVisibleEmail(user.email);

  return {
    title: displayName,
    titleSuffix: buildStatusBadges(t, user, isSelf),
    description: [`@${user.name}`, email].filter(Boolean).join(' · '),
    iconNode: (
      <Avatar
        alt={displayName}
        data-testid="user-detail-avatar"
        initials={displayName.charAt(0).toUpperCase()}
        size="lg"
        src={user.profile?.images?.image512}
      />
    ),
  };
};

// The task list opens a task by its UUID; the breadcrumb shows its readable
// `TASK-00170` id, so resolve it unless the hash already carries one.
const useTaskCrumbLabel = (taskId?: string): string | undefined => {
  const isReadableId = Boolean(taskId?.startsWith(TASK_ID_PREFIX));
  const { data } = useQuery({
    queryKey: ['members-user-detail-task-label', taskId],
    queryFn: async () => (await getTaskById(taskId ?? '')).data.taskId,
    enabled: Boolean(taskId) && !isReadableId,
    staleTime: Infinity,
  });

  return isReadableId ? taskId : data ?? taskId;
};

interface UseMembersUserDetailHeaderParams {
  user?: User;
  /** Not found, failed to load, or not viewable: the header shows just the name. */
  hasLoadFailed: boolean;
  view: MembersUserDetailView;
  activeTab: UserDetailTab;
  canDelete: boolean;
  hiddenTabs: ReadonlySet<UserDetailTab>;
  onTabChange: (key: Key) => void;
  onDelete: () => void;
  onSetHeader: MembersUserDetailProps['onSetHeader'];
}

/**
 * Pushes the user-detail header slots (avatar, name, status badges, delete and
 * the counted tab strip) up to MembersPanel. A task page collapses the header to
 * its breadcrumbs, since the task draws its own title row.
 */
export const useMembersUserDetailHeader = ({
  user,
  hasLoadFailed,
  view,
  activeTab,
  canDelete,
  hiddenTabs,
  onTabChange,
  onDelete,
  onSetHeader,
}: UseMembersUserDetailHeaderParams) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isSelf = Boolean(user && user.name === currentUser?.name);
  const taskLabel = useTaskCrumbLabel(view.taskId);
  const activityCount = useUserActivityCount(user?.id);
  const openTaskCount = useUserOpenTaskCount(user);
  const ownedCount = useUserAssetCount(user, 'owned');
  const followingCount = useUserAssetCount(user, 'following');

  const counts = useMemo<TabCounts>(
    () => ({
      activity: activityCount,
      tasks: openTaskCount,
      'owned-assets': ownedCount,
      following: followingCount,
    }),
    [activityCount, openTaskCount, ownedCount, followingCount]
  );

  useEffect(() => {
    if (hasLoadFailed || !user) {
      onSetHeader(hasLoadFailed ? { title: view.name } : buildLoadingHeader());

      return;
    }
    if (view.taskId) {
      onSetHeader({
        compact: true,
        breadcrumbs: buildMembersHeaderMaps(
          { ...view, taskId: taskLabel },
          t,
          ''
        ).crumbsByType['user-detail'],
      });

      return;
    }
    onSetHeader({
      ...buildUserIdentityHeader(t, user, isSelf),
      actions: canDelete ? buildDeleteAction(t, user, onDelete) : undefined,
      tabs: buildTabs(t, activeTab, counts, hiddenTabs, onTabChange),
    });
  }, [
    user,
    isSelf,
    hasLoadFailed,
    view,
    taskLabel,
    activeTab,
    counts,
    canDelete,
    hiddenTabs,
    onTabChange,
    onDelete,
    onSetHeader,
    t,
  ]);

  // Drop this user's header slots when leaving the view.
  useEffect(() => () => onSetHeader(undefined), [onSetHeader]);
};
