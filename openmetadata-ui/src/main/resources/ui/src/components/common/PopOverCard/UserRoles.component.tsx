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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconUsers } from '../../../assets/svg/user.svg';
import { TERM_ADMIN } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { UserRolesProps } from './UserPopOverCard.interface';

export const UserRoles = React.memo(({ userName }: UserRolesProps) => {
  const { userProfilePics } = useApplicationStore();
  const userData = userProfilePics[userName];
  const roles = userData?.roles;
  const isAdmin = userData?.isAdmin;
  const { t } = useTranslation();

  return roles?.length ? (
    <div className="m-t-xs">
      <p className="d-flex items-center">
        <IconUsers height={16} width={16} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.role-plural')}
        </span>
      </p>

      <span className="d-flex flex-wrap m-t-xss">
        {isAdmin && (
          <span className="bg-grey rounded-4 p-x-xs text-xs m-b-xss">
            {TERM_ADMIN}
          </span>
        )}
        {roles.map((role) => (
          <span
            className="bg-grey rounded-4 p-x-xs text-xs m-b-xss"
            key={role.id}>
            {getEntityName(role)}
          </span>
        ))}
      </span>
    </div>
  ) : null;
});
