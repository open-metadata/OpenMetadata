/*
 *  Copyright 2022 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Modal, Row, Space, Switch, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import TableDataCardV2 from 'components/common/table-data-card-v2/TableDataCardV2';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { SearchIndex } from 'enums/search.enum';
import { compare } from 'fast-json-patch';
import {
  cloneDeep,
  isEmpty,
  isNil,
  isUndefined,
  lowerCase,
  uniqueId,
} from 'lodash';
import { ExtraInfo } from 'Models';
import AddAttributeModal from 'pages/RolesPage/AddAttributeModal/AddAttributeModal';
import Qs from 'qs';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { getSuggestions } from 'rest/miscAPI';
import { restoreTeam } from 'rest/teamsAPI';
import AppState from '../../AppState';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  LIST_SIZE,
  ROUTES,
} from '../../constants/constants';
import { ROLE_DOCS, TEAMS_DOCS } from '../../constants/docs.constants';
import { EntityType } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { Team, TeamType } from '../../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import {
  AddAttribute,
  TeamDetailsProp,
} from '../../interface/teamsAndUsers.interface';
import { getCountBadge, hasEditAccess } from '../../utils/CommonUtils';
import { filterEntityAssets, getEntityName } from '../../utils/EntityUtils';
import {
  checkPermission,
  DEFAULT_ENTITY_PERMISSION,
} from '../../utils/PermissionsUtils';
import { getTeamsWithFqnPath } from '../../utils/RouterUtils';
import {
  filterChildTeams,
  getDeleteMessagePostFix,
} from '../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import Description from '../common/description/Description';
import ManageButton from '../common/entityPageInfo/ManageButton/ManageButton';
import EntitySummaryDetails from '../common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import Searchbar from '../common/searchbar/Searchbar';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import ListEntities from './RolesAndPoliciesList';
import { TeamsPageTab } from './team.interface';
import {
  fetchErrorPlaceHolder,
  getExtraDropdownContent,
  getTabs,
} from './TeamDetailsV1.utils';
import TeamHeading from './TeamHeading';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';
import UserCards from './UserCards';

const TeamDetailsV1 = ({
  assets,
  hasAccess,
  currentTeam,
  currentTeamUsers,
  teamUserPaging,
  currentTeamUserPage,
  teamUsersSearchText,
  isDescriptionEditable,
  isTeamMemberLoading,
  childTeams,
  onTeamExpand,
  handleAddTeam,
  updateTeamHandler,
  onDescriptionUpdate,
  descriptionHandler,
  showDeletedTeam,
  onShowDeletedTeamChange,
  handleTeamUsersSearchAction,
  handleCurrentUserPage,
  teamUserPagingHandler,
  handleJoinTeamClick,
  handleLeaveTeamClick,
  handleAddUser,
  removeUserFromTeam,
  afterDeleteAction,
  onAssetsPaginate,
  parentTeams,
}: TeamDetailsProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();

  const { activeTab } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeTab: TeamsPageTab };
  }, [location.search]);
  const isOrganization = currentTeam.name === TeamType.Organization;
  const isGroupType = currentTeam.teamType === TeamType.Group;
  const DELETE_USER_INITIAL_STATE = {
    user: undefined,
    state: false,
    leave: false,
  };
  const { permissions, getEntityPermission } = usePermissionProvider();
  const currentTab = useMemo(() => {
    if (activeTab) {
      return activeTab;
    }

    return isGroupType ? TeamsPageTab.USERS : TeamsPageTab.TEAMS;
  }, [activeTab, isGroupType]);
  const [currentUser, setCurrentUser] = useState<User>();
  const [deletingUser, setDeletingUser] = useState<{
    user: UserTeams | undefined;
    state: boolean;
    leave: boolean;
  }>(DELETE_USER_INITIAL_STATE);
  const [searchTerm, setSearchTerm] = useState('');
  const [table, setTable] = useState<Team[]>([]);
  const [slashedDatabaseName, setSlashedDatabaseName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [addAttribute, setAddAttribute] = useState<AddAttribute>();
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedEntity, setEntity] = useState<{
    attribute: 'defaultRoles' | 'policies';
    record: EntityReference;
  }>();
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isModalLoading, setIsModalLoading] = useState<boolean>(false);

  const addPolicy = t('label.add-entity', {
    entity: t('label.policy'),
  });

  const addRole = t('label.add-entity', {
    entity: t('label.role'),
  });

  const addTeam = t('label.add-entity', { entity: t('label.team') });

  const teamCount = useMemo(
    () =>
      isOrganization && currentTeam && currentTeam.childrenCount
        ? currentTeam.childrenCount + 1
        : table.length,
    [table, isOrganization, currentTeam.childrenCount]
  );
  const updateActiveTab = (key: string) => {
    history.push({ search: Qs.stringify({ activeTab: key }) });
  };

  const tabs = useMemo(() => {
    const allTabs = getTabs(
      currentTeam,
      teamUserPaging,
      isGroupType,
      isOrganization,
      teamCount
    ).map((tab) => ({
      ...tab,
      label: (
        <div data-testid={`${lowerCase(tab.key)}-tab`}>
          {tab.name}
          <span className="p-l-xs">
            {!isNil(tab.count)
              ? getCountBadge(tab.count, '', currentTab === tab.key)
              : getCountBadge()}
          </span>
        </div>
      ),
    }));

    return allTabs;
  }, [currentTeam, teamUserPaging, searchTerm, teamCount, currentTab]);

  const createTeamPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.TEAM, permissions),
    [permissions]
  );

  /**
   * Check if current team is the owner or not
   * @returns - True true or false based on hasEditAccess response
   */
  const isOwner = useMemo(() => {
    return hasEditAccess(
      currentTeam?.owner?.type || '',
      currentTeam?.owner?.id || ''
    );
  }, [currentTeam]);

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

  const ownerValue = useMemo(() => {
    switch (currentTeam.owner?.type) {
      case 'team':
        return getTeamAndUserDetailsPath(currentTeam.owner?.name || '');
      case 'user':
        return getUserPath(currentTeam.owner?.fullyQualifiedName ?? '');
      default:
        return '';
    }
  }, [currentTeam]);

  const extraInfo: ExtraInfo[] = [
    {
      key: 'Owner',
      value: ownerValue,
      placeholderText:
        currentTeam?.owner?.displayName || currentTeam?.owner?.name || '',
      isLink: true,
      openInNewTab: false,
      profileName:
        currentTeam?.owner?.type === OwnerType.USER
          ? currentTeam?.owner?.name
          : undefined,
    },
    ...(isOrganization
      ? []
      : [
          {
            key: 'TeamType',
            value: currentTeam.teamType || '',
          },
        ]),
  ];

  const searchTeams = async (text: string) => {
    try {
      const res = await getSuggestions<SearchIndex.TEAM>(
        text,
        SearchIndex.TEAM
      );
      const data = res.data.suggest['metadata-suggest'][0].options.map(
        (value) => value._source as Team
      );

      setTable(data);
    } catch (error) {
      setTable([]);
    }
  };

  const isActionAllowed = useMemo(
    (operation = false) => {
      return hasAccess || isOwner || operation;
    },
    [hasAccess, isOwner]
  );

  const handleOpenToJoinToggle = () => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        isJoinable: !currentTeam.isJoinable,
      };
      updateTeamHandler(updatedData, false);
    }
  };

  const isAlreadyJoinedTeam = (teamId: string) => {
    if (currentUser) {
      return currentUser.teams?.find((team) => team.id === teamId);
    }

    return false;
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

  const updateOwner = useCallback(
    (owner?: EntityReference) => {
      if (currentTeam) {
        const updatedData: Team = {
          ...currentTeam,
          owner,
        };

        return updateTeamHandler(updatedData);
      }

      return Promise.reject();
    },
    [currentTeam]
  );

  const updateTeamType = (type: TeamType) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        teamType: type,
      };

      return updateTeamHandler(updatedData);
    }

    return;
  };

  const handleTeamSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      searchTeams(value);
    } else {
      setTable(filterChildTeams(childTeams ?? [], showDeletedTeam));
    }
  };

  const handleAddAttribute = async (selectedIds: string[]) => {
    if (addAttribute) {
      setIsModalLoading(true);
      let updatedTeamData = { ...currentTeam };
      const updatedData = selectedIds.map((id) => {
        const existingData = addAttribute.selectedData.find(
          (data) => data.id === id
        );

        return existingData ? existingData : { id, type: addAttribute.type };
      });

      switch (addAttribute.type) {
        case EntityType.ROLE:
          updatedTeamData = { ...updatedTeamData, defaultRoles: updatedData };

          break;

        case EntityType.POLICY:
          updatedTeamData = { ...updatedTeamData, policies: updatedData };

          break;

        default:
          break;
      }
      await updateTeamHandler(updatedTeamData);
      setAddAttribute(undefined);
      setIsModalLoading(false);
    }
  };

  const handleAttributeDelete = async (
    record: EntityReference,
    attribute: 'defaultRoles' | 'policies'
  ) => {
    setIsModalLoading(true);
    const attributeData =
      (currentTeam[attribute as keyof Team] as EntityReference[]) ?? [];
    const updatedAttributeData = attributeData.filter(
      (attrData) => attrData.id !== record.id
    );

    const updatedTeamData = {
      ...currentTeam,
      [attribute]: updatedAttributeData,
    };
    await updateTeamHandler(updatedTeamData);
    setIsModalLoading(false);
  };

  const handleReactiveTeam = async () => {
    try {
      const res = await restoreTeam(currentTeam.id);
      if (res) {
        afterDeleteAction();
        showSuccessToast(
          t('message.entity-restored-success', {
            entity: t('label.team'),
          })
        );
      } else {
        throw t('message.entity-restored-error', {
          entity: t('label.team'),
        });
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.entity-restored-error', {
          entity: t('label.team'),
        })
      );
    }
  };

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const perms = await getEntityPermission(
        ResourceEntity.TEAM,
        currentTeam.id
      );
      setEntityPermissions(perms);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.user-permission-plural'),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    !isEmpty(currentTeam) && fetchPermissions();
  }, [currentTeam]);

  useEffect(() => {
    if (currentTeam) {
      const parents =
        parentTeams && !isOrganization
          ? parentTeams.map((parent) => ({
              name: getEntityName(parent),
              url: getTeamsWithFqnPath(
                parent.name || parent.fullyQualifiedName || ''
              ),
            }))
          : [];
      const breadcrumb = [
        ...parents,
        {
          name: getEntityName(currentTeam),
          url: '',
        },
      ];
      setSlashedDatabaseName(breadcrumb);
    }
  }, [currentTeam, parentTeams, showDeletedTeam]);

  useEffect(() => {
    setTable(filterChildTeams(childTeams ?? [], showDeletedTeam));
    setSearchTerm('');
  }, [childTeams, showDeletedTeam]);

  useEffect(() => {
    setCurrentUser(AppState.getCurrentUserDetails());
  }, [currentTeam, AppState.userDetails, AppState.nonSecureUserDetails]);

  useEffect(() => {
    handleCurrentUserPage();
  }, []);

  const removeUserBodyText = (leave: boolean) => {
    const text = leave
      ? t('message.leave-the-team-team-name', {
          teamName: currentTeam?.displayName ?? currentTeam?.name,
        })
      : t('label.remove-entity', {
          entity: deletingUser.user?.displayName ?? deletingUser.user?.name,
        });

    return t('message.are-you-sure-want-to-text', { text });
  };

  /**
   * Check for current team datasets and return the dataset cards
   * @returns - dataset cards
   */
  const getAssetDetailCards = () => {
    const ownData = filterEntityAssets(currentTeam?.owns || []);

    if (isEmpty(ownData)) {
      return fetchErrorPlaceHolder({
        type: ERROR_PLACEHOLDER_TYPE.ASSIGN,
        heading: t('label.asset'),
        permission: entityPermissions.EditAll,
        button: (
          <Button
            ghost
            className="p-x-lg"
            data-testid="add-placeholder-button"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => history.push(ROUTES.EXPLORE)}>
            {t('label.add')}
          </Button>
        ),
      });
    }

    return (
      <div data-testid="table-container">
        {assets.data.map(({ _source, _id = '' }) => (
          <TableDataCardV2
            className="m-b-sm cursor-pointer"
            id={_id}
            key={_id}
            source={_source}
          />
        ))}
        {assets.total > LIST_SIZE && assets.data.length > 0 && (
          <NextPrevious
            isNumberBased
            currentPage={assets.currPage}
            pageSize={LIST_SIZE}
            paging={{} as Paging}
            pagingHandler={onAssetsPaginate}
            totalCount={assets.total}
          />
        )}
      </div>
    );
  };

  const teamActionButton = (isAlreadyJoined: boolean, isJoinable: boolean) => {
    if (isOrganization) {
      return null;
    }
    if (isAlreadyJoined) {
      return (
        <Button
          ghost
          data-testid="leave-team-button"
          type="primary"
          onClick={() =>
            currentUser && deleteUserHandler(currentUser.id, true)
          }>
          {t('label.leave-team')}
        </Button>
      );
    } else {
      return isJoinable || hasAccess ? (
        <Button data-testid="join-teams" type="primary" onClick={joinTeam}>
          {t('label.join-team')}
        </Button>
      ) : null;
    }
  };

  const viewPermission =
    entityPermissions.ViewAll || entityPermissions.ViewBasic;

  if (loading || isTeamMemberLoading > 0) {
    return <Loader />;
  }

  return viewPermission ? (
    <div
      className="tw-h-full tw-flex tw-flex-col tw-flex-grow"
      data-testid="team-details-container">
      {!isEmpty(currentTeam) ? (
        <Fragment>
          {!isOrganization && (
            <TitleBreadcrumb
              className="p-b-xs"
              titleLinks={slashedDatabaseName}
            />
          )}
          <div
            className="tw-flex tw-justify-between tw-items-center"
            data-testid="header">
            <TeamHeading
              currentTeam={currentTeam}
              entityPermissions={entityPermissions}
              isActionAllowed={isActionAllowed}
              updateTeamHandler={updateTeamHandler}
            />

            <Space align="center">
              {!isUndefined(currentUser) &&
                teamActionButton(
                  Boolean(isAlreadyJoinedTeam(currentTeam.id)),
                  currentTeam.isJoinable || false
                )}
              {entityPermissions.EditAll && !isOrganization && (
                <ManageButton
                  isRecursiveDelete
                  afterDeleteAction={afterDeleteAction}
                  allowSoftDelete={!currentTeam.deleted}
                  canDelete={entityPermissions.EditAll}
                  entityId={currentTeam.id}
                  entityName={
                    currentTeam.fullyQualifiedName || currentTeam.name
                  }
                  entityType="team"
                  extraDropdownContent={getExtraDropdownContent(
                    currentTeam,
                    handleReactiveTeam,
                    handleOpenToJoinToggle
                  )}
                  hardDeleteMessagePostFix={getDeleteMessagePostFix(
                    currentTeam.fullyQualifiedName || currentTeam.name,
                    t('label.permanently-lowercase')
                  )}
                  softDeleteMessagePostFix={getDeleteMessagePostFix(
                    currentTeam.fullyQualifiedName || currentTeam.name,
                    t('label.soft-lowercase')
                  )}
                />
              )}
            </Space>
          </div>
          <Space size={0}>
            {extraInfo.map((info, index) => (
              <Fragment key={uniqueId()}>
                <EntitySummaryDetails
                  allowTeamOwner={false}
                  currentOwner={currentTeam.owner}
                  data={info}
                  isGroupType={isGroupType}
                  showGroupOption={!childTeams.length}
                  teamType={currentTeam.teamType}
                  updateOwner={
                    entityPermissions.EditAll || entityPermissions.EditOwner
                      ? updateOwner
                      : undefined
                  }
                  updateTeamType={
                    entityPermissions.EditAll ? updateTeamType : undefined
                  }
                />
                {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                  <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                    {t('label.pipe-symbol')}
                  </span>
                ) : null}
              </Fragment>
            ))}
          </Space>
          <div className="m-b-sm m-t-xs" data-testid="description-container">
            <Description
              description={currentTeam?.description || ''}
              entityName={currentTeam?.displayName ?? currentTeam?.name}
              hasEditAccess={
                entityPermissions.EditDescription || entityPermissions.EditAll
              }
              isEdit={isDescriptionEditable}
              onCancel={() => descriptionHandler(false)}
              onDescriptionEdit={() => descriptionHandler(true)}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>

          <div className="tw-flex tw-flex-col tw-flex-grow">
            <Tabs
              defaultActiveKey={currentTab}
              items={tabs}
              onChange={updateActiveTab}
            />

            <div className="tw-flex-grow tw-flex tw-flex-col">
              {currentTab === TeamsPageTab.TEAMS &&
                (currentTeam.childrenCount === 0 && !searchTerm ? (
                  fetchErrorPlaceHolder({
                    onClick: () => handleAddTeam(true),
                    permission: createTeamPermission,
                    heading: t('label.team'),
                  })
                ) : (
                  <Row
                    className="team-list-container"
                    gutter={[8, 16]}
                    justify="space-between">
                    <Col span={8}>
                      <Searchbar
                        removeMargin
                        placeholder={t('label.search-entity', {
                          entity: t('label.team'),
                        })}
                        searchValue={searchTerm}
                        typingInterval={500}
                        onSearch={handleTeamSearch}
                      />
                    </Col>
                    <Col>
                      <Space align="center" size={16}>
                        {(currentTeam.teamType === TeamType.BusinessUnit ||
                          isOrganization) && (
                          <Typography.Text>
                            <Switch
                              checked={showDeletedTeam}
                              data-testid="show-deleted-team-switch"
                              onChange={onShowDeletedTeamChange}
                            />{' '}
                            <Typography.Text className="tw-ml-2">
                              {t('label.show-deleted')}
                            </Typography.Text>
                          </Typography.Text>
                        )}
                        <Button
                          data-testid="add-team"
                          disabled={!createTeamPermission}
                          title={
                            createTeamPermission
                              ? addTeam
                              : t('message.no-permission-for-action')
                          }
                          type="primary"
                          onClick={() => handleAddTeam(true)}>
                          {addTeam}
                        </Button>
                      </Space>
                    </Col>
                    <Col span={24}>
                      <TeamHierarchy
                        currentTeam={currentTeam}
                        data={table as Team[]}
                        onTeamExpand={onTeamExpand}
                      />
                    </Col>
                  </Row>
                ))}

              {currentTab === TeamsPageTab.USERS && (
                <UserCards
                  currentTeam={currentTeam}
                  currentTeamUserPage={currentTeamUserPage}
                  currentTeamUsers={currentTeamUsers}
                  deleteUserHandler={deleteUserHandler}
                  entityPermissions={entityPermissions}
                  handleAddUser={handleAddUser}
                  handleTeamUsersSearchAction={handleTeamUsersSearchAction}
                  isActionAllowed={isActionAllowed}
                  isTeamMemberLoading={isTeamMemberLoading}
                  teamUserPaging={teamUserPaging}
                  teamUserPagingHandler={teamUserPagingHandler}
                  teamUsersSearchText={teamUsersSearchText}
                />
              )}

              {currentTab === TeamsPageTab.ASSETS && getAssetDetailCards()}

              {currentTab === TeamsPageTab.ROLES &&
                (isEmpty(currentTeam.defaultRoles || []) ? (
                  fetchErrorPlaceHolder({
                    permission: entityPermissions.EditAll,
                    heading: t('label.role'),
                    doc: ROLE_DOCS,
                    children: t('message.assigning-team-entity-description', {
                      entity: t('label.role'),
                      name: currentTeam.name,
                    }),
                    type: ERROR_PLACEHOLDER_TYPE.ASSIGN,
                    button: (
                      <Button
                        ghost
                        className="p-x-lg"
                        data-testid="add-placeholder-button"
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={() =>
                          setAddAttribute({
                            type: EntityType.ROLE,
                            selectedData: currentTeam.defaultRoles || [],
                          })
                        }>
                        {t('label.add')}
                      </Button>
                    ),
                  })
                ) : (
                  <Space
                    className="tw-w-full roles-and-policy"
                    direction="vertical">
                    <Button
                      data-testid="add-role"
                      disabled={!entityPermissions.EditAll}
                      title={
                        entityPermissions.EditAll
                          ? addRole
                          : t('message.no-permission-for-action')
                      }
                      type="primary"
                      onClick={() =>
                        setAddAttribute({
                          type: EntityType.ROLE,
                          selectedData: currentTeam.defaultRoles || [],
                        })
                      }>
                      {addRole}
                    </Button>
                    <ListEntities
                      hasAccess={entityPermissions.EditAll}
                      list={currentTeam.defaultRoles || []}
                      type={EntityType.ROLE}
                      onDelete={(record) =>
                        setEntity({ record, attribute: 'defaultRoles' })
                      }
                    />
                  </Space>
                ))}
              {currentTab === TeamsPageTab.POLICIES &&
                (isEmpty(currentTeam.policies) ? (
                  fetchErrorPlaceHolder({
                    permission: entityPermissions.EditAll,
                    children: t('message.assigning-team-entity-description', {
                      entity: t('label.policy-plural'),
                      name: currentTeam.name,
                    }),
                    type: ERROR_PLACEHOLDER_TYPE.ASSIGN,
                    button: (
                      <Button
                        ghost
                        className="p-x-lg"
                        data-testid="add-placeholder-button"
                        icon={<PlusOutlined />}
                        type="primary"
                        onClick={() =>
                          setAddAttribute({
                            type: EntityType.POLICY,
                            selectedData: currentTeam.policies || [],
                          })
                        }>
                        {t('label.add')}
                      </Button>
                    ),
                  })
                ) : (
                  <Space
                    className="tw-w-full roles-and-policy"
                    direction="vertical">
                    <Button
                      data-testid="add-policy"
                      disabled={!entityPermissions.EditAll}
                      title={
                        entityPermissions.EditAll
                          ? addPolicy
                          : t('message.no-permission-for-action')
                      }
                      type="primary"
                      onClick={() =>
                        setAddAttribute({
                          type: EntityType.POLICY,
                          selectedData: currentTeam.policies || [],
                        })
                      }>
                      {addPolicy}
                    </Button>
                    <ListEntities
                      hasAccess={entityPermissions.EditAll}
                      list={currentTeam.policies || []}
                      type={EntityType.POLICY}
                      onDelete={(record) =>
                        setEntity({ record, attribute: 'policies' })
                      }
                    />
                  </Space>
                ))}
            </div>
          </div>
        </Fragment>
      ) : (
        fetchErrorPlaceHolder({
          onClick: () => handleAddTeam(true),
          permission: createTeamPermission,
          heading: t('label.team-plural'),
          doc: TEAMS_DOCS,
        })
      )}

      <ConfirmationModal
        bodyText={removeUserBodyText(deletingUser.leave)}
        cancelText={t('label.cancel')}
        confirmText={t('label.confirm')}
        header={
          deletingUser.leave ? t('label.leave-team') : t('label.removing-user')
        }
        visible={deletingUser.state}
        onCancel={() => setDeletingUser(DELETE_USER_INITIAL_STATE)}
        onConfirm={handleRemoveUser}
      />

      {addAttribute && (
        <AddAttributeModal
          isModalLoading={isModalLoading}
          isOpen={!isUndefined(addAttribute)}
          selectedKeys={addAttribute.selectedData.map((data) => data.id)}
          title={`${t('label.add')} ${addAttribute.type}`}
          type={addAttribute.type}
          onCancel={() => setAddAttribute(undefined)}
          onSave={(data) => handleAddAttribute(data)}
        />
      )}
      {selectedEntity && (
        <Modal
          centered
          closable={false}
          confirmLoading={isModalLoading}
          maskClosable={false}
          okText={t('label.confirm')}
          open={!isUndefined(selectedEntity.record)}
          title={`${t('label.remove-entity', {
            entity: getEntityName(selectedEntity?.record),
          })} ${t('label.from-lowercase')} ${getEntityName(currentTeam)}`}
          onCancel={() => setEntity(undefined)}
          onOk={async () => {
            await handleAttributeDelete(
              selectedEntity.record,
              selectedEntity.attribute
            );
            setEntity(undefined);
          }}>
          <Typography.Text>
            {t('message.are-you-sure-you-want-to-remove-child-from-parent', {
              child: getEntityName(selectedEntity.record),
              parent: getEntityName(currentTeam),
            })}
          </Typography.Text>
        </Modal>
      )}
    </div>
  ) : (
    <Row align="middle" className="tw-h-full">
      <Col span={24}>
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
      </Col>
    </Row>
  );
};

export default TeamDetailsV1;
