/*
 *  Copyright 2022 Collate.
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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, Select, Space, Tooltip } from 'antd';
import { isArray, isNil, toLower } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { TERM_ADMIN } from '../../../constants/constants';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityName } from '../../../utils/EntityUtils';
import RolesElement from '../RolesElement/RolesElement.component';
import { RolesComponentProps } from './RolesCard.interfaces';

const RolesCard = ({
  roles,
  userData,
  updateUserDetails,
  selectedRoles,
  setSelectedRoles,
}: RolesComponentProps) => {
  const [isRolesEdit, setIsRolesEdit] = useState(false);

  const { t } = useTranslation();
  const { isAdminUser } = useAuth();

  const handleRolesChange = () => {
    // filter out the roles , and exclude the admin one
    const updatedRoles = isArray(selectedRoles)
      ? selectedRoles.filter((roleId) => roleId !== toLower(TERM_ADMIN))
      : [];
    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = isArray(selectedRoles)
      ? selectedRoles.find((roleId) => roleId === toLower(TERM_ADMIN))
      : [];

    updateUserDetails({
      roles: updatedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name || '' };
      }),
      isAdmin: Boolean(isAdmin),
    });

    setIsRolesEdit(false);
  };

  const handleOnRolesChange = (selectedOptions: string[]) => {
    if (isNil(selectedOptions)) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(selectedOptions);
    }
  };

  const userRolesOption = isArray(roles)
    ? roles.map((role) => ({
        label: getEntityName(role),
        value: role.id,
      }))
    : [];

  if (!userData.isAdmin) {
    userRolesOption.push({
      label: TERM_ADMIN,
      value: toLower(TERM_ADMIN),
    });
  }

  if (isAdminUser) {
    return (
      <Card
        className="ant-card-feed relative page-layout-v1-left-panel"
        extra={
          !isRolesEdit && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.role-plural'),
              })}>
              {' '}
              <Button
                className="m-l-xs"
                data-testid="edit-roles"
                icon={<EditIcon width={16} />}
                type="text"
                onClick={() => setIsRolesEdit(true)}
              />
            </Tooltip>
          )
        }
        key="roles-card"
        title={t('label.role-plural')}>
        <div className="mb-4">
          {isRolesEdit ? (
            <Space className="w-full" direction="vertical">
              <Select
                aria-label="Select roles"
                className="w-full"
                defaultValue={selectedRoles}
                id="select-role"
                mode="multiple"
                options={userRolesOption}
                placeholder={`${t('label.role-plural')}...`}
                onChange={handleOnRolesChange}
              />
              <div className="flex justify-end" data-testid="buttons">
                <Button
                  className="text-sm mr-1"
                  data-testid="cancel-roles"
                  icon={<CloseOutlined />}
                  size="small"
                  type="primary"
                  onMouseDown={() => setIsRolesEdit(false)}
                />
                <Button
                  className="text-sm"
                  data-testid="save-roles"
                  icon={<CheckOutlined />}
                  size="small"
                  type="primary"
                  onClick={handleRolesChange}
                />
              </div>
            </Space>
          ) : (
            <RolesElement userData={userData} />
          )}
        </div>
      </Card>
    );
  } else {
    return (
      <Card
        className="relative page-layout-v1-left-panel mt-2.5"
        key="roles-card"
        title={t('label.role-plural')}>
        <div className="flex items-center justify-between mb-4">
          <RolesElement userData={userData} />
        </div>
      </Card>
    );
  }
};

export default RolesCard;
