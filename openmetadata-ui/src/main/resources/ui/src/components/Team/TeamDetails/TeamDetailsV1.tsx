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
import {
  Avatar,
  Button,
  Card,
  Col,
  Collapse,
  Modal,
  Row,
  Space,
  Switch,
  Tabs,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import Qs from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import AppState from '../../../AppState';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { ReactComponent as IconRestore } from '../../../assets/svg/ic-restore.svg';
import { ReactComponent as IconOpenLock } from '../../../assets/svg/open-lock.svg';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams.svg';
import { useAuthContext } from '../../../components/authentication/auth-provider/AuthProvider';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { useEntityExportModalProvider } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import EntitySummaryPanel from '../../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../../components/Explore/explore.interface';
import AssetsTabs from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  ROUTES,
} from '../../../constants/constants';
import { ROLE_DOCS, TEAMS_DOCS } from '../../../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { DROPDOWN_ICON_SIZE_PROPS } from '../../../constants/ManageButton.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityAction, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { OwnerType } from '../../../enums/user.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { Team, TeamType } from '../../../generated/entity/teams/team';
import {
  EntityReference as UserTeams,
  User,
} from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/type/entityReference';
import { useAuth } from '../../../hooks/authHooks';
import {
  AddAttribute,
  PlaceholderProps,
  TeamDetailsProp,
} from '../../../interface/teamsAndUsers.interface';
import AddAttributeModal from '../../../pages/RolesPage/AddAttributeModal/AddAttributeModal';
import { ImportType } from '../../../pages/teams/ImportTeamsPage/ImportTeamsPage.interface';
import { getSuggestions } from '../../../rest/miscAPI';
import { exportTeam, restoreTeam } from '../../../rest/teamsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getSettingsPathWithFqn,
  getTeamsWithFqnPath,
} from '../../../utils/RouterUtils';
import {
  filterChildTeams,
  getDeleteMessagePostFix,
} from '../../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Description from '../../common/description/Description';
import ManageButton from '../../common/entityPageInfo/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import Searchbar from '../../common/searchbar/Searchbar';
import TitleBreadcrumb from '../../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../common/title-breadcrumb/title-breadcrumb.interface';
import Loader from '../../Loader/Loader';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
import TabsLabel from '../../TabsLabel/TabsLabel.component';
import ListEntities from './RolesAndPoliciesList';
import { SubscriptionWebhook, TeamsPageTab } from './team.interface';
import { getTabs } from './TeamDetailsV1.utils';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';
import TeamsInfo from './TeamsHeaderSection/TeamsInfo.component';
import TeamsSubscription from './TeamsHeaderSection/TeamsSubscription.component';
import { UserTab } from './UserTab/UserTab.component';

