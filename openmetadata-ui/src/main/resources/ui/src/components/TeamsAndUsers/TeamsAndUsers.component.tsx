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

import { capitalize } from 'lodash';
import React from 'react';
import { UserType } from '../../enums/user.enum';
import { TeamsAndUsersProps } from '../../interface/teamsAndUsers.interface';
import { getActiveCatClass, getCountBadge } from '../../utils/CommonUtils';
import { getActiveUsers } from '../../utils/TeamUtils';
import PageLayout from '../containers/PageLayout';
import TeamDetails from '../TeamDetails/TeamDetails';
import UserDetails from '../UserDetails/UserDetails';

const TeamsAndUsers = ({
  users,
  admins,
  bots,
  activeUserTab,
  userSearchTerm,
  selectedUserList,
  handleUserSearchTerm,
  handleDeleteUser,
  handleJoinTeamClick,
  hasAccess,
  isTeamVisible,
  teams,
  currentTeam,
  currentTeamUsers,
  teamUserPagin,
  currentTeamUserPage,
  teamUsersSearchText,
  isDescriptionEditable,
  errorNewTeamData,
  isAddingTeam,
  createNewTeam,
  handleAddNewUser,
  handleAddTeam,
  onNewTeamDataChange,
  updateTeamHandler,
  onDescriptionUpdate,
  descriptionHandler,
  handleTeamUsersSearchAction,
  teamUserPaginHandler,
  changeCurrentTeam,
  isAddingUsers,
  getUniqueUserList,
  addUsersToTeam,
  handleAddUser,
  removeUserFromTeam,
}: TeamsAndUsersProps) => {
  const usersData = [
    {
      name: UserType.USERS,
      data: users,
    },
    {
      name: UserType.ADMINS,
      data: admins,
    },
    {
      name: UserType.BOTS,
      data: bots,
    },
  ];

  /**
   *
   * @returns - Teams data for left panel
   */
  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-mb-8">
          <div className="tw-mb-2 tw-border-b">
            <p className="tw-heading">Teams</p>
          </div>
          {teams.map((team) => (
            <div
              className="tw-flex tw-items-center tw-justify-between tw-mb-2 tw-cursor-pointer"
              key={team.name}
              onClick={() => {
                changeCurrentTeam(team.name, false);
              }}>
              <div
                className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-flex tw-justify-between ${getActiveCatClass(
                  team.name,
                  currentTeam?.name
                )}`}>
                <p
                  className="tag-category label-category tw-self-center tw-truncate tw-w-52"
                  title={team.displayName ?? team.name}>
                  {team.displayName ?? team.name}
                </p>
              </div>
              {getCountBadge(
                getActiveUsers(team.users).length,
                '',
                currentTeam?.name === team.name
              )}
            </div>
          ))}
        </div>
        {hasAccess && (
          <div>
            <div className="tw-mb-2 tw-border-b">
              <p className="tw-heading">All Users</p>
            </div>
            {usersData.map((d) => (
              <div
                className="tw-flex tw-items-center tw-justify-between tw-mb-2 tw-cursor-pointer"
                key={d.name}
                onClick={() => {
                  changeCurrentTeam(d.name, true);
                }}>
                <div
                  className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-flex tw-justify-between ${getActiveCatClass(
                    d.name,
                    activeUserTab
                  )}`}>
                  <p
                    className="tag-category label-category tw-self-center tw-truncate tw-w-52"
                    title={capitalize(d.name)}>
                    {capitalize(d.name)}
                  </p>
                </div>
                {getCountBadge(d.data.length, '', activeUserTab === d.name)}
              </div>
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <PageLayout classes="tw-h-full tw-p-4" leftPanel={fetchLeftPanel()}>
      <div
        className="tw-pb-3 tw-w-full tw-h-full tw-flex tw-flex-col"
        data-testid="team-and-user-container">
        {!isTeamVisible ? (
          <UserDetails
            handleAddNewUser={handleAddNewUser}
            handleDeleteUser={handleDeleteUser}
            handleUserSearchTerm={handleUserSearchTerm}
            selectedUserList={selectedUserList}
            userSearchTerm={userSearchTerm}
          />
        ) : (
          <TeamDetails
            addUsersToTeam={addUsersToTeam}
            createNewTeam={createNewTeam}
            currentTeam={currentTeam}
            currentTeamUserPage={currentTeamUserPage}
            currentTeamUsers={currentTeamUsers}
            descriptionHandler={descriptionHandler}
            errorNewTeamData={errorNewTeamData}
            getUniqueUserList={getUniqueUserList}
            handleAddTeam={handleAddTeam}
            handleAddUser={handleAddUser}
            handleJoinTeamClick={handleJoinTeamClick}
            handleTeamUsersSearchAction={handleTeamUsersSearchAction}
            hasAccess={hasAccess}
            isAddingTeam={isAddingTeam}
            isAddingUsers={isAddingUsers}
            isDescriptionEditable={isDescriptionEditable}
            removeUserFromTeam={removeUserFromTeam}
            teamUserPagin={teamUserPagin}
            teamUserPaginHandler={teamUserPaginHandler}
            teamUsersSearchText={teamUsersSearchText}
            teams={teams}
            updateTeamHandler={updateTeamHandler}
            onDescriptionUpdate={onDescriptionUpdate}
            onNewTeamDataChange={onNewTeamDataChange}
          />
        )}
      </div>
    </PageLayout>
  );
};

export default TeamsAndUsers;
