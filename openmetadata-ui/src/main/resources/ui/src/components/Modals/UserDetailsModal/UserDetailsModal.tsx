/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { Role } from '../../../generated/entity/teams/role';
import { User } from '../../../generated/entity/teams/user';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import Avatar from '../../common/avatar/Avatar';
import DropDown from '../../dropdown/DropDown';
import { DropDownListItem } from '../../dropdown/types';
type UserDetailsModalProp = {
  userData: User;
  onCancel: () => void;
  onSave: (roles: Array<string>) => void;
  header: string;
  roles: Array<Role>;
};

const UserDetailsModal = ({
  userData,
  onCancel,
  onSave,
  header,
  roles = [],
}: UserDetailsModalProp) => {
  const [selectedRoles, setSelectedRoles] = useState<Array<string | undefined>>(
    []
  );
  const getRolesData = (roles: Array<Role>) => {
    return [
      ...roles.map((role: Role) => {
        return {
          name: role.displayName,
          value: role.id,
        };
      }),
      {
        name: 'Admin',
        value: 'admin',
      },
    ];
  };

  const selectedRolesHandler = (id?: string) => {
    setSelectedRoles((prevState: Array<string | undefined>) => {
      if (prevState.includes(id as string)) {
        const selectedRole = [...prevState];
        const index = selectedRole.indexOf(id as string);
        selectedRole.splice(index, 1);

        return selectedRole;
      } else {
        return [...prevState, id];
      }
    });
  };

  useEffect(() => {
    setSelectedRoles(
      [
        userData.isAdmin ? 'admin' : undefined,
        ...(userData.roles?.map((role) => role.id) as Array<
          string | undefined
        >),
      ].filter(Boolean)
    );
  }, [userData]);

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-w-lg tw-max-h-screen">
        <div className="tw-modal-header">
          <p className="tw-modal-title tw-text-grey-body" data-testid="header">
            {header}
          </p>
        </div>
        <div className="tw-modal-body">
          <div className="tw-flex tw-flex-col tw-items-center">
            {userData.profile?.images?.image ? (
              <div className="tw-h-28 tw-w-28">
                <img
                  alt="profile"
                  className="tw-rounded-full tw-w-full"
                  src={userData.profile?.images?.image}
                />
              </div>
            ) : (
              <Avatar
                name={userData?.displayName || userData.name}
                textClass="tw-text-5xl"
                width="112"
              />
            )}
            <p className="tw-mt-2 tw-mb-1">
              <span className="tw-text-base tw-font-medium tw-mr-2">
                {userData.displayName || userData.name}
              </span>
            </p>
            <p className="tw-mb-1">
              <span className="tw-mr-1">{userData.name}</span>|
              <span className="tw-ml-1">{userData.email}</span>
            </p>
            <div className="tw-my-4 tw-w-full">
              {getSeparator('Roles')}
              <div className="tw-w-full">
                <DropDown
                  className={classNames('tw-bg-white', {
                    'tw-bg-gray-100 tw-cursor-not-allowed': roles.length === 0,
                  })}
                  dropDownList={getRolesData(roles) as DropDownListItem[]}
                  label="User"
                  selectedItems={selectedRoles as Array<string>}
                  type="checkbox"
                  onSelect={(_e, value) => selectedRolesHandler(value)}
                />
              </div>
            </div>
            <div className="tw-w-full tw-mx-auto">
              {userData.teams && getSeparator('Teams')}
              <span className="tw-flex tw-justify-center tw-flex-wrap">
                {userData.teams && userData.teams.length > 0 ? (
                  userData.teams.map((team, i) => (
                    <p
                      className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5"
                      key={i}>
                      {team.name}
                    </p>
                  ))
                ) : (
                  <p>This user is not a part of any team!</p>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="tw-modal-footer" data-testid="cta-container">
          <Button
            size="regular"
            theme="primary"
            variant="link"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="saveButton"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={() => onSave(selectedRoles as Array<string>)}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default UserDetailsModal;
