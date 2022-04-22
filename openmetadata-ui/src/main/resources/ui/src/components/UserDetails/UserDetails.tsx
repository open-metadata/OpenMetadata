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

import { compare, Operation } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Role } from '../../generated/entity/teams/role';
import { EntityReference, User } from '../../generated/entity/teams/user';
import { getEntityName } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import UserDetailsModal from '../Modals/UserDetailsModal/UserDetailsModal';
import UserDataCard from '../UserDataCard/UserDataCard';

type UserDetailsProps = {
  selectedUserList: User[];
  handleUserSearchTerm: (value: string) => void;
  userSearchTerm: string;
  updateUser: (id: string, data: Operation[], updatedUser: User) => void;
  handleDeleteUser: (id: string) => void;
  handleAddNewUser: () => void;
};

interface DeleteUserInfo {
  name: string;
  id: string;
}

const UserDetails = ({
  selectedUserList,
  userSearchTerm,
  handleDeleteUser,
  handleUserSearchTerm,
  updateUser,
  handleAddNewUser,
}: UserDetailsProps) => {
  const [selectedUser, setSelectedUser] = useState<User>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [deletingUser, setDeletingUser] = useState<DeleteUserInfo>();

  const selectUser = (id: string) => {
    const user = selectedUserList.find((user) => user.id === id);
    if (user) {
      setSelectedUser(user);
    } else {
      setSelectedUser(undefined);
    }
  };

  const handleSave = (rolesData: Array<string>) => {
    if (selectedUser) {
      const updatedData: User = {
        ...selectedUser,
        isAdmin: Boolean(rolesData.find((role) => role === 'admin')),
        roles: roles
          .filter((role) => rolesData.includes(role.id))
          .map((role) => ({
            id: role.id,
            type: 'role',
            href: role.href,
            displayName: role.displayName,
          })),
      };
      const jsonPatch = compare(selectedUser, updatedData);
      updateUser(selectedUser.id, jsonPatch, updatedData);

      setSelectedUser(undefined);
    }
  };

  const handleDeleteUserModal = (id: string, name: string) => {
    setDeletingUser({
      name,
      id,
    });
  };

  const onConfirmDeleteUser = (id: string) => {
    handleDeleteUser(id);
    setDeletingUser(undefined);
  };

  useEffect(() => {
    setRoles(AppState.userRoles);
  }, [AppState.userRoles]);

  const getUserCards = () => {
    return (
      <>
        {selectedUserList.length > 0 ? (
          <div
            className="tw-grid xxl:tw-grid-cols-3 lg:tw-grid-cols-2 tw-gap-4"
            data-testid="user-card-container">
            {selectedUserList.map((user, index) => {
              const User = {
                description: getEntityName(user as unknown as EntityReference),
                name: user.name || '',
                id: user.id,
                email: user.email || '',
                isActiveUser: !user.deleted,
                profilePhoto: user.profile?.images?.image || '',
                teamCount:
                  user.teams && user.teams?.length
                    ? user.teams
                        ?.map((team) => team.displayName ?? team.name)
                        ?.join(', ')
                    : 'No teams',
              };

              return (
                <div
                  className="tw-cursor-pointer"
                  key={index}
                  onClick={() => selectUser(User.id)}>
                  <UserDataCard
                    item={User}
                    onClick={selectUser}
                    onDelete={handleDeleteUserModal}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <ErrorPlaceHolder>
            <p>No user available</p>
          </ErrorPlaceHolder>
        )}
      </>
    );
  };

  return (
    <div>
      <div className="tw-flex tw-justify-between tw-items-center tw-mb-3">
        <div className="tw-w-4/12">
          <Searchbar
            removeMargin
            placeholder="Search for user..."
            searchValue={userSearchTerm}
            typingInterval={500}
            onSearch={handleUserSearchTerm}
          />
        </div>
        <div>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className="tw-h-8 tw-px-2"
              data-testid="add-teams"
              size="small"
              theme="primary"
              variant="contained"
              onClick={handleAddNewUser}>
              Create New User
            </Button>
          </NonAdminAction>
        </div>
      </div>
      {getUserCards()}

      {!isUndefined(selectedUser) && (
        <UserDetailsModal
          header="Update user"
          roles={roles}
          userData={selectedUser}
          onCancel={() => setSelectedUser(undefined)}
          onSave={handleSave}
        />
      )}

      {!isUndefined(deletingUser) && (
        <ConfirmationModal
          bodyText={`Are you sure you want to delete ${deletingUser.name}?`}
          cancelText="Cancel"
          confirmText="Confirm"
          header="Delete user"
          onCancel={() => setDeletingUser(undefined)}
          onConfirm={() => {
            onConfirmDeleteUser(deletingUser.id);
          }}
        />
      )}
    </div>
  );
};

export default UserDetails;
