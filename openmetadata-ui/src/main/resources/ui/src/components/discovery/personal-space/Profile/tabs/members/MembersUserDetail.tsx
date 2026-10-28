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
import { FC, Key, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../../enums/entity.enum';
import { useUserProfile } from '../../../../../../hooks/discovery/personal-space/useUserProfile';
import { restoreUser } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../../../common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import TaskDetailPage from '../../../InboxPage/components/TaskDetailPage';
import { SCROLLING_USER_DETAIL_TABS } from './Members.constants';
import type { MembersUserDetailProps, UserDetailTab } from './Members.types';
import MembersUserDetailBanners from './MembersUserDetailBanners';
import MembersUserDetailSkeleton from './MembersUserDetailSkeleton';
import { useMembersUserDetailAccess } from './useMembersUserDetailAccess';
import { useMembersUserDetailHeader } from './useMembersUserDetailHeader';
import UserDetailTabContent from './UserDetailTabContent';

const PLACEHOLDER_HOST_CLASS = 'tw:relative tw:min-h-90 tw:flex-1';

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
  const {
    userData,
    isProfileLoading,
    isUserNotFound,
    loadError,
    updateUserDetails,
    refetch,
  } = useUserProfile(view.name);
  const {
    canEditAll,
    canDelete,
    canRestore,
    isNoAccess,
    hiddenTabs,
    activeTab,
  } = useMembersUserDetailAccess(view, userData);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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
    hasLoadFailed: isUserNotFound || loadError || isNoAccess,
    view,
    activeTab,
    canDelete,
    hiddenTabs,
    onTabChange: handleTabChange,
    onDelete: openDelete,
    onSetHeader,
  });

  if (isUserNotFound) {
    return (
      <Box className={PLACEHOLDER_HOST_CLASS}>
        <NoDataPlaceholder
          icon={User01}
          title={t('label.no-entity-found', { entity: t('label.user') })}
        />
      </Box>
    );
  }

  // A 403/5xx/network failure; for yourself userData is still the partial
  // store copy, which must not be edited.
  if (loadError) {
    return (
      <Box className={PLACEHOLDER_HOST_CLASS}>
        <SomethingWentWrongPlaceholder
          data-testid="user-load-error"
          onReload={refetch}
        />
      </Box>
    );
  }

  if (!userData) {
    return <MembersUserDetailSkeleton />;
  }

  if (isNoAccess) {
    return (
      <Box className={PLACEHOLDER_HOST_CLASS} data-testid="user-no-access">
        <PermissionPlaceholder permissionValue={t('label.user')} />
      </Box>
    );
  }

  if (view.taskId) {
    return (
      <Box className="tw:min-h-0 tw:flex-1" direction="col">
        <TaskDetailPage taskId={view.taskId} />
      </Box>
    );
  }

  return (
    <Box
      className={classNames(
        'tw:px-8 tw:pb-8',
        SCROLLING_USER_DETAIL_TABS.has(activeTab)
          ? 'tw:min-h-0 tw:flex-1'
          : 'tw:shrink-0'
      )}
      data-testid="members-user-detail"
      direction="col"
      gap={7}>
      <MembersUserDetailBanners
        activeTab={activeTab}
        canRestore={canRestore}
        user={userData}
        onRestore={handleRestore}
      />
      <UserDetailTabContent
        canEditAll={canEditAll}
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
