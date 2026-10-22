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
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check } from '@openmetadata/ui-core-components/icons';
import startCase from 'lodash/startCase';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import { User } from '../../../../generated/entity/teams/user';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { isMaskedEmail } from '../../../../utils/UsersPureUtils';
import ChangePasswordRow from './components/ChangePasswordRow';
import DefaultPersonaRow from './components/DefaultPersonaRow';
import DomainsRow from './components/DomainsRow';
import InlineEditCard from './components/InlineEditCard';
import PersonaRow from './components/PersonaRow';
import RowSkeleton from './components/RowSkeleton';
import SettingsSection, { ReadOnlyRow } from './components/SettingsSection';
import UserCustomPropertiesSection from './customProperties/UserCustomPropertiesSection';
import { canUserChangePassword } from './ProfileDetailsPanel.utils';
import { useProfileCopy } from './useUserProfile';

interface ProfileDetailsPanelProps {
  userData: User;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
  /** Only your own Profile tab lists custom properties; the user detail has a tab. */
  showCustomProperties?: boolean;
}

interface PreferredNameRowProps {
  userData: User;
  canEdit: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const PreferredNameRow: React.FC<PreferredNameRowProps> = ({
  userData,
  canEdit,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);
  const displayName = getEntityName(userData);
  const [draft, setDraft] = useState(displayName);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={copy(
        'message.preferred-name-description',
        'message.preferred-name-description-of-user'
      )}
      renderEdit={() => (
        <Input
          data-testid="preferred-name-input"
          size="sm"
          value={draft}
          onChange={setDraft}
        />
      )}
      testId="preferred-name"
      title={t('label.preferred-name')}
      view={
        <Typography className="tw:text-primary" size="text-sm" weight="regular">
          {userData.displayName || startCase(userData.name)}
        </Typography>
      }
      onEnterEdit={() => setDraft(displayName)}
      onSave={() =>
        updateUserDetails({ displayName: draft.trim() }, 'displayName')
      }
    />
  );
};

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
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);
  const { isAdminUser } = useAuth();
  const { currentUser, authConfig } = useApplicationStore();
  const displayName = getEntityName(userData);
  const isSelf = currentUser?.name === userData.name;
  // Legacy parity: only you rename yourself, admins included.
  const canEditName = isSelf && !userData.deleted;
  const canChangePassword = canUserChangePassword({
    provider: authConfig?.provider,
    isSelf,
    isAdmin: isAdminUser,
    isDeleted: userData.deleted,
  });
  const visibleEmail =
    userData.email && !isMaskedEmail(userData.email) ? userData.email : '';

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
          canEdit={canEditName}
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
                <span className="tw:capitalize">{t('label.verified')}</span>
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
        {isProfileLoading ? (
          <RowSkeleton chips={1} />
        ) : (
          <DomainsRow
            updateUserDetails={updateUserDetails}
            userData={userData}
          />
        )}
      </SettingsSection>

      {showCustomProperties && (
        <UserCustomPropertiesSection
          user={userData}
          onUpdate={updateUserDetails}
        />
      )}
    </Box>
  );
};

export default ProfileDetailsPanel;
