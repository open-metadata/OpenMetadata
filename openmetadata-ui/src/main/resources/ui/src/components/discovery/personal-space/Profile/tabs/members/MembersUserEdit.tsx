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
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lock01, User01 } from '@openmetadata/ui-core-components/icons';
import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { useEditableUser } from '../../../../../../hooks/user-profile/useEditableUser';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import Loader from '../../../../../common/Loader/Loader';
import DomainsRow from '../../components/DomainsRow';
import PersonaRow from '../../components/PersonaRow';
import PreferredNameRow from '../../components/PreferredNameRow';
import RolesRow from '../../components/RolesRow';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import TeamsRow from '../../components/TeamsRow';
import UserAdminRow from '../../components/UserAdminRow';
import UserDescriptionRow from '../../components/UserDescriptionRow';

interface MembersUserEditProps {
  name: string;
  // Reports the fetched display name so the header shows it instead of the
  // raw username from the hash.
  onResolveName: (displayName: string) => void;
}

/**
 * A user's details as Profile-style cards, opened by clicking a user name in the
 * Settings modal (`#members/user/<name>`). Each card saves on its own.
 *
 * Gating mirrors the user PATCH endpoint: viewing needs view access on the user,
 * editing another user needs EditAll on them, and isAdmin/roles are admin-only.
 * Soft-deleted users come back with every edit flag off (read-only).
 */
const MembersUserEdit: FC<MembersUserEditProps> = ({ name, onResolveName }) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const { userData, isNotFound, updateUserDetails } = useEditableUser(name);
  const {
    hasViewAccess,
    canEditAll,
    isLoading: isPermissionLoading,
  } = useEntityPermissions(ResourceEntity.USER, name, {
    deleted: userData?.deleted,
    enabled: Boolean(userData),
  });

  useEffect(() => {
    if (userData) {
      onResolveName(getEntityName(userData));
    }
  }, [userData, onResolveName]);

  if (isNotFound) {
    return (
      <Box className="tw:relative tw:flex-1 tw:min-h-90">
        <EmptyPlaceholder
          data-testid="user-not-found"
          icon={User01}
          title={t('label.no-entity-found', { entity: t('label.user') })}
        />
      </Box>
    );
  }

  if (!userData || isPermissionLoading) {
    return <Loader />;
  }

  if (!hasViewAccess) {
    return (
      <Box
        className="tw:relative tw:flex-1 tw:min-h-90"
        data-testid="user-no-access">
        <EmptyPlaceholder
          icon={Lock01}
          title={t('message.no-permission-to-view')}
        />
      </Box>
    );
  }

  const canEditPrivileged = Boolean(isAdminUser) && !userData.deleted;
  // The toggle saves instantly, so an admin could lock themselves out with one
  // click; their own admin status stays read-only here.
  const canEditAdminFlag =
    canEditPrivileged && userData.name !== currentUser?.name;

  return (
    <Box
      className="tw:px-8 tw:pt-4 tw:pb-8"
      data-testid="members-user-edit"
      direction="col"
      gap={6}>
      <SettingsSection testId="user-section-profile" title={t('label.profile')}>
        <ReadOnlyRow
          description={t('message.email-description')}
          testId="user-email"
          title={t('label.email')}>
          <Typography className="tw:text-primary" size="text-sm">
            {userData.email}
          </Typography>
        </ReadOnlyRow>
        <PreferredNameRow
          canEdit={canEditAll}
          description={t('message.user-display-name-description')}
          title={t('label.display-name')}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
        <UserDescriptionRow
          canEdit={canEditAll}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
      </SettingsSection>

      <SettingsSection
        testId="user-section-access"
        title={t('label.identity-and-access')}>
        <DomainsRow
          canEdit={canEditAll}
          description={t('message.user-domain-description')}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
        <PersonaRow
          canEdit={canEditAll}
          description={t('message.user-persona-description')}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
        <UserAdminRow
          canEdit={canEditAdminFlag}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
      </SettingsSection>

      <SettingsSection
        testId="user-section-membership"
        title={t('label.membership')}>
        <TeamsRow
          canEdit={canEditAll}
          description={t('message.user-team-description')}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
        <RolesRow
          canEdit={canEditPrivileged}
          description={t('message.user-role-description')}
          showAdminRole={false}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
      </SettingsSection>
    </Box>
  );
};

export default MembersUserEdit;
