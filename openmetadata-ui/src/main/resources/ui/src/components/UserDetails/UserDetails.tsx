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

import { isUndefined } from 'lodash';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getUserPath } from '../../constants/constants';
import { EntityReference, User } from '../../generated/entity/teams/user';
import { getEntityName } from '../../utils/CommonUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import PopOver from '../common/popover/PopOver';
import Searchbar from '../common/searchbar/Searchbar';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import UserDataCard from '../UserDataCard/UserDataCard';

type UserDetailsProps = {
  selectedUserList: User[];
  handleUserSearchTerm: (value: string) => void;
  userSearchTerm: string;
  isUsersLoading: boolean;
  handleDeleteUser: (id: string) => void;
};

interface DeleteUserInfo {
  name: string;
  id: string;
}

const UserDetails = ({
  selectedUserList,
  userSearchTerm,
  isUsersLoading,
  handleDeleteUser,
  handleUserSearchTerm,
}: UserDetailsProps) => {
  const history = useHistory();
  const [deletingUser, setDeletingUser] = useState<DeleteUserInfo>();

  const handleDeleteUserModal = (id: string, name: string) => {
    setDeletingUser({
      name,
      id,
    });
  };

  /**
   * Redirects user to profile page.
   * @param name user name
   */
  const handleUserRedirection = (name: string) => {
    history.push(getUserPath(name));
  };

  const onConfirmDeleteUser = (id: string) => {
    handleDeleteUser(id);
    setDeletingUser(undefined);
  };

  const getTeamsText = (teams: EntityReference[]) => {
    return teams.length > 1 ? (
      <span>
        {getEntityName(teams[0])}, &{' '}
        <PopOver
          html={
            <span>
              {teams.map((t, i) => {
                return i >= 1 ? (
                  <span className="tw-block tw-text-left" key={i}>
                    {getEntityName(t)}
                  </span>
                ) : null;
              })}
            </span>
          }
          position="bottom"
          theme="light"
          trigger="mouseenter">
          <span className="tw-underline tw-cursor-pointer">
            {teams.length - 1} more
          </span>
        </PopOver>
      </span>
    ) : (
      `${getEntityName(teams[0])}`
    );
  };

  const getUserCards = () => {
    return isUsersLoading ? (
      <Loader />
    ) : (
      <div>
        {selectedUserList.length > 0 ? (
          <div
            className="tw-grid xxl:tw-grid-cols-3 lg:tw-grid-cols-2 tw-gap-4"
            data-testid="user-container">
            {selectedUserList.map((user, index) => {
              const User = {
                displayName: getEntityName(user as unknown as EntityReference),
                name: user.name || '',
                id: user.id,
                email: user.email || '',
                isActiveUser: !user.deleted,
                profilePhoto: user.profile?.images?.image || '',
                teamCount:
                  user.teams && user.teams.length
                    ? getTeamsText(user.teams)
                    : 'No teams',
              };

              return (
                <div key={index}>
                  <UserDataCard
                    item={User}
                    onClick={handleUserRedirection}
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
      </div>
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
      </div>
      {getUserCards()}

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
