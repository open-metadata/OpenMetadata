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
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import { User } from '../../../../generated/entity/teams/user';
import { useAuth } from '../../../../hooks/authHooks';
import { useProfileCopy } from '../../../../hooks/discovery/personal-space/useUserProfile';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getVisibleEmail } from '../../../../utils/UsersPureUtils';
import ChangePasswordRow from './components/ChangePasswordRow';
import DefaultPersonaRow from './components/DefaultPersonaRow';
import DomainsRow from './components/DomainsRow';
import PersonaRow from './components/PersonaRow';
import PreferredNameRow from './components/PreferredNameRow';
import RowSkeleton from './components/RowSkeleton';
import SettingsSection, { ReadOnlyRow } from './components/SettingsSection';
import UserDescriptionRow from './components/UserDescriptionRow';
import UserCustomPropertiesSection from './customProperties/UserCustomPropertiesSection';
import { canUserChangePassword } from './ProfileDetailsPanel.utils';

interface ProfileDetailsPanelProps {
  userData: User;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  /** Only your own Profile tab lists custom properties; the user detail has a tab. */
  showCustomProperties?: boolean;
  /**
   * EditAll on the viewed user (already false for a deleted one). Omitted on
   * your own Profile, where each row falls back to its own admin/self rule.
   */
  canEditAll?: boolean;
}

/**
 * Content for the `profile` nav item: a PROFILE section (photo, preferred name,
 * email) and an IDENTITY & ACCESS section (persona, default persona, domains,
 * teams, roles, inherited roles). Editing is permission-guarded per row.
 */
const ProfileDetailsPanel: React.FC<ProfileDetailsPanelProps> = ({
  userData,
  isProfileLoading,
  updateUserDetails,
  showCustomProperties,
  canEditAll,
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);
  const { isAdminUser } = useAuth();
  const { currentUser, authConfig } = useApplicationStore();
  const displayName = getEntityName(userData);
  const isSelf = currentUser?.name === userData.name;
  // You edit your own name and description; anyone else needs EditAll on you.
  const canEditSelfFields =
    Boolean(canEditAll) || (isSelf && !userData.deleted);
  const canChangePassword = canUserChangePassword({
    provider: authConfig?.provider,
    isSelf,
    isAdmin: isAdminUser,
    isDeleted: userData.deleted,
    isBot: userData.isBot,
  });
  const visibleEmail = getVisibleEmail(userData.email);

  return (
    <Box data-testid="profile-details-panel" direction="col" gap={6}>
      <SettingsSection
        testId="profile-section-profile"
        title={t('label.profile')}>
        <ReadOnlyRow
          description={copy(
            'message.photo-description',
            'message.photo-description-of-user'
          )}
          title={t('label.photo')}>
          <ProfilePicture
            displayName={displayName}
            name={userData.name}
            width="42"
          />
        </ReadOnlyRow>

        <PreferredNameRow
          canEdit={canEditSelfFields}
          description={copy(
            'message.preferred-name-description',
            'message.preferred-name-description-of-user'
          )}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />

        <UserDescriptionRow
          canEdit={canEditSelfFields}
          updateUserDetails={updateUserDetails}
          userData={userData}
        />

        <ReadOnlyRow
          description={t('message.email-description')}
          title={t('label.email')}>
          <Box gap={2}>
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="regular">
              {visibleEmail}
            </Typography>
            {visibleEmail && (
              <BadgeWithIcon
                color="success"
                iconLeading={Check}
                size="xs"
                type="pill-color">
                {t('label.verified-status')}
              </BadgeWithIcon>
            )}
          </Box>
        </ReadOnlyRow>
      </SettingsSection>

      {canChangePassword && (
        <SettingsSection
          testId="profile-section-security"
          title={t('label.security')}>
          <ChangePasswordRow isSelf={isSelf} username={userData.name} />
        </SettingsSection>
      )}

      <SettingsSection
        testId="profile-section-identity"
        title={t('label.identity-and-access')}>
        {isProfileLoading ? (
          <RowSkeleton />
        ) : (
          <PersonaRow
            canEdit={canEditAll}
            updateUserDetails={updateUserDetails}
            userData={userData}
          />
        )}
        {isProfileLoading ? (
          <RowSkeleton />
        ) : (
          <DefaultPersonaRow
            updateUserDetails={updateUserDetails}
            userData={userData}
          />
        )}
        {/* No canEdit override: the server lets only admins change a user's
            domains (ADR:2026-10-21-only-admins-change-a-users-domains), which is
            the row's own default. */}
        {isProfileLoading ? (
          <RowSkeleton chips={1} />
        ) : (
          <DomainsRow
            updateUserDetails={updateUserDetails}
            userData={userData}
          />
        )}
      </SettingsSection>

      {/* Until the full profile lands userData lacks `extension`, and a save
          would replace every other value. */}
      {showCustomProperties && !isProfileLoading && (
        <UserCustomPropertiesSection
          user={userData}
          onUpdate={updateUserDetails}
        />
      )}
    </Box>
  );
};

export default ProfileDetailsPanel;