const TeamDetailsV1 = ({
  assetsCount,
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
  parentTeams,
  entityPermissions,
  isFetchingAdvancedDetails,
  isFetchingAllTeamAdvancedDetails,
}: TeamDetailsProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

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
  const { permissions } = usePermissionProvider();
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
  const [childTeamList, setChildTeamList] = useState<Team[]>([]);
  const [slashedTeamName, setSlashedTeamName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [addAttribute, setAddAttribute] = useState<AddAttribute>();
  const [selectedEntity, setEntity] = useState<{
    attribute: 'defaultRoles' | 'policies';
    record: EntityReference;
  }>();
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const { showModal } = useEntityExportModalProvider();

  const addPolicy = t('label.add-entity', {
    entity: t('label.policy'),
  });

  const addRole = t('label.add-entity', {
    entity: t('label.role'),
  });

  const addTeam = t('label.add-entity', { entity: t('label.team') });

  const hasEditSubscriptionPermission = useMemo(
    () =>
      entityPermissions.EditAll || currentTeam.owner?.id === currentUser?.id,
    [entityPermissions, currentTeam, currentUser]
  );

  const teamCount = useMemo(
    () =>
      isOrganization && currentTeam && currentTeam.childrenCount
        ? currentTeam.childrenCount + 1
        : childTeamList.length,
    [childTeamList, isOrganization, currentTeam.childrenCount]
  );
  const updateActiveTab = (key: string) => {
    history.push({ search: Qs.stringify({ activeTab: key }) });
  };

  const createTeamPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.TEAM, permissions),
    [permissions]
  );

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

  const fetchErrorPlaceHolder = useCallback(
    ({
      permission,
      onClick,
      heading,
      doc,
      button,
      children,
      type = ERROR_PLACEHOLDER_TYPE.CREATE,
    }: PlaceholderProps) => (
      <ErrorPlaceHolder
        button={button}
        className="mt-0-important"
        doc={doc}
        heading={heading}
        permission={permission}
        type={type}
        onClick={onClick}>
        {children}
      </ErrorPlaceHolder>
    ),
    []
  );

  const searchTeams = async (text: string) => {
    try {
      const res = await getSuggestions<SearchIndex.TEAM>(
        text,
        SearchIndex.TEAM
      );
      const data = res.data.suggest['metadata-suggest'][0].options.map(
        (value) => value._source as Team
      );

      setChildTeamList(data);
    } catch (error) {
      setChildTeamList([]);
    }
  };

  const handleOpenToJoinToggle = () => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        isJoinable: !currentTeam.isJoinable,
      };
      updateTeamHandler(updatedData, false);
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

  const updateTeamSubscription = async (data?: SubscriptionWebhook) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        profile: {
          subscription: isEmpty(data)
            ? undefined
            : {
                [data?.webhook ?? '']: { endpoint: data?.endpoint },
              },
        },
      };

      await updateTeamHandler(updatedData);
    }
  };

  const handleTeamSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      searchTeams(value);
    } else {
      setChildTeamList(filterChildTeams(childTeams ?? [], showDeletedTeam));
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

  useEffect(() => {
    if (currentTeam) {
      const parents =
        parentTeams && !isOrganization
          ? parentTeams.map((parent) => ({
              name: getEntityName(parent),
              url: getTeamsWithFqnPath(
                parent.name ?? parent.fullyQualifiedName ?? ''
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
      setSlashedTeamName(breadcrumb);
    }
  }, [currentTeam, parentTeams, showDeletedTeam]);

  useEffect(() => {
    setChildTeamList(filterChildTeams(childTeams ?? [], showDeletedTeam));
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

  const restoreIcon = useMemo(
    () => (
      <IconRestore {...DROPDOWN_ICON_SIZE_PROPS} name={t('label.restore')} />
    ),
    [currentTeam.isJoinable]
  );

  const handleTeamExportClick = useCallback(async () => {
    if (currentTeam?.name) {
      showModal({
        name: currentTeam?.name,
        onExport: exportTeam,
      });
    }
  }, [currentTeam]);
  const handleImportClick = useCallback(async () => {
    history.push({
      pathname: getSettingsPathWithFqn(
        GlobalSettingsMenuCategory.MEMBERS,
        GlobalSettingOptions.TEAMS,
        currentTeam.name,
        EntityAction.IMPORT
      ),
      search: Qs.stringify({ type: ImportType.TEAMS }),
    });
  }, []);

  const IMPORT_EXPORT_MENU_ITEM = useMemo(() => {
    const options = [
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.export-entity-help', {
              entity: t('label.team-lowercase'),
            })}
            icon={<ExportIcon width="18px" />}
            id="export"
            name={t('label.export')}
          />
        ),

        onClick: handleTeamExportClick,
        key: 'export-button',
      },
    ];

    if (entityPermissions.Create) {
      options.push({
        label: (
          <ManageButtonItemLabel
            description={t('message.import-entity-help', {
              entity: t('label.team-lowercase'),
            })}
            icon={<ImportIcon width="20px" />}
            id="import-button"
            name={t('label.import')}
          />
        ),
        onClick: handleImportClick,
        key: 'import-button',
      });
    }

    return options;
  }, [handleImportClick, handleTeamExportClick, entityPermissions]);

  const extraDropdownContent: ItemType[] = useMemo(
    () => [
      ...(isGroupType ? [] : IMPORT_EXPORT_MENU_ITEM),
      ...(!currentTeam.parents?.[0]?.deleted && currentTeam.deleted
        ? [
            {
              label: (
                <ManageButtonItemLabel
                  description={t('message.restore-deleted-team')}
                  icon={restoreIcon}
                  id="restore-team-dropdown"
                  name={t('label.restore-entity', {
                    entity: t('label.team'),
                  })}
                />
              ),
              onClick: handleReactiveTeam,
              key: 'restore-team-dropdown',
            },
          ]
        : []),
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.access-to-collaborate')}
            icon={<IconOpenLock {...DROPDOWN_ICON_SIZE_PROPS} />}
            id="open-group-dropdown"
            name={
              <Row>
                <Col span={21}>
                  <Typography.Text
                    className="font-medium"
                    data-testid="open-group-label">
                    {t('label.public-team')}
                  </Typography.Text>
                </Col>

                <Col span={3}>
                  <Switch checked={currentTeam.isJoinable} size="small" />
                </Col>
              </Row>
            }
          />
        ),
        onClick: handleOpenToJoinToggle,
        key: 'open-group-dropdown',
      },
    ],
    [
      entityPermissions,
      currentTeam,
      childTeams,
      showDeletedTeam,
      handleTeamExportClick,
    ]
  );

  const isAlreadyJoinedTeam = useMemo(
    () => currentUser?.teams?.find((team) => team.id === currentTeam.id),
    [currentTeam.id, currentUser]
  );

  const teamsTableRender = useMemo(
    () =>
      currentTeam.childrenCount === 0 && !searchTerm ? (
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
            <Space align="center">
              <span>
                <Switch
                  checked={showDeletedTeam}
                  data-testid="show-deleted"
                  onClick={onShowDeletedTeamChange}
                />
                <Typography.Text className="m-l-xs">
                  {t('label.deleted')}
                </Typography.Text>
              </span>

              {createTeamPermission && (
                <Button
                  data-testid="add-team"
                  type="primary"
                  onClick={() => handleAddTeam(true)}>
                  {addTeam}
                </Button>
              )}
            </Space>
          </Col>
          <Col span={24}>
            <TeamHierarchy
              currentTeam={currentTeam}
              data={childTeamList}
              isFetchingAllTeamAdvancedDetails={
                isFetchingAllTeamAdvancedDetails
              }
              onTeamExpand={onTeamExpand}
            />
          </Col>
        </Row>
      ),
    [
      addTeam,
      searchTerm,
      currentTeam,
      childTeamList,
      showDeletedTeam,
      createTeamPermission,
      isFetchingAllTeamAdvancedDetails,
      onTeamExpand,
      handleAddTeam,
      handleTeamSearch,
      onShowDeletedTeamChange,
    ]
  );

  const userTabRender = useMemo(
    () => (
      <UserTab
        currentPage={currentTeamUserPage}
        currentTeam={currentTeam}
        isLoading={isTeamMemberLoading}
        paging={teamUserPaging}
        permission={entityPermissions}
        searchText={teamUsersSearchText}
        users={currentTeamUsers}
        onAddUser={handleAddUser}
        onChangePaging={teamUserPagingHandler}
        onRemoveUser={removeUserFromTeam}
        onSearchUsers={handleTeamUsersSearchAction}
      />
    ),
    [
      currentTeamUserPage,
      currentTeam,
      isTeamMemberLoading,
      teamUserPaging,
      entityPermissions,
      teamUsersSearchText,
      currentTeamUsers,
      handleAddUser,
      teamUserPagingHandler,
      removeUserFromTeam,
      handleTeamUsersSearchAction,
    ]
  );

  const assetTabRender = useMemo(
    () => (
      <AssetsTabs
        isSummaryPanelOpen
        permissions={entityPermissions}
        type={AssetsOfEntity.TEAM}
        onAddAsset={() => history.push(ROUTES.EXPLORE)}
        onAssetClick={setPreviewAsset}
      />
    ),
    [entityPermissions, setPreviewAsset]
  );

  const rolesTabRender = useMemo(
    () =>
      isEmpty(currentTeam.defaultRoles ?? []) ? (
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
                  selectedData: currentTeam.defaultRoles ?? [],
                })
              }>
              {t('label.add')}
            </Button>
          ),
        })
      ) : (
        <Space className="w-full roles-and-policy p-md" direction="vertical">
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
                selectedData: currentTeam.defaultRoles ?? [],
              })
            }>
            {addRole}
          </Button>
          <ListEntities
            hasAccess={entityPermissions.EditAll}
            list={currentTeam.defaultRoles ?? []}
            type={EntityType.ROLE}
            onDelete={(record) =>
              setEntity({ record, attribute: 'defaultRoles' })
            }
          />
        </Space>
      ),
    [currentTeam, entityPermissions, addRole]
  );

  const policiesTabRender = useMemo(
    () =>
      isEmpty(currentTeam.policies) ? (
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
                  selectedData: currentTeam.policies ?? [],
                })
              }>
              {t('label.add')}
            </Button>
          ),
        })
      ) : (
        <Space className="w-full roles-and-policy p-md" direction="vertical">
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
                selectedData: currentTeam.policies ?? [],
              })
            }>
            {addPolicy}
          </Button>
          <ListEntities
            hasAccess={entityPermissions.EditAll}
            list={currentTeam.policies ?? []}
            type={EntityType.POLICY}
            onDelete={(record) => setEntity({ record, attribute: 'policies' })}
          />
        </Space>
      ),
    [currentTeam, entityPermissions, addPolicy]
  );

  const teamActionButton = useMemo(
    () =>
      !isOrganization &&
      !isUndefined(currentUser) &&
      (isAlreadyJoinedTeam ? (
        <Button
          ghost
          data-testid="leave-team-button"
          type="primary"
          onClick={() => deleteUserHandler(currentUser.id, true)}>
          {t('label.leave-team')}
        </Button>
      ) : (
        (Boolean(currentTeam.isJoinable) || isAuthDisabled || isAdminUser) && (
          <Button data-testid="join-teams" type="primary" onClick={joinTeam}>
            {t('label.join-team')}
          </Button>
        )
      )),

    [currentUser, isAlreadyJoinedTeam, isAuthDisabled, isAdminUser]
  );

  const teamsCollapseHeader = useMemo(
    () => (
      <Space wrap className="w-full justify-between">
        <Space className="w-full" size="middle">
          <Avatar className="teams-profile" size={40}>
            <IconTeams className="text-primary" width={20} />
          </Avatar>

          <Space direction="vertical" size={3}>
            {!isOrganization && (
              <TitleBreadcrumb titleLinks={slashedTeamName} />
            )}

            <TeamsInfo
              childTeamsCount={childTeams.length}
              currentTeam={currentTeam}
              entityPermissions={entityPermissions}
              isGroupType={isGroupType}
              parentTeams={parentTeams}
              updateTeamHandler={updateTeamHandler}
            />
          </Space>
        </Space>

        <Space align="center">
          {teamActionButton}
          {!isOrganization ? (
            entityPermissions.EditAll && (
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={!currentTeam.deleted}
                canDelete={entityPermissions.EditAll}
                entityId={currentTeam.id}
                entityName={currentTeam.fullyQualifiedName ?? currentTeam.name}
                entityType="team"
                extraDropdownContent={extraDropdownContent}
                hardDeleteMessagePostFix={getDeleteMessagePostFix(
                  currentTeam.fullyQualifiedName ?? currentTeam.name,
                  t('label.permanently-lowercase')
                )}
                softDeleteMessagePostFix={getDeleteMessagePostFix(
                  currentTeam.fullyQualifiedName ?? currentTeam.name,
                  t('label.soft-lowercase')
                )}
              />
            )
          ) : (
            <ManageButton
              canDelete={false}
              entityName={currentTeam.fullyQualifiedName ?? currentTeam.name}
              extraDropdownContent={[...IMPORT_EXPORT_MENU_ITEM]}
            />
          )}
        </Space>
      </Space>
    ),
    [
      isGroupType,
      parentTeams,
      childTeams,
      currentTeam,
      isOrganization,
      slashedTeamName,
      entityPermissions,
      teamActionButton,
      extraDropdownContent,
      updateTeamHandler,
      afterDeleteAction,
      getDeleteMessagePostFix,
    ]
  );

  const getTabChildren = useCallback(
    (key: TeamsPageTab) => {
      switch (key) {
        case TeamsPageTab.ASSETS:
          return assetTabRender;
        case TeamsPageTab.POLICIES:
          return policiesTabRender;
        case TeamsPageTab.ROLES:
          return rolesTabRender;
        case TeamsPageTab.TEAMS:
          return teamsTableRender;
        case TeamsPageTab.USERS:
          return userTabRender;
      }
    },
    [
      assetTabRender,
      policiesTabRender,
      rolesTabRender,
      teamsTableRender,
      userTabRender,
    ]
  );

  const tabsChildrenRender = useCallback(
    (key: TeamsPageTab) => (
      <Row className="teams-tabs-content-container">
        <Col className="teams-scroll-component" span={previewAsset ? 18 : 24}>
          {isFetchingAdvancedDetails ? <Loader /> : getTabChildren(key)}
        </Col>
        {previewAsset && (
          <Col className="border-left team-assets-right-panel" span={6}>
            <EntitySummaryPanel
              entityDetails={previewAsset}
              handleClosePanel={() => setPreviewAsset(undefined)}
            />
          </Col>
        )}
      </Row>
    ),
    [previewAsset, isFetchingAdvancedDetails, getTabChildren]
  );

  const tabs = useMemo(
    () =>
      getTabs(
        currentTeam,
        isGroupType,
        isOrganization,
        teamCount,
        assetsCount
      ).map((tab) => ({
        ...tab,
        label: (
          <TabsLabel
            count={tab.count}
            id={tab.key}
            isActive={currentTab === tab.key}
            name={tab.name}
          />
        ),
        children: tabsChildrenRender(tab.key),
      })),
    [
      currentTeam,
      teamUserPaging,
      searchTerm,
      teamCount,
      currentTab,
      assetsCount,
      getTabChildren,
      tabsChildrenRender,
    ]
  );

  if (isTeamMemberLoading > 0) {
    return <Loader />;
  }

  if (isEmpty(currentTeam)) {
    return fetchErrorPlaceHolder({
      onClick: () => handleAddTeam(true),
      permission: createTeamPermission,
      heading: t('label.team-plural'),
      doc: TEAMS_DOCS,
    });
  }

  return (
    <div className="teams-layout">
      <Row className="h-full" data-testid=" team-details-container">
        <Col className="teams-profile-container" span={24}>
          <Collapse
            accordion
            bordered={false}
            className="site-collapse-custom-collapse"
            defaultActiveKey={['1']}
            expandIconPosition="end">
            <Collapse.Panel
              className="site-collapse-custom-panel"
              collapsible="icon"
              header={teamsCollapseHeader}
              key="1">
              <Row>
                {(currentTeam.owner?.id === currentUser?.id ||
                  entityPermissions.EditAll ||
                  isAlreadyJoinedTeam) && (
                  <Col className="p-md border-top" span={24}>
                    <TeamsSubscription
                      hasEditPermission={hasEditSubscriptionPermission}
                      subscription={currentTeam.profile?.subscription}
                      updateTeamSubscription={updateTeamSubscription}
                    />
                  </Col>
                )}

                <Col className="border-top" span={24}>
                  <Card
                    className="ant-card-feed card-body-border-none card-padding-y-0 p-y-sm"
                    data-testid="teams-description"
                    title={
                      <Space align="center">
                        <Typography.Text className="right-panel-label font-normal">
                          {t('label.description')}
                        </Typography.Text>
                        {(entityPermissions.EditDescription ||
                          entityPermissions.EditAll) && (
                          <EditIcon
                            className="cursor-pointer align-middle"
                            color={DE_ACTIVE_COLOR}
                            data-testid="edit-description"
                            {...ICON_DIMENSION}
                            onClick={() => descriptionHandler(true)}
                          />
                        )}
                      </Space>
                    }>
                    <Description
                      description={currentTeam.description ?? ''}
                      entityName={currentTeam.displayName ?? currentTeam.name}
                      isEdit={isDescriptionEditable}
                      onCancel={() => descriptionHandler(false)}
                      onDescriptionUpdate={onDescriptionUpdate}
                    />
                  </Card>
                </Col>
              </Row>
            </Collapse.Panel>
          </Collapse>
        </Col>

        <Col className="m-t-sm" span={24}>
          <Tabs
            destroyInactiveTabPane
            className="entity-details-page-tabs"
            defaultActiveKey={currentTab}
            items={tabs}
            onChange={updateActiveTab}
          />
        </Col>

        <ConfirmationModal
          bodyText={removeUserBodyText(deletingUser.leave)}
          cancelText={t('label.cancel')}
          confirmText={t('label.confirm')}
          header={
            deletingUser.leave
              ? t('label.leave-team')
              : t('label.removing-user')
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
      </Row>
    </div>
  );
};

export default TeamDetailsV1;
