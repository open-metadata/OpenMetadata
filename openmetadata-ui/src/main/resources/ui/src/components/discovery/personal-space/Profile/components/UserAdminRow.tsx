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

import { Toggle, Typography } from '@openmetadata/ui-core-components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import InlineEditCard from './InlineEditCard';

interface UserAdminRowProps {
  userData: User;
  canEdit: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const UserAdminRow: React.FC<UserAdminRowProps> = ({
  userData,
  canEdit,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const isAdmin = Boolean(userData.isAdmin);
  const [draft, setDraft] = useState(isAdmin);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.user-admin-description')}
      isSaveDisabled={draft === isAdmin}
      lockedLabel={t('label.admin-managed')}
      renderEdit={() => (
        <Toggle
          data-testid="user-admin-toggle"
          isSelected={draft}
          label={t('label.admin')}
          onChange={setDraft}
        />
      )}
      testId="user-admin"
      title={t('label.admin')}
      view={
        <Typography className="tw:text-primary" size="text-sm">
          {isAdmin ? t('label.yes') : t('label.no')}
        </Typography>
      }
      onEnterEdit={() => setDraft(isAdmin)}
      onSave={() => updateUserDetails({ isAdmin: draft }, 'isAdmin')}
    />
  );
};

export default UserAdminRow;
