/*
 *  Copyright 2023 Collate.
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

import { Divider, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritedRolesIcon } from '../../../../../assets/svg/InheritedRoles.svg';
import { EntityType } from '../../../../../enums/entity.enum';
import Chip from '../../../../common/Chip/Chip.component';
import { UserProfileInheritedRolesProps } from './UserProfileInheritedRoles.interface';

const UserProfileInheritedRoles = ({
  inheritedRoles,
}: UserProfileInheritedRolesProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="d-flex p-[20px]  w-full grey-1 gap-2 mb-4 mt-[-20px]"
      data-testid="user-profile-inherited-roles"
      key="inherited-roles-card-component"
      style={{
        background: '#F5F5F5',
        padding: '20px',
        marginTop: '-20px',
        borderRadius: '0px 0px 12px 12px',
      }}>
      <div>
        <div className="d-flex flex-col h-full flex-center">
          <InheritedRolesIcon height={24} width={24} />
          <Divider
            style={{
              height: '100%',
              width: '2px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
      </div>
      <div className="w-full">
        <div className="d-flex flex-col justify-between w-full">
          <Typography.Text
            className="profile-section-card-title"
            data-testid="inherited-roles-label">
            {t('label.inherited-role-plural')}
          </Typography.Text>
          <Chip
            data={inheritedRoles ?? []}
            entityType={EntityType.ROLE}
            noDataPlaceholder={t('message.no-inherited-roles-found')}
          />{' '}
        </div>
      </div>
    </div>
  );
};

export default UserProfileInheritedRoles;
