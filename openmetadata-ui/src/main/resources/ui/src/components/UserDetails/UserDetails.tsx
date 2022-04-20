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

import React from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { UserType } from '../../enums/user.enum';
import { EntityReference, User } from '../../generated/entity/teams/user';
import { getEntityName } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';

type UserDetailsProps = {
  users: User[];
  admins: User[];
  bots: User[];
  activeUserTab: UserType | undefined;
  handleUserSearchTerm: (value: string) => void;
  userSearchTerm: string;
};

const UserDetails = ({
  users,
  admins,
  bots,
  activeUserTab,
  userSearchTerm,
  handleUserSearchTerm,
}: UserDetailsProps) => {
  const getUserCards = (type: UserType) => {
    let listUserData: Array<User> = [];

    switch (type) {
      case UserType.ADMINS:
        listUserData = admins;

        break;
      case UserType.BOTS:
        listUserData = bots;

        break;
      case UserType.USERS:
      default:
        listUserData = users;

        break;
    }

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-3 lg:tw-grid-cols-2 tw-gap-4"
          data-testid="user-card-container">
          {listUserData.map((user, index) => {
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
                // onClick={() => selectUser(User.id)}
              >
                {/* <UserDataCard
                  item={User}
                  onClick={() => {}}
                  onDelete={() => {}}
                /> */}
              </div>
            );
          })}
        </div>
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
              onClick={() => {
                // setErrorData(undefined);
                // handleAddUser(true);
              }}>
              Create New User
            </Button>
          </NonAdminAction>
        </div>
      </div>
      {getUserCards(activeUserTab as UserType)}
    </div>
  );
};

export default UserDetails;
