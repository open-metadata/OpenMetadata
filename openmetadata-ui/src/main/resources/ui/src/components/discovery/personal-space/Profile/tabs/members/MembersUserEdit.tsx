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
import { User01 } from '@openmetadata/ui-core-components/icons';
import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditableUser } from '../../../../../../hooks/user-profile/useEditableUser';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import Loader from '../../../../../common/Loader/Loader';
import ProfileDetailsPanel from '../../ProfileDetailsPanel';
import MembershipSection from '../permissions/MembershipSection';

interface MembersUserEditProps {
  name: string;
  // Reports the fetched display name so the header shows it instead of the
  // raw username from the hash.
  onResolveName: (displayName: string) => void;
}

/**
 * Edit view for any user, opened by clicking a user name in the Settings modal
 * (`#members/user/<name>`). Each row applies its own admin/self edit rules.
 */
const MembersUserEdit: FC<MembersUserEditProps> = ({ name, onResolveName }) => {
  const { t } = useTranslation();
  const { userData, isLoading, isNotFound, updateUserDetails } =
    useEditableUser(name);

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

  if (!userData) {
    return <Loader />;
  }

  return (
    <Box
      className="tw:px-8 tw:pt-4 tw:pb-8"
      data-testid="members-user-edit"
      direction="col"
      gap={6}>
      <ProfileDetailsPanel
        isProfileLoading={isLoading}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
      <Box direction="col" gap={3}>
        <Typography
          className="tw:px-1 tw:text-primary tw:uppercase"
          size="text-xs"
          weight="medium">
          {t('label.membership')}
        </Typography>
        <MembershipSection
          updateUserDetails={updateUserDetails}
          userData={userData}
        />
      </Box>
    </Box>
  );
};

export default MembersUserEdit;
