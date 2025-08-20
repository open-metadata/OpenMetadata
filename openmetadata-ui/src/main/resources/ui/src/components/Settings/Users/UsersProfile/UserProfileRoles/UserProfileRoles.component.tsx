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

import { Button, Divider, Popover, Select, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, toLower } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditIcon from '../../../../../assets/svg/edit-new.svg?react';
import ClosePopoverIcon from '../../../../../assets/svg/ic-popover-close.svg?react';
import SavePopoverIcon from '../../../../../assets/svg/ic-popover-save.svg?react';
import RoleIcon from '../../../../../assets/svg/ic-roles.svg?react';

import {
  PAGE_SIZE_LARGE,
  TERM_ADMIN,
} from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { Role } from '../../../../../generated/entity/teams/role';
import { useAuth } from '../../../../../hooks/authHooks';
import { getRoles } from '../../../../../rest/rolesAPIV1';
import { handleSearchFilterOption } from '../../../../../utils/CommonUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import Chip from '../../../../common/Chip/Chip.component';
import { TagRenderer } from '../../../../common/TagRenderer/TagRenderer';
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
  const { isAdminUser } = useAuth();

  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [popoverHeight, setPopoverHeight] = useState<number>(156);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dropdown = document.querySelector(
        '.roles-custom-dropdown-class'
      ) as HTMLElement;

      if (dropdown) {
        setPopoverHeight(dropdown.scrollHeight + 156);
      }
    });

    const dropdown = document.querySelector('.roles-custom-dropdown-class');
    if (dropdown) {
      observer.observe(dropdown, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [isDropdownOpen]);

  return (
    <div
      className="d-flex flex-col m-b-0 w-full p-[20px] user-profile-card"
      data-testid="user-profile-roles">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div className="d-flex flex-center user-page-icon">
          <RoleIcon height={16} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography.Text className="text-sm font-medium">
            {t('label.role-plural')}
          </Typography.Text>
          <Popover
            content={
              <div
                className="user-profile-edit-popover-card relative"
                data-testid="user-profile-edit-popover"
                style={{
                  height: `${popoverHeight}px`,
                }}>
                <div className="d-flex justify-start items-center gap-2 m-b-sm">
                  <div className="d-flex flex-start items-center">
                    <RoleIcon height={16} />
                  </div>
                  <Typography.Text className="user-profile-edit-popover-card-title">
                    {t('label.role-plural')}
                  </Typography.Text>
                </div>

                <div
                  className="border p-2 bg-gray-100 rounded-md"
                  style={{
                    borderRadius: '5px',
                  }}>
                  <Select
                    allowClear
                    showSearch
                    aria-label="Roles"
                    className="w-full"
                    data-testid="profile-edit-roles-select"
                    dropdownMatchSelectWidth={false}
                    filterOption={handleSearchFilterOption}
                    loading={isLoading}
                    maxTagCount={3}
                    maxTagPlaceholder={(omittedValues) => (
                      <span className="max-tag-text">
                        {t('label.plus-count-more', {
                          count: omittedValues.length,
                        })}
                      </span>
                    )}
                    mode="multiple"
                    open={isDropdownOpen}
                    options={useRolesOption}
                    popupClassName="roles-custom-dropdown-class"
                    ref={dropdownRef as any}
                    tagRender={TagRenderer}
                    value={selectedRoles}
                    onChange={setSelectedRoles}
                    onDropdownVisibleChange={(open) => {
                      setIsDropdownOpen(open);
                    }}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    className="profile-edit-save"
                    data-testid="user-profile-edit-roles-cancel-button"
                    icon={<ClosePopoverIcon height={24} />}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                      position: 'absolute',
                      bottom: '0px',
                      right: '38px',
                    }}
                    type="primary"
                    onClick={handleCloseEditRole}
                  />
                  <Button
                    className="profile-edit-cancel"
                    data-testid="user-profile-edit-roles-save-button"
                    icon={<SavePopoverIcon height={24} />}
                    loading={isLoading}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                      position: 'absolute',
                      bottom: '0px',
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
            {isAdminUser && (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.role-plural'),
                })}>
                <EditIcon
                  className="cursor-pointer align-middle"
                  data-testid="edit-roles-button"
                  height={16}
                  onClick={() => setIsRolesEdit(true)}
                />
              </Tooltip>
            )}
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
        <div>{rolesRenderElement}</div>
      </div>
      <UserProfileInheritedRoles inheritedRoles={userData?.inheritedRoles} />
    </div>
  );
};

export default UserProfileRoles;
