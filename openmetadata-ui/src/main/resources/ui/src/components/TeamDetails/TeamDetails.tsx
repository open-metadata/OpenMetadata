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

import { orderBy } from 'lodash';
import { ExtraInfo, FormErrorData } from 'Models';
import React, { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { OwnerType } from '../../enums/user.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import UserCard from '../../pages/teams/UserCard';
import { hasEditAccess } from '../../utils/CommonUtils';
import { getInfoElements } from '../../utils/EntityUtils';
import { getOwnerList } from '../../utils/ManageUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import TabsPane from '../common/TabsPane/TabsPane';
import ToggleSwitchV1 from '../common/toggle-switch/ToggleSwitchV1';
import DropDownList from '../dropdown/DropDownList';
import FormModal from '../Modals/FormModal';
import Form from './Form';

interface TeamDetailsProp {
  currentTeam: Team;
  currentTeamUsers: User[];
  teamUserPagin: Paging;
  currentTeamUserPage: number;
  teamUsersSearchText: string;
  isDescriptionEditable: boolean;
  errorNewTeamData: FormErrorData | undefined;
  isAddingTeam: boolean;
  handleAddTeam: (value: boolean) => void;
  onNewTeamDataChange: (
    data: Team,
    forceSet?: boolean
  ) => {
    [key: string]: string;
  };
  descriptionHandler: (value: boolean) => void;
  onDescriptionUpdate: (value: string) => void;
  handleTeamUsersSearchAction: (text: string) => void;
  updateTeamHandler: (data: Team) => void;
  createNewTeam: (data: Team) => void;
  teamUserPaginHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
}

const TeamDetails = ({
  currentTeam,
  currentTeamUsers,
  teamUserPagin,
  currentTeamUserPage,
  teamUsersSearchText,
  isDescriptionEditable,
  errorNewTeamData,
  isAddingTeam,
  handleAddTeam,
  createNewTeam,
  onNewTeamDataChange,
  updateTeamHandler,
  onDescriptionUpdate,
  descriptionHandler,
  handleTeamUsersSearchAction,
  teamUserPaginHandler,
}: TeamDetailsProp) => {
  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [currentTab, setCurrentTab] = useState(1);

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
  };

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

  const isActionAllowed = (operation = true) => {
    return isAdminUser || isAuthDisabled || operation || isOwner();
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      const updatedData: Team = {
        ...currentTeam,
        owner: {
          id: value,
          type: OwnerType.USER,
        },
      };

      updateTeamHandler(updatedData);
    }
    setShowOwnerDropdown(false);
  };

  const handleOpenToJoinToggle = () => {
    const updatedData: Team = {
      ...currentTeam,
      isJoinable: !currentTeam.isJoinable,
    };
    updateTeamHandler(updatedData);
  };

  const getJoinableWidget = () => {
    return isActionAllowed(userPermissions[Operation.UpdateTeam]) ? (
      <div className="tw-flex">
        <label htmlFor="join-team">Open to join</label>
        <ToggleSwitchV1
          checked={currentTeam.isJoinable as boolean}
          handleCheck={handleOpenToJoinToggle}
        />
      </div>
    ) : null;
  };

  /**
   * Check for current team users and return the user cards
   * @returns - user cards
   */
  const getUserCards = () => {
    if (currentTeamUsers.length <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>There are no users added yet.</p>
          {isAdminUser ||
          isAuthDisabled ||
          userPermissions[Operation.UpdateTeam] ? (
            <>
              <p>Would like to start adding some?</p>
              <Button
                className="tw-h-8 tw-rounded tw-my-2"
                size="small"
                theme="primary"
                variant="contained"
                // onClick={() => setIsAddingUsers(true)}
              >
                Add new user
              </Button>
            </>
          ) : null}
        </div>
      );
    }

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
                // onClick={() => {
                //   setErrorData(undefined);
                //   setIsAddingTeam(true);
                // }}
              >
                Add User
              </Button>
            </NonAdminAction>
          </div>
        </div>
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
                // onRemove={deleteUserHandler}
              />
            );
          })}
        </div>
        <NextPrevious
          currentPage={currentTeamUserPage}
          isNumberBased={Boolean(teamUsersSearchText)}
          pageSize={PAGE_SIZE}
          paging={teamUserPagin}
          pagingHandler={teamUserPaginHandler}
          totalCount={teamUserPagin.total}
        />
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

  return (
    <div>
      <Fragment>
        <div
          className="tw-flex tw-justify-between tw-items-center"
          data-testid="header">
          <div
            className="tw-heading tw-text-link tw-text-base tw-truncate tw-w-52"
            title={currentTeam?.displayName ?? currentTeam?.name}>
            {currentTeam?.displayName ?? currentTeam?.name}
          </div>
          <div className="tw-flex">
            {isActionAllowed() ? (
              <Fragment>
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
                      //   setErrorData(undefined);
                      handleAddTeam(true);
                    }}>
                    Create New Team
                  </Button>
                </NonAdminAction>
                <NonAdminAction
                  html={
                    <Fragment>
                      You do not have permission to delete the team.
                    </Fragment>
                  }
                  isOwner={isOwner()}
                  position="bottom">
                  <Button
                    className="tw-h-8 tw-rounded tw-ml-2"
                    data-testid="delete-team-button"
                    size="small"
                    theme="primary"
                    variant="outlined"
                    // onClick={() => deleteTeamHandler()}
                  >
                    Delete Team
                  </Button>
                </NonAdminAction>
              </Fragment>
            ) : (
              <Button
                className="tw-h-8 tw-px-2 tw-mb-4"
                data-testid="join-teams"
                size="small"
                theme="primary"
                variant="contained"
                // onClick={() => {
                //   setErrorData(undefined);
                //   setIsAddingTeam(true);
                // }}
              >
                Join Team
              </Button>
            )}
          </div>
        </div>
        <div className="tw-flex tw-items-center tw-gap-1 tw-mb-2">
          <span>{getInfoElements(extraInfo)}</span>
          {isActionAllowed() && (
            <span className="tw-relative">
              <Button
                className="tw-relative tw-pb-1"
                data-testid="owner-dropdown"
                size="custom"
                theme="primary"
                variant="link"
                onClick={() => setShowOwnerDropdown((visible) => !visible)}>
                <SVGIcons
                  alt="edit"
                  className="tw-ml-1"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </Button>

              {showOwnerDropdown && (
                <DropDownList
                  dropDownList={getOwnerList()}
                  groupType="tab"
                  listGroups={['Users']}
                  value={currentTeam.owner?.id}
                  onSelect={handleOwnerSelection}
                />
              )}
            </span>
          )}
        </div>
        <div>{getJoinableWidget()}</div>
        <div className="tw-mb-3 tw--ml-5" data-testid="description-container">
          <Description
            blurWithBodyBG
            description={currentTeam?.description || ''}
            entityName={currentTeam?.displayName ?? currentTeam?.name}
            isEdit={isDescriptionEditable}
            onCancel={() => descriptionHandler(false)}
            onDescriptionEdit={() => descriptionHandler(true)}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </div>
      </Fragment>

      <div className="tw-flex tw-flex-col tw-flex-grow">
        <TabsPane
          activeTab={currentTab}
          setActiveTab={(tab) => setCurrentTab(tab)}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw-pt-4">
          {currentTab === 1 && getUserCards()}

          {currentTab === 2 && getDatasetCards()}

          {currentTab === 3 && getDefaultRoles()}
        </div>
      </div>
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
    </div>
  );
};

export default TeamDetails;
