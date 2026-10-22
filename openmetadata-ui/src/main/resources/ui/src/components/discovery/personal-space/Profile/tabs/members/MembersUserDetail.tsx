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

import { Box } from '@openmetadata/ui-core-components';
import { User01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, Key, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../../enums/entity.enum';
import { User } from '../../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { restoreUser } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import TaskDetailPage from '../../../InboxPage/components/TaskDetailPage';
import ActivityTab from '../../../InboxPage/tabs/ActivityTab';
import TasksTab from '../../../InboxPage/tabs/TasksTab';
import UserAssetsView from '../../../UserAssets/UserAssetsView';
import UserCustomPropertiesTable from '../../customProperties/UserCustomPropertiesTable';
import { useUserCustomPropertyAccess } from '../../customProperties/useUserCustomPropertyAccess';
import ProfileDetailsPanel from '../../ProfileDetailsPanel';
import { useUserProfile } from '../../useUserProfile';
import PermissionsTab from '../PermissionsTab';
import type { MembersUserDetailProps, UserDetailTab } from './Members.types';
import { getHiddenUserDetailTabs } from './Members.utils';
import MembersUserDetailBanners from './MembersUserDetailBanners';
import MembersUserDetailSkeleton from './MembersUserDetailSkeleton';
import { useMembersUserDetailHeader } from './useMembersUserDetailHeader';

interface UserDetailTabContentProps {
  user: User;
  tab: UserDetailTab;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  onOpenTask: (taskId: string) => void;
}

const SCROLLING_TABS: ReadonlySet<UserDetailTab> = new Set([
  'activity',
  'tasks',
  'owned-assets',
  'following',
]);

// List tabs scroll inside a bounded body; the rest grow so the panel scrolls
// and the bottom padding stays below the content.
const detailBodyClass = (tab: UserDetailTab) =>
  classNames(
    'tw:px-8 tw:pb-8',
    SCROLLING_TABS.has(tab) ? 'tw:min-h-0 tw:flex-1' : 'tw:shrink-0'
  );

const UserDetailTabContent: FC<UserDetailTabContentProps> = ({
  user,
  tab,
  isProfileLoading,
  updateUserDetails,
  onOpenTask,
}) => {
  switch (tab) {
    case 'access':
      return (
        <PermissionsTab updateUserDetails={updateUserDetails} userData={user} />
      );
    case 'activity':
      return <ActivityTab user={user} />;
    case 'tasks':
      return <TasksTab user={user} onOpenTask={onOpenTask} />;
    case 'owned-assets':
      return <UserAssetsView kind="owned" user={user} />;
    case 'following':
      return <UserAssetsView kind="following" user={user} />;
    case 'custom-properties':
      return (
        <UserCustomPropertiesTable user={user} onUpdate={updateUserDetails} />
      );
    default:
      return (
        <ProfileDetailsPanel
          isProfileLoading={isProfileLoading}
          updateUserDetails={updateUserDetails}
          userData={user}
        />
      );
  }
};

/**
 * A member's detail inside Settings › Members › Users: the shared profile
 * panels for Overview/Access plus the user-scoped Activity, Tasks and asset
 * lists. Tab and open task live in the hash so deep links and back work.
 */
const MembersUserDetail: FC<MembersUserDetailProps> = ({
  view,
  onNavigate,
  onSetHeader,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const {
    userData,
    isProfileLoading,
    isUserNotFound,
    updateUserDetails,
    refetch,
  } = useUserProfile(view.name);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // Legacy parity: admins manage every entry, their own included.
  const canManage = Boolean(isAdminUser);
  const customPropertyAccess = useUserCustomPropertyAccess(userData);
  const canViewAccess = canManage || view.name === currentUser?.name;
  const hiddenTabs = useMemo(
    () =>
      getHiddenUserDetailTabs({
        isBot: userData?.isBot,
        canViewAccess,
        canViewCustomProperties: customPropertyAccess.canView,
      }),
    [userData?.isBot, canViewAccess, customPropertyAccess.canView]
  );
  // A stale link to a hidden tab lands on Overview, but not while custom
  // property access is still resolving.
  const isTabPending =
    view.tab === 'custom-properties' && customPropertyAccess.isLoading;
  const activeTab: UserDetailTab =
    hiddenTabs.has(view.tab) && !isTabPending ? 'overview' : view.tab;

  const navigateTo = useCallback(
    (tab: UserDetailTab, taskId?: string) =>
      onNavigate({ type: 'user-detail', name: view.name, tab, taskId }),
    [onNavigate, view.name]
  );
  const handleTabChange = useCallback(
    (key: Key) => navigateTo(key as UserDetailTab),
    [navigateTo]
  );

  const handleRestore = useCallback(async () => {
    if (!userData) {
      return;
    }
    try {
      await restoreUser(userData.id);
      showSuccessToast(
        t('message.entity-restored-success', {
          entity: getEntityName(userData),
        })
      );
      void refetch();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [userData, t, refetch]);

  const openDelete = useCallback(() => setIsDeleteOpen(true), []);

  useMembersUserDetailHeader({
    user: userData,
    isUserNotFound,
    view,
    activeTab,
    canManage,
    hiddenTabs,
    onTabChange: handleTabChange,
    onDelete: openDelete,
    onSetHeader,
  });

  if (!userData) {
    return isUserNotFound ? (
      <Box className="tw:relative tw:flex-1">
        <NoDataPlaceholder
          icon={User01}
          title={t('label.no-entity-found', { entity: t('label.user') })}
        />
      </Box>
    ) : (
      <MembersUserDetailSkeleton />
    );
  }

  if (view.taskId) {
    return (
      <Box className="tw:min-h-0 tw:flex-1" direction="col">
        <TaskDetailPage
          taskId={view.taskId}
          onBack={() => navigateTo('tasks')}
        />
      </Box>
    );
  }

  return (
    <Box
      className={detailBodyClass(activeTab)}
      data-testid="members-user-detail"
      direction="col"
      gap={7}>
      <MembersUserDetailBanners
        activeTab={activeTab}
        canManage={canManage}
        user={userData}
        onRestore={handleRestore}
      />
      <UserDetailTabContent
        isProfileLoading={isProfileLoading}
        tab={activeTab}
        updateUserDetails={updateUserDetails}
        user={userData}
        onOpenTask={(taskId) => navigateTo('tasks', taskId)}
      />
      {isDeleteOpen && (
        <DeleteEntityModal
          isRecursiveDelete
          visible
          afterDeleteAction={(isSoftDelete) =>
            isSoftDelete ? void refetch() : onNavigate({ type: 'users' })
          }
          allowSoftDelete={!userData.deleted}
          entityId={userData.id}
          entityName={getEntityName(userData)}
          entityType={EntityType.USER}
          onCancel={() => setIsDeleteOpen(false)}
        />
      )}
    </Box>
  );
};

export default MembersUserDetail;
