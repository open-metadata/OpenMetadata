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

import { Card, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as UserIcons } from '../../../../assets/svg/user.svg';
import Chip from '../../../../components/common/Chip/Chip.component';
import { UserProfileInheritedRolesProps } from './UserProfileInheritedRoles.interface';

const UserProfileInheritedRoles = ({
  inheritedRoles,
}: UserProfileInheritedRolesProps) => {
  const { t } = useTranslation();

  return (
    <Card
      className="ant-card-feed relative card-body-border-none card-padding-y-0"
      data-testid="user-profile-inherited-roles"
      key="inherited-roles-card-component"
      title={
        <Typography.Text
          className="right-panel-label m-b-0"
          data-testid="inherited-roles-label">
          {t('label.inherited-role-plural')}
        </Typography.Text>
      }>
      <Chip
        data={inheritedRoles ?? []}
        icon={<UserIcons height={20} />}
        noDataPlaceholder={t('message.no-inherited-roles-found')}
      />
    </Card>
  );
};

export default UserProfileInheritedRoles;
