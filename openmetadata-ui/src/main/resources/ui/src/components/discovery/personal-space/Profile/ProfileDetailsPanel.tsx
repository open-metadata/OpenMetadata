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
import { Check } from '@untitledui/icons';
import startCase from 'lodash/startCase';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import { User } from '../../../../generated/entity/teams/user';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import DefaultPersonaRow from './components/DefaultPersonaRow';
import DomainsRow from './components/DomainsRow';
import FieldRow from './components/FieldRow';
import InlineEditCard from './components/InlineEditCard';
import PersonaRow from './components/PersonaRow';
import RowSkeleton from './components/RowSkeleton';

interface ProfileDetailsPanelProps {
  userData: User;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

interface ReadOnlyRowProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

const ReadOnlyRow: React.FC<ReadOnlyRowProps> = ({
  title,
  description,
  children,
}) => (
  <div className="tw:px-5 tw:py-4">
    <FieldRow description={description} title={title}>
      {children}
    </FieldRow>
  </div>
);

interface ProfileSectionProps {
  title: string;
  testId?: string;
  children: React.ReactNode;
}

/**
 * A titled settings section: uppercase caption above one bordered card whose
 * rows are separated by dividers.
 */
const ProfileSection: React.FC<ProfileSectionProps> = ({
  title,
  testId,
  children,
}) => (
  <Box data-testid={testId} direction="col" gap={3}>
    <Typography
      className="tw:px-1 tw:text-primary-900 tw:uppercase"
      size="text-xs"
      weight="medium">
      {title}
    </Typography>
    <Box
      className="tw:divide-y tw:divide-secondary tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary"
      direction="col">
      {children}
    </Box>
  </Box>
);

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
  const displayName = getEntityName(userData) || userData.name;
  const [draft, setDraft] = useState(displayName);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.preferred-name-description')}
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
        <Typography
          className="tw:text-primary-900"
          size="text-sm"
          weight="regular">
          {startCase(displayName)}
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
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const displayName = getEntityName(userData) || userData.name;
  const isSelf = currentUser?.name === userData.name;
  const canEditName = (Boolean(isAdminUser) || isSelf) && !userData.deleted;

  return (
    <Box data-testid="profile-details-panel" direction="col" gap={6}>
      <ProfileSection
        testId="profile-section-profile"
        title={t('label.profile')}>
        <ReadOnlyRow
          description={t('message.photo-description')}
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
              className="tw:text-primary-900"
              size="text-sm"
              weight="regular">
              {userData.email ?? ''}
            </Typography>
            {userData.email && (
              <BadgeWithIcon
                color="success"
                iconLeading={Check}
                size="xs"
                type="pill-color">
                {t('label.success')}
              </BadgeWithIcon>
            )}
          </Box>
        </ReadOnlyRow>
      </ProfileSection>

      <ProfileSection
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
      </ProfileSection>
    </Box>
  );
};

export default ProfileDetailsPanel;
