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

import { Card } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../../generated/entity/teams/user';
import { useProfileCopy } from '../../../../../../hooks/discovery/personal-space/useUserProfile';
import ChipBadgeList from '../../components/ChipBadgeList';
import FieldRow from '../../components/FieldRow';
import RolesRow from '../../components/RolesRow';
import TeamsRow from '../../components/TeamsRow';

export interface MembershipSectionProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  canEditTeams?: boolean;
}

/**
 * "Membership" card for the Permissions page: the teams and roles the user
 * belongs to (editable inline for admins; a lock + "Admin-managed" for everyone
 * else), plus the read-only roles inherited from those teams.
 */
const MembershipSection: React.FC<MembershipSectionProps> = ({
  userData,
  updateUserDetails,
  canEditTeams,
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);

  return (
    <Card
      className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
      data-testid="membership-section"
      variant="muted">
      <TeamsRow
        canEdit={canEditTeams}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
      <RolesRow updateUserDetails={updateUserDetails} userData={userData} />
      <div className="tw:px-5 tw:py-4">
        <FieldRow
          description={copy(
            'message.inherited-role-description',
            'message.inherited-role-description-of-user'
          )}
          title={t('label.inherited-role-plural')}>
          <ChipBadgeList
            color="gray"
            noDataPlaceholder={t('message.no-inherited-role-plural')}
            values={userData.inheritedRoles ?? []}
          />
        </FieldRow>
      </div>
    </Card>
  );
};

export default MembershipSection;
