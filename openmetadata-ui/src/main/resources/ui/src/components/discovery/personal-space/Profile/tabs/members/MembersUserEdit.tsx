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

import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { User01 } from '@openmetadata/ui-core-components/icons';
import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditableUser } from '../../../../../../hooks/user-profile/useEditableUser';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import Loader from '../../../../../common/Loader/Loader';
import type { MembersView } from './Members.types';
import MembersCreateUserForm from './MembersCreateUserForm';

interface MembersUserEditProps {
  name: string;
  onNavigate: (view: MembersView) => void;
  // Reports the fetched display name so the header shows it instead of the
  // raw username from the hash.
  onResolveName: (displayName: string) => void;
}

/**
 * Edit User view, opened by clicking a user name in the Settings modal
 * (`#members/user/<name>`): the Create User form, pre-filled, saving one patch.
 * Deleted users get a restore hint instead, since the server rejects the patch.
 */
const MembersUserEdit: FC<MembersUserEditProps> = ({
  name,
  onNavigate,
  onResolveName,
}) => {
  const { t } = useTranslation();
  const { userData, isLoading, isNotFound } = useEditableUser(name);

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

  if (isLoading || !userData) {
    return <Loader />;
  }

  // The server only patches live users, so a soft-deleted one can't be edited
  // until it is restored from the Users list.
  if (userData.deleted) {
    return (
      <Box className="tw:relative tw:flex-1 tw:min-h-90">
        <EmptyPlaceholder
          actions={[
            {
              color: 'secondary',
              key: 'back-to-users',
              label: t('label.user-plural'),
              onPress: () => onNavigate({ type: 'users' }),
            },
          ]}
          data-testid="deleted-user"
          description={t('message.restore-user-to-edit')}
          icon={User01}
          title={t('label.deleted-entity', { entity: t('label.user') })}
        />
      </Box>
    );
  }

  return (
    <Box
      className="tw:h-full tw:min-h-0 tw:pt-4"
      data-testid="members-user-edit"
      direction="col">
      <MembersCreateUserForm
        key={userData.id}
        user={userData}
        onNavigate={onNavigate}
      />
    </Box>
  );
};

export default MembersUserEdit;
