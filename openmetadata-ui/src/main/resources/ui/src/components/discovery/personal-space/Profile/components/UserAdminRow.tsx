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

import { Toggle } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { ReadOnlyRow } from './SettingsSection';

interface UserAdminRowProps {
  userData: User;
  canEdit: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

/**
 * Admin flag as an always-visible toggle that saves on change — a single
 * on/off value has nothing to review, so it skips the edit/Save step.
 */
const UserAdminRow: React.FC<UserAdminRowProps> = ({
  userData,
  canEdit,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  // The value being saved, shown right away so the switch moves on click;
  // cleared afterwards, so a failure falls back to the stored value.
  const [pendingValue, setPendingValue] = useState<boolean>();

  const handleChange = async (isAdmin: boolean) => {
    setPendingValue(isAdmin);
    try {
      await updateUserDetails({ isAdmin }, 'isAdmin');
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setPendingValue(undefined);
    }
  };

  return (
    <ReadOnlyRow
      description={t('message.user-admin-description')}
      testId="user-admin"
      title={t('label.admin')}>
      <Toggle
        aria-label={t('label.admin')}
        data-testid="user-admin-toggle"
        isDisabled={!canEdit || pendingValue !== undefined}
        isSelected={pendingValue ?? Boolean(userData.isAdmin)}
        onChange={handleChange}
      />
    </ReadOnlyRow>
  );
};

export default UserAdminRow;
