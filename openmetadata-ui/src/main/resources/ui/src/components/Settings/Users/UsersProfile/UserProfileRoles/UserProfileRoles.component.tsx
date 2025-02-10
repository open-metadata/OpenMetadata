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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Divider, Popover, Select, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, toLower } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as RoleIcon } from '../../../../../assets/svg/roles.svg';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/user-profile-edit.svg';
import {
  PAGE_SIZE_LARGE,
  TERM_ADMIN,
} from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { Role } from '../../../../../generated/entity/teams/role';
import { getRoles } from '../../../../../rest/rolesAPIV1';
import { handleSearchFilterOption } from '../../../../../utils/CommonUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import Chip from '../../../../common/Chip/Chip.component';
import '../../users.less';
import UserProfileInheritedRoles from '../UserProfileInheritedRoles/UserProfileInheritedRoles.component';
import { UserProfileRolesProps } from './UserProfileRoles.interface';

const UserProfileRoles = ({
  userRoles,
  updateUserDetails,
  isUserAdmin,
  userData,
}: UserProfileRolesProps) => {
  const { t } = useTranslation();

  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);

  const useRolesOption = useMemo(() => {
    const options = roles?.map((role) => ({
      label: getEntityName(role),
      value: role.id,
    }));

    if (!isUserAdmin) {
      options.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }

    return options;
  }, [roles, isUserAdmin, getEntityName]);

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

  const setUserRoles = useCallback(() => {
    const defaultUserRoles = [
      ...(userRoles?.map((role) => role.id) ?? []),
      ...(isUserAdmin ? [toLower(TERM_ADMIN)] : []),
    ];

    setSelectedRoles(defaultUserRoles);
  }, [userRoles, isUserAdmin]);

  const handleRolesSave = async () => {
    setIsLoading(true);
    // filter out the roles , and exclude the admin one
    const updatedRoles = selectedRoles.filter(
      (roleId) => roleId !== toLower(TERM_ADMIN)
    );

    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = selectedRoles.find(
      (roleId) => roleId === toLower(TERM_ADMIN)
    );
    await updateUserDetails(
      {
        roles: updatedRoles.map((roleId) => {
          const role = roles.find((r) => r.id === roleId);

          return { id: roleId, type: 'role', name: role?.name ?? '' };
        }),
        isAdmin: Boolean(isAdmin),
      },
      'roles'
    );

    setIsLoading(false);
    setIsRolesEdit(false);
  };

  const rolesRenderElement = useMemo(
    () => (
      <Chip
        data={[
          ...(isUserAdmin
            ? [{ id: 'admin', type: 'role', name: TERM_ADMIN }]
            : []),
          ...(userRoles ?? []),
        ]}
        entityType={EntityType.ROLE}
        noDataPlaceholder={t('message.no-roles-assigned')}
        showNoDataPlaceholder={!isUserAdmin}
      />
    ),
    [userRoles, isUserAdmin]
  );

  const handleCloseEditRole = useCallback(() => {
    setIsRolesEdit(false);
    setUserRoles();
  }, [setUserRoles, setIsRolesEdit]);

  useEffect(() => {
    setUserRoles();
  }, [setUserRoles]);

  useEffect(() => {
    if (isRolesEdit && isEmpty(roles)) {
      fetchRoles();
    }
  }, [isRolesEdit, roles]);

  return (
    <div className="d-flex flex-col m-b-0 w-full h-full p-[20px] user-profile-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div className="d-flex flex-center user-page-icon">
          <RoleIcon height={16} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography.Text className="user-profile-card-title">
            {t('label.role-plural')}
          </Typography.Text>
          <Popover
            content={
              <div className="user-profile-edit-popover-card">
                <div className="d-flex justify-start align-center gap-2 m-b-xs">
                  <RoleIcon height={16} />
                  <Typography.Text className="user-profile-edit-popover-card-title">
                    {t('label.role-plural')}
                  </Typography.Text>
                </div>

                <div
                  className="border p-2 bg-gray-100 rounded-md"
                  style={{
                    borderRadius: '5px',
                    // overflowY: 'auto',
                    // height: isSelectOpen ? '300px' : 'auto',
                  }}>
                  <Select
                    allowClear
                    showSearch
                    aria-label="Roles"
                    className="w-full"
                    dropdownMatchSelectWidth={false}
                    filterOption={handleSearchFilterOption}
                    getPopupContainer={(trigger) => trigger.parentElement}
                    loading={isLoading}
                    maxTagCount={4}
                    mode="multiple"
                    open={isSelectOpen}
                    options={useRolesOption}
                    value={selectedRoles}
                    onChange={setSelectedRoles}
                    onDropdownVisibleChange={setIsSelectOpen}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    className="profile-edit-save"
                    data-testid="inline-cancel-btn"
                    icon={<CloseOutlined />}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                    }}
                    type="primary"
                    onClick={handleCloseEditRole}
                  />
                  <Button
                    className="profile-edit-cancel"
                    data-testid="inline-save-btn"
                    icon={<CheckOutlined />}
                    loading={isLoading}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                    }}
                    type="primary"
                    onClick={handleRolesSave}
                  />
                </div>
              </div>
            }
            open={isRolesEdit}
            overlayClassName="profile-edit-popover-card"
            placement="right"
            trigger="click"
            onOpenChange={setIsRolesEdit}>
            <EditIcon
              className="cursor-pointer align-middle"
              data-testid="edit-roles-button"
              height={16}
              onClick={() => setIsRolesEdit(true)}
            />
          </Popover>
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
        <div className="m-b-md">{rolesRenderElement}</div>
      </div>
      <UserProfileInheritedRoles inheritedRoles={userData?.inheritedRoles} />
    </div>
  );
};

export default UserProfileRoles;
