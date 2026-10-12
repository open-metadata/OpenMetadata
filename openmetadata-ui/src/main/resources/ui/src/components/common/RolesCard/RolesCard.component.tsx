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

import { Box, Card } from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import { Button, Select } from 'antd';
import { isArray, isNil, toLower } from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TERM_ADMIN } from '../../../constants/constants';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { EditIconButton } from '../IconButtons/EditIconButton';
import RolesElement from '../RolesElement/RolesElement.component';
import { RolesComponentProps } from './RolesCard.interfaces';

const RolesCard = ({
  roles,
  userData,
  updateUserDetails,
  selectedRoles,
  setSelectedRoles,
  searchRolesOptions,
  isRolesLoading,
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

        return { id: roleId, type: 'role', name: role?.name ?? '' };
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
      <Card className="bot-page-roles-card-header" key="roles-card">
        <Card.Header
          extra={
            !isRolesEdit && (
              <EditIconButton
                newLook
                data-testid="edit-roles"
                size="small"
                title={t('label.edit-entity', {
                  entity: t('label.role-plural'),
                })}
                onClick={() => setIsRolesEdit(true)}
              />
            )
          }
          title={t('label.role-plural')}
        />
        <Card.Content>
          <div className="mb-4">
            {isRolesEdit ? (
              <Box
                inline
                align="stretch"
                className="layout-space w-full"
                direction="col"
                gap={2}
                itemClassName="layout-space-item">
                <Select
                  showSearch
                  aria-label="Select roles"
                  className="w-full"
                  defaultValue={selectedRoles}
                  filterOption={false}
                  id="select-role"
                  loading={isRolesLoading}
                  mode="multiple"
                  options={userRolesOption}
                  placeholder={`${t('label.role-plural')}...`}
                  onChange={handleOnRolesChange}
                  onSearch={searchRolesOptions}
                />
                <div className="flex justify-end" data-testid="buttons">
                  <Button
                    className="text-sm mr-1"
                    data-testid="cancel-roles"
                    icon={<XClose className="tw:shrink-0" size={14} />}
                    size="small"
                    type="primary"
                    onMouseDown={() => setIsRolesEdit(false)}
                  />
                  <Button
                    className="text-sm"
                    data-testid="save-roles"
                    icon={<Check className="tw:shrink-0" size={14} />}
                    size="small"
                    type="primary"
                    onClick={handleRolesChange}
                  />
                </div>
              </Box>
            ) : (
              <RolesElement userData={userData} />
            )}
          </div>
        </Card.Content>
      </Card>
    );
  } else {
    return (
      <Card className="new-header-border-card" key="roles-card">
        <Card.Header title={t('label.role-plural')} />
        <Card.Content>
          <div className="flex items-center justify-between mb-4">
            <RolesElement userData={userData} />
          </div>
        </Card.Content>
      </Card>
    );
  }
};

export default RolesCard;
