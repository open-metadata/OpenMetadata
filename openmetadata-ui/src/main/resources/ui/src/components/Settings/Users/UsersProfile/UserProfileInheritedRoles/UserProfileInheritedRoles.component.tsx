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
import { useTranslation } from 'react-i18next';
import InheritedRolesIcon from '../../../../../assets/svg/ic-inherited-roles.svg?react';
import { EntityType } from '../../../../../enums/entity.enum';
import Chip from '../../../../common/Chip/Chip.component';
import { UserProfileInheritedRolesProps } from './UserProfileInheritedRoles.interface';

const UserProfileInheritedRoles = ({
  inheritedRoles,
}: UserProfileInheritedRolesProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="d-flex flex-col  w-full  p-[20px]  p-0 m-b-0"
      data-testid="user-profile-inherited-roles">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div className="d-flex flex-center user-page-icon">
          <InheritedRolesIcon height={16} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography.Text className="text-sm font-medium">
            {t('label.inherited-role-plural')}
          </Typography.Text>
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <div className="d-flex flex-center user-page-icon">
          <Divider
            style={{
              height: '100%',
              width: '1px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
        <Chip
          data={inheritedRoles ?? []}
          entityType={EntityType.ROLE}
          noDataPlaceholder={t('message.no-inherited-roles-found')}
        />
      </div>
    </div>
  );
};

export default UserProfileInheritedRoles;
