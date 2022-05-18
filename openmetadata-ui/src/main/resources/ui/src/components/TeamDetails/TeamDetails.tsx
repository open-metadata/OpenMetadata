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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { cloneDeep, isUndefined, orderBy } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import AppState from '../../AppState';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  PAGE_SIZE_MEDIUM,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { OwnerType } from '../../enums/user.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { Team } from '../../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import { TeamDetailsProp } from '../../interface/teamsAndUsers.interface';
import UserCard from '../../pages/teams/UserCard';
import { hasEditAccess } from '../../utils/CommonUtils';
import { getInfoElements } from '../../utils/EntityUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import TabsPane from '../common/TabsPane/TabsPane';
import Loader from '../Loader/Loader';
import ManageTab from '../ManageTab/ManageTab.component';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import FormModal from '../Modals/FormModal';
import Form from './Form';

const TeamDetails = ({
  hasAccess,
  teams,
  currentTeam,
  currentTeamUsers,
  teamUserPagin,
  currentTeamUserPage,
  teamUsersSearchText,
  isDescriptionEditable,
  errorNewTeamData,
  isAddingTeam,
  isTeamMemberLoading,
  handleAddTeam,
  createNewTeam,
  onNewTeamDataChange,
  updateTeamHandler,
  onDescriptionUpdate,
  descriptionHandler,
  handleTeamUsersSearchAction,
  teamUserPaginHandler,
  handleJoinTeamClick,
  handleLeaveTeamClick,
  handleAddUser,
  removeUserFromTeam,
  afterDeleteAction,
}: TeamDetailsProp) => {
  const history = useHistory();
  const DELETE_USER_INITIAL_STATE = {
    user: undefined,
    state: false,
    leave: false,
  };
  const { userPermissions } = useAuth();
  const [currentTab, setCurrentTab] = useState(1);
  const [isHeadingEditing, setIsHeadingEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>();
  const [heading, setHeading] = useState(
    currentTeam ? currentTeam.displayName : ''
  );
  const [deletingUser, setDeletingUser] = useState<{
    user: UserTeams | undefined;
    state: boolean;
    leave: boolean;
  }>(DELETE_USER_INITIAL_STATE);

  /**
   * Check if current team is the owner or not
   * @returns - True true or false based on hasEditAccess response
   */
  const isOwner = () => {
    return hasEditAccess(
      currentTeam?.owner?.type || '',
      currentTeam?.owner?.id || ''
    );
  };

  const tabs = [
    {
      name: 'Users',
      isProtected: false,
      position: 1,
      count: currentTeam?.users?.length,
    },
    {
      name: 'Assets',
      isProtected: false,
      position: 2,
      count: currentTeam?.owns?.length,
    },
    {
      name: 'Roles',
      isProtected: false,
      position: 3,
      count: currentTeam?.defaultRoles?.length,
    },
    {
      name: 'Manage',
      isProtected: false,
      isHidden: !(
        hasAccess ||
        isOwner() ||
        userPermissions[Operation.UpdateOwner]
      ),
      position: 4,
    },
  ];

  const extraInfo: ExtraInfo = {
    key: 'Owner',
    value:
      currentTeam?.owner?.type === 'team'
        ? getTeamAndUserDetailsPath(
            currentTeam?.owner?.displayName || currentTeam?.owner?.name || ''
          )
        : currentTeam?.owner?.displayName || currentTeam?.owner?.name || '',
    placeholderText:
      currentTeam?.owner?.displayName || currentTeam?.owner?.name || '',
    isLink: currentTeam?.owner?.type === 'team',
    openInNewTab: false,
    profileName:
      currentTeam?.owner?.type === OwnerType.USER
        ? currentTeam?.owner?.name
        : undefined,
  };

  const isActionAllowed = (operation = false) => {
    return hasAccess || isOwner() || operation;
  };

  const handleOpenToJoinToggle = (value: boolean) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        isJoinable: value,
      };
      updateTeamHandler(updatedData);
    }
  };

  const isAlreadyJoinedTeam = (teamId: string) => {
    if (currentUser) {
      return currentUser.teams?.find((team) => team.id === teamId);
    }

    return false;
  };

  const handleHeadingSave = () => {
    if (heading && currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        displayName: heading,
      };

      updateTeamHandler(updatedData);
      setIsHeadingEditing(false);
    }
  };

  const joinTeam = () => {
    if (currentUser && currentTeam) {
      const newTeams = cloneDeep(currentUser.teams ?? []);
      newTeams.push({
        id: currentTeam.id,
        type: OwnerType.TEAM,
        name: currentTeam.name,
      });

      const updatedData: User = {
        ...currentUser,
        teams: newTeams,
      };

      const options = compare(currentUser, updatedData);

      handleJoinTeamClick(currentUser.id, options);
    }
  };

  const leaveTeam = (): Promise<void> => {
    if (currentUser && currentTeam) {
      let newTeams = cloneDeep(currentUser.teams ?? []);
      newTeams = newTeams.filter((team) => team.id !== currentTeam.id);

      const updatedData: User = {
        ...currentUser,
        teams: newTeams,
      };

      const options = compare(currentUser, updatedData);

      return handleLeaveTeamClick(currentUser.id, options);
    }

    return Promise.reject();
  };

  const handleRemoveUser = () => {
    if (deletingUser.leave) {
      leaveTeam().then(() => {
        setDeletingUser(DELETE_USER_INITIAL_STATE);
      });
    } else {
      removeUserFromTeam(deletingUser.user?.id as string).then(() => {
        setDeletingUser(DELETE_USER_INITIAL_STATE);
      });
    }
  };

  const handleManageSave = (owner?: EntityReference) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        owner: !isUndefined(owner) ? owner : currentTeam.owner,
      };

      return updateTeamHandler(updatedData);
    }

    return Promise.reject();
  };

  /**
   * Redirects user to profile page.
   * @param name user name
   */
  const handleUserRedirection = (name: string) => {
    history.push(getUserPath(name));
  };

  useEffect(() => {
    if (currentTeam) {
      setHeading(currentTeam.displayName);
    }
  }, [currentTeam]);

  useEffect(() => {
    setCurrentUser(AppState.getCurrentUserDetails());
  }, [currentTeam, AppState.userDetails, AppState.nonSecureUserDetails]);

  /**
   * Take user id as input to find out the user data and set it for delete
   * @param id - user id
   * @param leave - if "Leave Team" action is in progress
   */
  const deleteUserHandler = (id: string, leave = false) => {
    const user = [...(currentTeam?.users as Array<UserTeams>)].find(
      (u) => u.id === id
    );
    setDeletingUser({ user, state: true, leave });
  };

  const removeUserBodyText = (leave: boolean) => {
    const text = leave
      ? `leave the team ${currentTeam?.displayName ?? currentTeam?.name}?`
      : `remove ${deletingUser.user?.displayName ?? deletingUser.user?.name}?`;

    return `Are you sure you want to ${text}`;
  };

  /**
   * Check for current team users and return the user cards
   * @returns - user cards
   */
  const getUserCards = () => {
    const sortedUser = orderBy(currentTeamUsers || [], ['name'], 'asc');

    return (
      <div>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3">
          <div className="tw-w-4/12">
            <Searchbar
              removeMargin
              placeholder="Search for user..."
              searchValue={teamUsersSearchText}
              typingInterval={500}
              onSearch={handleTeamUsersSearchAction}
            />
          </div>

          {currentTeamUsers.length > 0 && isActionAllowed() && (
            <div>
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <Button
                  className="tw-h-8 tw-px-2"
                  data-testid="add-teams"
                  size="small"
                  theme="primary"
                  variant="contained"
                  onClick={() => {
                    handleAddUser(true);
                  }}>
                  Add User
                </Button>
              </NonAdminAction>
            </div>
          )}
        </div>
        {isTeamMemberLoading ? (
          <Loader />
        ) : (
          <div>
            {currentTeamUsers.length <= 0 ? (
              <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
                <p>
                  There are no users{' '}
                  {teamUsersSearchText
                    ? `as ${teamUsersSearchText}.`
                    : `added yet.`}
                </p>
                {isActionAllowed(userPermissions[Operation.UpdateTeam]) ? (
                  <>
                    <p>Would like to start adding some?</p>
                    <Button
                      className="tw-h-8 tw-rounded tw-my-2"
                      size="small"
                      theme="primary"
                      variant="contained"
                      onClick={() => handleAddUser(true)}>
                      Add new user
                    </Button>
                  </>
                ) : null}
              </div>
            ) : (
              <Fragment>
                <div
                  className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4"
                  data-testid="user-card-container">
                  {sortedUser.map((user, index) => {
                    const User = {
                      displayName: user.displayName || user.name,
                      fqn: user.name || '',
                      type: 'user',
                      id: user.id,
                      name: user.name,
                    };

                    return (
                      <UserCard
                        isActionVisible
                        isIconVisible
                        item={User}
                        key={index}
                        onRemove={deleteUserHandler}
                        onTitleClick={handleUserRedirection}
                      />
                    );
                  })}
                </div>
                {teamUserPagin.total > PAGE_SIZE_MEDIUM && (
                  <NextPrevious
                    currentPage={currentTeamUserPage}
                    isNumberBased={Boolean(teamUsersSearchText)}
                    pageSize={PAGE_SIZE_MEDIUM}
                    paging={teamUserPagin}
                    pagingHandler={teamUserPaginHandler}
                    totalCount={teamUserPagin.total}
                  />
                )}
              </Fragment>
            )}
          </div>
        )}
      </div>
    );
  };

  /**
   * Check for current team datasets and return the dataset cards
   * @returns - dataset cards
   */
  const getDatasetCards = () => {
    if ((currentTeam?.owns?.length as number) <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>Your team does not have any dataset</p>
          <p>Would like to start adding some?</p>
          <Link to="/explore">
            <Button
              className="tw-h-8 tw-rounded tw-mb-2 tw-text-white"
              size="small"
              theme="primary"
              variant="contained">
              Explore
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <>
        <div
          className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
          data-testid="dataset-card">
          {' '}
          {currentTeam?.owns?.map((dataset, index) => {
            const Dataset = {
              displayName: dataset.displayName || dataset.name || '',
              type: dataset.type,
              fqn: dataset.fullyQualifiedName || '',
              id: dataset.id,
              name: dataset.name,
            };

            return (
              <UserCard isDataset isIconVisible item={Dataset} key={index} />
            );
          })}
        </div>
      </>
    );
  };

  const teamActionButton = (alreadyJoined: boolean, isJoinable: boolean) => {
    return alreadyJoined ? (
      isJoinable || hasAccess ? (
        <Button
          className="tw-h-8 tw-px-2 tw-mb-4 tw-ml-2"
          data-testid="join-teams"
          size="small"
          theme="primary"
          variant="contained"
          onClick={joinTeam}>
          Join Team
        </Button>
      ) : null
    ) : (
      <Button
        className="tw-h-8 tw-rounded tw-ml-2"
        data-testid="delete-team-button"
        size="small"
        theme="primary"
        variant="outlined"
        onClick={() => currentUser && deleteUserHandler(currentUser.id, true)}>
        Leave Team
      </Button>
    );
  };

  /**
   * Check for team default role and return roles card
   * @returns - roles card
   */
  const getDefaultRoles = () => {
    if ((currentTeam?.defaultRoles?.length as number) === 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>There are no roles assigned yet.</p>
        </div>
      );
    }

    return (
      <div
        className="tw-grid xxl:tw-grid-cols-4 md:tw-grid-cols-3 tw-gap-4"
        data-testid="teams-card">
        {currentTeam?.defaultRoles?.map((role, i) => {
          const roleData = {
            displayName: role.displayName || role.name || '',
            fqn: role.fullyQualifiedName as string,
            type: role.type,
            id: role.id,
            name: role.name,
          };

          return <UserCard isIconVisible item={roleData} key={i} />;
        })}
      </div>
    );
  };

  const getTeamHeading = () => {
    return (
      <div
        className="tw-heading tw-text-link tw-text-base tw-truncate tw-w-120"
        title={heading}>
        {isHeadingEditing ? (
          <div className="tw-flex tw-items-center tw-gap-1">
            <input
              className="tw-form-inputs tw-px-3 tw-py-0.5 tw-w-64"
              data-testid="synonyms"
              id="synonyms"
              name="synonyms"
              placeholder="Enter comma seprated term"
              type="text"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
            />
            <div className="tw-flex tw-justify-end" data-testid="buttons">
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                data-testid="cancelAssociatedTag"
                size="custom"
                theme="primary"
                variant="contained"
                onMouseDown={() => setIsHeadingEditing(false)}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
              </Button>
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                data-testid="saveAssociatedTag"
                size="custom"
                theme="primary"
                variant="contained"
                onMouseDown={handleHeadingSave}>
                <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="tw-flex tw-group">
            <span>{heading}</span>
            {isActionAllowed() && (
              <div className={classNames('tw-w-5 tw-min-w-max')}>
                <NonAdminAction
                  position="right"
                  title={TITLE_FOR_NON_ADMIN_ACTION}>
                  <button
                    className="tw-ml-2 focus:tw-outline-none"
                    data-testid="edit-synonyms"
                    onClick={() => setIsHeadingEditing(true)}>
                    <SVGIcons
                      alt="edit"
                      icon="icon-edit"
                      title="Edit"
                      width="12px"
                    />
                  </button>
                </NonAdminAction>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="tw-h-full tw-flex tw-flex-col tw-flex-grow">
      {teams.length && currentTeam ? (
        <Fragment>
          <div
            className="tw-flex tw-justify-between tw-items-center"
            data-testid="header">
            {getTeamHeading()}
            <div className="tw-flex">
              {!isUndefined(currentUser) &&
                teamActionButton(
                  !isAlreadyJoinedTeam(currentTeam.id),
                  currentTeam.isJoinable || false
                )}
            </div>
          </div>
          <div className="tw-flex tw-items-center tw-gap-1 tw-mb-2">
            <span>{getInfoElements(extraInfo)}</span>
          </div>
          <div className="tw-mb-3 tw--ml-5" data-testid="description-container">
            <Description
              blurWithBodyBG
              description={currentTeam?.description || ''}
              entityName={currentTeam?.displayName ?? currentTeam?.name}
              hasEditAccess={isActionAllowed(
                userPermissions[Operation.UpdateDescription]
              )}
              isEdit={isDescriptionEditable}
              onCancel={() => descriptionHandler(false)}
              onDescriptionEdit={() => descriptionHandler(true)}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>

          <div className="tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={currentTab}
              className="tw-px-6"
              setActiveTab={(tab) => setCurrentTab(tab)}
              tabs={tabs}
            />

            <div className="tw-flex-grow tw-flex tw-flex-col tw-pt-4">
              {currentTab === 1 && getUserCards()}

              {currentTab === 2 && getDatasetCards()}

              {currentTab === 3 && getDefaultRoles()}

              {currentTab === 4 && (
                <div className="tw-bg-white tw-shadow-md tw-py-4 tw-flex-grow">
                  <ManageTab
                    allowDelete
                    allowSoftDelete
                    hasEditAccess
                    hideTier
                    afterDeleteAction={afterDeleteAction}
                    allowTeamOwner={false}
                    currentUser={currentTeam.owner}
                    entityId={currentTeam.id}
                    entityName={currentTeam.displayName || currentTeam.name}
                    entityType="team"
                    handleIsJoinable={handleOpenToJoinToggle}
                    isJoinable={currentTeam.isJoinable}
                    manageSectionType="Team"
                    onSave={handleManageSave}
                  />
                </div>
              )}
            </div>
          </div>
        </Fragment>
      ) : (
        <ErrorPlaceHolder>
          <p className="tw-text-lg tw-text-center">No Teams Added.</p>
          <div className="tw-text-lg tw-text-center">
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                disabled={!isActionAllowed()}
                size="small"
                theme="primary"
                variant="outlined"
                onClick={() => handleAddTeam(true)}>
                Click here
              </Button>
            </NonAdminAction>
            {' to add new Team'}
          </div>
        </ErrorPlaceHolder>
      )}

      {isAddingTeam && (
        <FormModal
          errorData={errorNewTeamData}
          form={Form}
          header="Adding new team"
          initialData={{
            name: '',
            description: '',
            displayName: '',
          }}
          onCancel={() => handleAddTeam(false)}
          onChange={(data) => onNewTeamDataChange(data as Team)}
          onSave={(data) => createNewTeam(data as Team)}
        />
      )}

      {deletingUser.state && (
        <ConfirmationModal
          bodyText={removeUserBodyText(deletingUser.leave)}
          cancelText="Cancel"
          confirmText="Confirm"
          header={deletingUser.leave ? 'Leave team' : 'Removing user'}
          onCancel={() => setDeletingUser(DELETE_USER_INITIAL_STATE)}
          onConfirm={handleRemoveUser}
        />
      )}
    </div>
  );
};

export default TeamDetails;
