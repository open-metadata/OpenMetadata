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

import { Card, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, toLower } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as UserIcons } from '../../../../assets/svg/user.svg';
import Chip from '../../../../components/common/Chip/Chip.component';
import InlineEdit from '../../../../components/InlineEdit/InlineEdit.component';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  PAGE_SIZE_LARGE,
  TERM_ADMIN,
} from '../../../../constants/constants';
import { Role } from '../../../../generated/entity/teams/role';
import { useAuth } from '../../../../hooks/authHooks';
import { getRoles } from '../../../../rest/rolesAPIV1';
import { handleSearchFilterOption } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { UserProfileRolesProps } from './UserProfileRoles.interface';

const UserProfileRoles = ({
  userRoles,
  updateUserDetails,
}: UserProfileRolesProps) => {
  const { t } = useTranslation();

  const { isAdminUser } = useAuth();

  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const useRolesOption = useMemo(() => {
    const options = roles?.map((role) => ({
      label: getEntityName(role),
      value: role.id,
    }));

    if (!isAdminUser) {
      options.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }

    return options;
  }, [roles, isAdminUser, getEntityName]);

  const fetchRoles = async () => {
    setIsRolesLoading(true);
    try {
      const response = await getRoles(
        '',
        undefined,
        undefined,
        false,
        PAGE_SIZE_LARGE
      );
      setRoles(response.data);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.role-plural'),
        })
      );
    } finally {
      setIsRolesLoading(false);
    }
  };

  const handleRolesSave = () => {
    // filter out the roles , and exclude the admin one
    const updatedRoles = selectedRoles.filter(
      (roleId) => roleId !== toLower(TERM_ADMIN)
    );

    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = selectedRoles.find(
      (roleId) => roleId === toLower(TERM_ADMIN)
    );
    updateUserDetails({
      roles: updatedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name ?? '' };
      }),
      isAdmin: Boolean(isAdmin),
    });

    setIsRolesEdit(false);
  };

  const rolesRenderElement = useMemo(
    () => (
      <Chip
        data={[
          ...(isAdminUser
            ? [{ id: 'admin', type: 'role', name: TERM_ADMIN }]
            : []),
          ...(userRoles ?? []),
        ]}
        icon={<UserIcons height={20} />}
        noDataPlaceholder={t('message.no-roles-assigned')}
        showNoDataPlaceholder={!isAdminUser}
      />
    ),
    [userRoles, isAdminUser]
  );

  useEffect(() => {
    const defaultUserRoles = [
      ...(userRoles?.map((role) => role.id) ?? []),
      ...(isAdminUser ? [toLower(TERM_ADMIN)] : []),
    ];

    setSelectedRoles(defaultUserRoles);
  }, [isAdminUser, userRoles]);

  useEffect(() => {
    if (isRolesEdit && isEmpty(roles)) {
      fetchRoles();
    }
  }, [isRolesEdit, roles]);

  return (
    <Card
      className="ant-card-feed relative card-body-border-none card-padding-y-0"
      data-testid="user-profile-roles"
      key="roles-card"
      title={
        <Space align="center">
          <Typography.Text className="right-panel-label">
            {t('label.role-plural')}
          </Typography.Text>
          {!isRolesEdit && isAdminUser && (
            <EditIcon
              className="cursor-pointer align-middle"
              color={DE_ACTIVE_COLOR}
              data-testid="edit-roles-button"
              {...ICON_DIMENSION}
              onClick={() => setIsRolesEdit(true)}
            />
          )}
        </Space>
      }>
      <div className="m-b-md">
        {isRolesEdit && isAdminUser ? (
          <InlineEdit
            direction="vertical"
            onCancel={() => setIsRolesEdit(false)}
            onSave={handleRolesSave}>
            <Select
              allowClear
              showSearch
              aria-label="Select roles"
              className="w-full"
              data-testid="select-user-roles"
              filterOption={handleSearchFilterOption}
              id="select-role"
              loading={isRolesLoading}
              maxTagCount={4}
              mode="multiple"
              options={useRolesOption}
              placeholder={t('label.role-plural')}
              value={!isRolesLoading ? selectedRoles : []}
              onChange={setSelectedRoles}
            />
          </InlineEdit>
        ) : (
          rolesRenderElement
        )}
      </div>
    </Card>
  );
};

export default UserProfileRoles;
