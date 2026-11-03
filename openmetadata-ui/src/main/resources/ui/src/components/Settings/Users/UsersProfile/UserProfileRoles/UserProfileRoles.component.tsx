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

import {
  Autocomplete,
  Button,
  Divider,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { ActivityOwnerChanged as RoleIcon } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { debounce, toLower, uniqBy } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClosePopoverIcon } from '../../../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../../../assets/svg/ic-popover-save.svg';
import { TERM_ADMIN } from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { Role } from '../../../../../generated/entity/teams/role';
import { useAuth } from '../../../../../hooks/authHooks';
import { searchRoles } from '../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import Chip from '../../../../common/Chip/Chip.component';
import { WidgetEditButton } from '../../../../common/WidgetActionButton/WidgetActionButton';
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
  const selectedRolesRef = useRef<string[]>([]);

  const useRolesOption = useMemo(() => {
    const options = roles?.map((role) => ({
      id: role.id,
      label: getEntityName(role),
    }));

    if (!isUserAdmin) {
      options.push({
        id: toLower(TERM_ADMIN),
        label: TERM_ADMIN,
      });
    }

    return options;
  }, [roles, isUserAdmin]);

  const selectedRoleItems = useMemo(
    () =>
      selectedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return {
          id: roleId,
          label: role ? getEntityName(role) : TERM_ADMIN,
        };
      }),
    [selectedRoles, roles]
  );

  const handleRoleInserted = useCallback(
    (key: Key) => setSelectedRoles((prev) => [...prev, String(key)]),
    []
  );

  const handleRoleCleared = useCallback(
    (key: Key) =>
      setSelectedRoles((prev) => prev.filter((roleId) => roleId !== key)),
    []
  );

  const fetchRoles = useCallback(
    async (query = '') => {
      try {
        const response = await searchRoles(query);
        setRoles((prevRoles) => {
          const selectedRoleOptions = prevRoles.filter((role) =>
            selectedRolesRef.current.includes(role.id)
          );

          return uniqBy([...selectedRoleOptions, ...response], 'id');
        });
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.role-plural'),
          })
        );
      }
    },
    [t]
  );

  const debouncedFetchRoles = useMemo(
    () => debounce(fetchRoles, 300),
    [fetchRoles]
  );

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
    [userRoles, isUserAdmin, t]
  );

  const handleCloseEditRole = useCallback(() => {
    setIsRolesEdit(false);
    setUserRoles();
  }, [setUserRoles]);

  useEffect(() => {
    selectedRolesRef.current = selectedRoles;
  }, [selectedRoles]);

  useEffect(() => {
    setUserRoles();
  }, [setUserRoles]);

  useEffect(() => {
    setRoles((prevRoles) =>
      uniqBy(
        [
          ...(prevRoles ?? []),
          ...((userRoles ?? []).map((role) => ({
            id: role.id,
            name: role.name ?? '',
            displayName: role.displayName,
          })) as Role[]),
        ],
        'id'
      )
    );
  }, [userRoles]);

  useEffect(() => {
    if (isRolesEdit) {
      fetchRoles();
    }
  }, [isRolesEdit, fetchRoles]);

  useEffect(() => {
    return () => {
      debouncedFetchRoles.cancel();
    };
  }, [debouncedFetchRoles]);

  return (
    <div
      className="tw:flex tw:w-full tw:flex-col tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:px-5 tw:pt-5 tw:pb-2.5"
      data-testid="user-profile-roles">
      <div className="tw:mb-2 tw:flex tw:w-full tw:items-center tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:items-center tw:justify-center">
          <RoleIcon size={16} />
        </div>
        <div className="d-flex justify-between w-full">
          <Typography className="text-sm font-medium">
            {t('label.role-plural')}
          </Typography>
          {isAdminUser && (
            <PopoverTrigger isOpen={isRolesEdit} onOpenChange={setIsRolesEdit}>
              <WidgetEditButton
                data-testid="edit-roles-button"
                title={t('label.edit-entity', {
                  entity: t('label.role-plural'),
                })}
              />
              <Popover
                className="profile-edit-popover-card"
                containerClassName="tw:w-95 tw:p-5"
                placement="right">
                <div
                  className="user-profile-edit-popover-card relative"
                  data-testid="user-profile-edit-popover">
                  <div className="d-flex justify-start items-center gap-2 m-b-sm">
                    <div className="d-flex flex-start items-center">
                      <RoleIcon size={16} />
                    </div>
                    <Typography className="user-profile-edit-popover-card-title">
                      {t('label.role-plural')}
                    </Typography>
                  </div>

                  <div>
                    <Autocomplete
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- the list opens with the popover, as before
                      autoFocus
                      aria-label={t('label.role-plural')}
                      data-testid="profile-edit-roles-select"
                      filterOption={() => true}
                      items={useRolesOption}
                      maxVisibleItems={3}
                      placeholder={t('label.select-entity', {
                        entity: t('label.role-plural'),
                      })}
                      selectedItems={selectedRoleItems}
                      onItemCleared={handleRoleCleared}
                      onItemInserted={handleRoleInserted}
                      onSearchChange={debouncedFetchRoles}>
                      {(item) => (
                        <Autocomplete.Item id={item.id} label={item.label} />
                      )}
                    </Autocomplete>
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      aria-label={t('label.cancel')}
                      color="primary"
                      data-testid="user-profile-edit-roles-cancel-button"
                      iconLeading={<ClosePopoverIcon height={24} />}
                      size="xs"
                      onClick={handleCloseEditRole}
                    />
                    <Button
                      aria-label={t('label.save')}
                      color="primary"
                      data-testid="user-profile-edit-roles-save-button"
                      iconLeading={<SavePopoverIcon height={24} />}
                      isLoading={isLoading}
                      size="xs"
                      onClick={handleRolesSave}
                    />
                  </div>
                </div>
              </Popover>
            </PopoverTrigger>
          )}
        </div>
      </div>
      <div className="tw:mb-2.5 tw:flex tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:items-center tw:justify-center">
          <Divider className="tw:mx-2 tw:h-full" orientation="vertical" />
        </div>
        <div>{rolesRenderElement}</div>
      </div>
      <UserProfileInheritedRoles inheritedRoles={userData?.inheritedRoles} />
    </div>
  );
};

export default UserProfileRoles;
