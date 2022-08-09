/*
 *  Copyright 2022 Collate
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
import {
  Button as ButtonAntd,
  Col,
  Row,
  Space,
  Switch,
  Table,
  Tooltip,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, isUndefined, orderBy } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip as TooltipTippy } from 'react-tippy';
import AppState from '../../AppState';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  PAGE_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
  TITLE_FOR_NON_OWNER_ACTION,
} from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import { EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { Team, TeamType } from '../../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import { TeamDetailsProp } from '../../interface/teamsAndUsers.interface';
import UserCard from '../../pages/teams/UserCard';
import {
  getEntityName,
  getTeamsText,
  hasEditAccess,
} from '../../utils/CommonUtils';
import { filterEntityAssets } from '../../utils/EntityUtils';
import { hasPemission } from '../../utils/PermissionsUtils';
import { getSettingPath, getTeamsWithFqnPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import Description from '../common/description/Description';
import Ellipses from '../common/Ellipses/Ellipses';
import EntitySummaryDetails from '../common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import TabsPane from '../common/TabsPane/TabsPane';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';

const TeamDetailsV1 = ({
  hasAccess,
  currentTeam,
  currentTeamUsers,
  teamUserPagin,
  currentTeamUserPage,
  teamUsersSearchText,
  isDescriptionEditable,
  isTeamMemberLoading,
  handleAddTeam,
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
  const isOrganization =
    currentTeam.name === TeamType.Organization.toLowerCase();
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
  const [showAction, setShowAction] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [table, setTable] = useState<EntityReference[]>([]);
  const [slashedDatabaseName, setSlashedDatabaseName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

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

  const tabs = [
    {
      name: 'Teams',
      isProtected: false,
      position: 1,
      count: currentTeam.children?.length || 0,
    },
    {
      name: 'Users',
      isProtected: false,
      position: 2,
      count: teamUserPagin?.total,
    },
    {
      name: 'Assets',
      isProtected: false,
      position: 3,
      count: filterEntityAssets(currentTeam?.owns || []).length,
    },
    {
      name: 'Roles',
      isProtected: false,
      position: 4,
      count: currentTeam?.defaultRoles?.length,
    },
  ];

  const columns: ColumnsType<User> = useMemo(() => {
    return [
      {
        title: 'Username',
        dataIndex: 'username',
        key: 'username',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getUserPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Email',
        dataIndex: 'email',
        key: 'email',
      },
      {
        title: 'Teams',
        dataIndex: 'teams',
        key: 'teams',
        render: (teams: EntityReference[]) => getTeamsText(teams),
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="tw-w-full tw-justify-center"
            size={8}>
            <Tooltip placement="bottom" title="Remove">
              <ButtonAntd
                icon={
                  <SVGIcons
                    alt="Remove"
                    className="tw-w-4"
                    icon={Icons.DELETE}
                  />
                }
                type="text"
                onClick={() => deleteUserHandler(record.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, []);

  const manageButtonContent = () => {
    return (
      <div
        className="tw-flex tw-items-center tw-gap-5 tw-p-1.5 tw-cursor-pointer"
        id="manage-button"
        onClick={() => setIsDelete(true)}>
        <div>
          <SVGIcons
            alt="Delete"
            className="tw-w-12"
            icon={Icons.DELETE_GRADIANT}
          />
        </div>
        <div className="tw-text-left" data-testid="delete-button">
          <p className="tw-font-medium">
            Delete Team “{getEntityName(currentTeam)}”
          </p>
          <p className="tw-text-grey-muted tw-text-xs">
            Deleting this Team {getEntityName(currentTeam)} will permanently
            remove its metadata from OpenMetadata.
          </p>
        </div>
      </div>
    );
  };

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

  const updateOwner = (owner?: EntityReference) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        owner: !isUndefined(owner) ? owner : currentTeam.owner,
      };

      return updateTeamHandler(updatedData);
    }

    return Promise.reject();
  };

  const handleTeamSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setTable(
        currentTeam.children?.filter(
          (team) =>
            team?.name?.toLowerCase().includes(value.toLowerCase()) ||
            team?.displayName?.toLowerCase().includes(value.toLowerCase())
        ) || []
      );
    } else {
      setTable(currentTeam.children ?? []);
    }
  };

  useEffect(() => {
    if (currentTeam) {
      const perents =
        currentTeam?.parents && !isOrganization
          ? currentTeam?.parents.map((parent) => ({
              name: getEntityName(parent),
              url: getTeamsWithFqnPath(
                parent.name || parent.fullyQualifiedName || ''
              ),
            }))
          : [];
      const breadcrumb = [
        {
          name: 'Team',
          url: getSettingPath(
            GlobalSettingsMenuCategory.ACCESS,
            GlobalSettingOptions.TEAMS
          ),
        },
        ...perents,
        {
          name: getEntityName(currentTeam),
          url: '',
        },
      ];
      setSlashedDatabaseName(breadcrumb);
      setHeading(currentTeam.displayName);
      setTable(currentTeam.children ?? []);
    }
  }, [currentTeam]);

  useEffect(() => {
    setCurrentUser(AppState.getCurrentUserDetails());
  }, [currentTeam, AppState.userDetails, AppState.nonSecureUserDetails]);

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
                isOwner={isActionAllowed()}
                position="bottom"
                title={TITLE_FOR_NON_OWNER_ACTION}>
                <Button
                  className="tw-h-8 tw-px-2"
                  data-testid="add-user"
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
                {isActionAllowed(
                  hasPemission(
                    Operation.EditUsers,
                    EntityType.TEAM,
                    userPermissions
                  )
                ) ? (
                  <>
                    <p>Would like to start adding some?</p>
                    <Button
                      className="tw-h-8 tw-rounded tw-my-2"
                      data-testid="add-new-user"
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
                <Table
                  className="teams-list-table"
                  columns={columns}
                  dataSource={sortedUser}
                  pagination={false}
                  size="small"
                />
                {teamUserPagin.total > PAGE_SIZE && (
                  <NextPrevious
                    currentPage={currentTeamUserPage}
                    isNumberBased={Boolean(teamUsersSearchText)}
                    pageSize={PAGE_SIZE}
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
    const ownData = filterEntityAssets(currentTeam?.owns || []);

    if (ownData.length <= 0) {
      return (
        <div className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1">
          <p>Your team does not have any assets</p>
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
          {ownData.map((dataset, index) => {
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
        data-testid="leave-team-button"
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
      <div className="tw-heading tw-text-link tw-text-base tw-mb-0">
        {isHeadingEditing ? (
          <div className="tw-flex tw-items-center tw-gap-1">
            <input
              className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-64"
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
          <div className="tw-flex tw-group" data-testid="team-heading">
            <Ellipses tooltip rows={1}>
              {heading}
            </Ellipses>
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
                      width="16px"
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
    <div
      className="tw-h-full tw-flex tw-flex-col tw-flex-grow"
      data-testid="team-details-container">
      {!isEmpty(currentTeam) ? (
        <Fragment>
          <TitleBreadcrumb titleLinks={slashedDatabaseName} />
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
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <Button
                  className="tw-h-8 tw-rounded tw-mb-1 tw-ml-2 tw-flex"
                  data-testid="manage-button"
                  disabled={!hasAccess}
                  size="small"
                  theme="primary"
                  variant="outlined"
                  onClick={() => setIsDelete(true)}>
                  <TooltipTippy
                    arrow
                    arrowSize="big"
                    disabled={!hasAccess}
                    html={manageButtonContent()}
                    open={showAction}
                    position="bottom-end"
                    theme="light"
                    onRequestClose={() => setShowAction(false)}>
                    <span>
                      <FontAwesomeIcon icon="ellipsis-vertical" />
                    </span>
                  </TooltipTippy>
                </Button>
              </NonAdminAction>
            </div>
          </div>
          <div className="tw-mb-3">
            <Switch
              checked={currentTeam.isJoinable}
              className="tw-mr-2"
              size="small"
              title="Open Group"
              onChange={handleOpenToJoinToggle}
            />
            <span>Open Group</span>
          </div>
          <EntitySummaryDetails data={extraInfo} updateOwner={updateOwner} />
          <div
            className="tw-mb-3 tw--ml-5 tw-mt-2"
            data-testid="description-container">
            <Description
              blurWithBodyBG
              description={currentTeam?.description || ''}
              entityName={currentTeam?.displayName ?? currentTeam?.name}
              hasEditAccess={isOwner()}
              isEdit={isDescriptionEditable}
              onCancel={() => descriptionHandler(false)}
              onDescriptionEdit={() => descriptionHandler(true)}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>

          <div className="tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={currentTab}
              setActiveTab={(tab) => setCurrentTab(tab)}
              tabs={tabs}
            />

            <div className="tw-flex-grow tw-flex tw-flex-col tw-pt-4">
              {currentTab === 1 && (
                <Row className="team-list-container" gutter={[16, 16]}>
                  <Col span={8}>
                    <Searchbar
                      removeMargin
                      placeholder="Search for team..."
                      searchValue={searchTerm}
                      typingInterval={500}
                      onSearch={handleTeamSearch}
                    />
                  </Col>
                  <Col span={16}>
                    <Space
                      align="end"
                      className="tw-w-full"
                      direction="vertical">
                      <ButtonAntd
                        type="primary"
                        onClick={() => handleAddTeam(true)}>
                        Add Team
                      </ButtonAntd>
                    </Space>
                  </Col>
                  <Col span={24}>
                    <TeamHierarchy data={table as Team[]} />
                  </Col>
                </Row>
              )}
              {currentTab === 2 && getUserCards()}

              {currentTab === 3 && getDatasetCards()}

              {currentTab === 4 && getDefaultRoles()}
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

      <DeleteWidgetModal
        afterDeleteAction={afterDeleteAction}
        entityId={currentTeam.id}
        entityName={currentTeam.fullyQualifiedName || currentTeam.name}
        entityType="team"
        visible={isDelete}
        onCancel={() => setIsDelete(false)}
      />
    </div>
  );
};

export default TeamDetailsV1;
