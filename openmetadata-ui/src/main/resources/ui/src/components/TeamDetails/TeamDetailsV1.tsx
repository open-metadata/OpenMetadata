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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Dropdown,
  Modal,
  Row,
  Space,
  Switch,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { DROPDOWN_ICON_SIZE_PROPS } from 'constants/ManageButton.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, isUndefined, orderBy, uniqueId } from 'lodash';
import { ExtraInfo } from 'Models';
import AddAttributeModal from 'pages/RolesPage/AddAttributeModal/AddAttributeModal';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { restoreTeam } from 'rest/teamsAPI';
import AppState from '../../AppState';
import { ReactComponent as IconEdit } from '../../assets/svg/ic-edit.svg';
import { ReactComponent as IconRemove } from '../../assets/svg/ic-remove.svg';
import { ReactComponent as IconRestore } from '../../assets/svg/ic-restore.svg';
import { ReactComponent as IconDropdown } from '../../assets/svg/menu.svg';
import { ReactComponent as IconOpenLock } from '../../assets/svg/open-lock.svg';
import { ReactComponent as IconShowPassword } from '../../assets/svg/show-password.svg';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  LIST_SIZE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import {
  POLICY_DOCS,
  ROLE_DOCS,
  TEAMS_DOCS,
} from '../../constants/docs.constants';
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
  PlaceholderProps,
  TeamDetailsProp,
} from '../../interface/teamsAndUsers.interface';
import { getTierFromEntityInfo, hasEditAccess } from '../../utils/CommonUtils';
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
import TableDataCard from '../common/table-data-card/TableDataCard';
import TabsPane from '../common/TabsPane/TabsPane';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import { commonUserDetailColumns } from '../Users/Users.util';
import ListEntities from './RolesAndPoliciesList';
import { getTabs, searchTeam } from './TeamDetailsV1.utils';
import TeamHierarchy from './TeamHierarchy';
import './teams.less';

const TeamDetailsV1 = ({
  assets,
  hasAccess,
  currentTeam,
  currentTeamUsers,
  teamUserPagin,
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
  teamUserPaginHandler,
  handleJoinTeamClick,
  handleLeaveTeamClick,
  handleAddUser,
  removeUserFromTeam,
  afterDeleteAction,
  onAssetsPaginate,
  parentTeams,
}: TeamDetailsProp) => {
  const { t } = useTranslation();
  const isOrganization = currentTeam.name === TeamType.Organization;
  const isGroupType = currentTeam.teamType === TeamType.Group;
  const DELETE_USER_INITIAL_STATE = {
    user: undefined,
    state: false,
    leave: false,
  };
  const { permissions, getEntityPermission } = usePermissionProvider();
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
  const [showActions, setShowActions] = useState<boolean>(false);

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

  const tabs = useMemo(
    () =>
      getTabs(
        currentTeam,
        teamUserPagin,
        isGroupType,
        isOrganization,
        teamCount
      ),
    [currentTeam, teamUserPagin, searchTerm, teamCount]
  );

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

  const fetchErrorPlaceHolder = useMemo(
    () =>
      ({
        title,
        disabled,
        label,
        onClick,
        heading,
        description,
        button,
        datatestid,
        doc,
      }: PlaceholderProps) => {
        return (
          <ErrorPlaceHolder
            buttons={
              button ? (
                button
              ) : (
                <Button
                  ghost
                  data-testid={datatestid}
                  disabled={disabled}
                  title={title}
                  type="primary"
                  onClick={onClick}>
                  {label}
                </Button>
              )
            }
            description={description}
            doc={doc}
            heading={heading}
            type={ERROR_PLACEHOLDER_TYPE.ADD}
          />
        );
      },
    []
  );

  const columns: ColumnsType<User> = useMemo(() => {
    return [
      ...commonUserDetailColumns(),
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="tw-w-full tw-justify-center remove-icon"
            size={8}>
            <Tooltip
              placement="bottomRight"
              title={
                entityPermissions.EditAll
                  ? t('label.remove')
                  : t('message.no-permission-for-action')
              }>
              <Button
                data-testid="remove-user-btn"
                disabled={!entityPermissions.EditAll}
                icon={
                  <IconRemove height={16} name={t('label.remove')} width={16} />
                }
                type="text"
                onClick={() => deleteUserHandler(record.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, [deleteUserHandler]);

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

  const isActionAllowed = (operation = false) => {
    return hasAccess || isOwner() || operation;
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
      setTable(
        filterChildTeams(searchTeam(childTeams, value), showDeletedTeam)
      );
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
      setHeading(currentTeam.displayName || currentTeam.name);
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
    setCurrentTab(isGroupType ? 2 : 1);
  }, [isGroupType]);

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

  const DELETED_TOGGLE_MENU_ITEM = {
    label: (
      <Row className="cursor-pointer" data-testid="deleted-team-menu-item">
        <Col span={3}>
          <IconShowPassword {...DROPDOWN_ICON_SIZE_PROPS} />
        </Col>
        <Col span={21}>
          <Row>
            <Col span={21}>
              <Typography.Text
                className="font-medium"
                data-testid="deleted-menu-item-label">
                {t('label.show-deleted-entity', {
                  entity: t('label.team'),
                })}
              </Typography.Text>
            </Col>

            <Col span={3}>
              <Switch
                checked={showDeletedTeam}
                data-testid="deleted-menu-item-switch"
                size="small"
                onChange={onShowDeletedTeamChange}
              />
            </Col>

            <Col className="p-t-xss">
              <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                {t('message.view-deleted-entity', {
                  entity: t('label.team-plural'),
                  parent: t('label.team'),
                })}
              </Typography.Paragraph>
            </Col>
          </Row>
        </Col>
      </Row>
    ),
    key: 'deleted-team-dropdown',
  };

  const extraDropdownContent: ItemType[] = useMemo(
    () => [
      ...(!currentTeam.parents?.[0]?.deleted && currentTeam.deleted
        ? [
            {
              label: (
                <Row className="cursor-pointer" onClick={handleReactiveTeam}>
                  <Col span={3}>{restoreIcon}</Col>
                  <Col data-testid="restore-team" span={21}>
                    <Row>
                      <Col span={24}>
                        <Typography.Text
                          className="font-medium"
                          data-testid="restore-team-label">
                          {t('label.restore-entity', {
                            entity: t('label.team'),
                          })}
                        </Typography.Text>
                      </Col>
                      <Col className="p-t-xss" span={24}>
                        <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                          {t('message.restore-deleted-team')}
                        </Typography.Paragraph>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              ),
              key: 'restore-team-dropdown',
            },
          ]
        : []),
      {
        label: (
          <Row
            className="cursor-pointer"
            data-testid="deleted-team-menu-item"
            onClick={handleOpenToJoinToggle}>
            <Col span={3}>
              <IconOpenLock {...DROPDOWN_ICON_SIZE_PROPS} />
            </Col>
            <Col data-testid="open-group" span={21}>
              <Row>
                <Col span={21}>
                  <Typography.Text
                    className="font-medium"
                    data-testid="open-group-label">
                    {t('label.public-team')}
                  </Typography.Text>
                </Col>

                <Col span={3}>
                  <Switch
                    checked={currentTeam.isJoinable}
                    className="tw-mr-2"
                    size="small"
                  />
                </Col>

                <Col className="p-t-xss">
                  <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                    {t('message.access-to-collaborate')}
                  </Typography.Paragraph>
                </Col>
              </Row>
            </Col>
          </Row>
        ),
        key: 'open-group-dropdown',
      },
      ...(currentTeam.teamType === TeamType.BusinessUnit
        ? [DELETED_TOGGLE_MENU_ITEM]
        : []),
    ],
    [entityPermissions, currentTeam, childTeams, showDeletedTeam]
  );

  /**
   * Check for current team users and return the user cards
   * @returns - user cards
   */
  const getUserCards = () => {
    const sortedUser = orderBy(currentTeamUsers || [], ['name'], 'asc');

    return (
      <>
        {isEmpty(currentTeamUsers) &&
        !teamUsersSearchText &&
        isTeamMemberLoading <= 0 ? (
          fetchErrorPlaceHolder({
            description: (
              <div className="tw-mb-2">
                <p>
                  {t('message.no-users', {
                    text: teamUsersSearchText
                      ? `${t('label.as-lowercase')} ${teamUsersSearchText}.`
                      : t('label.added-yet-lowercase'),
                  })}
                </p>
                <p>{t('message.would-like-to-start-adding-some')} </p>
              </div>
            ),
            disabled: !entityPermissions.EditAll,
            title: entityPermissions.EditAll
              ? t('label.add-new-entity', { entity: t('label.user') })
              : t('message.no-permission-for-action'),

            onClick: () => handleAddUser(true),
            label: t('label.add-new-entity', { entity: t('label.user') }),
            datatestid: 'add-user',
          })
        ) : (
          <>
            <div className="tw-flex tw-justify-between tw-items-center tw-mb-3">
              <div className="tw-w-4/12">
                <Searchbar
                  removeMargin
                  placeholder={`${t('label.search-for-type', {
                    type: t('label.user-lowercase'),
                  })}...`}
                  searchValue={teamUsersSearchText}
                  typingInterval={500}
                  onSearch={handleTeamUsersSearchAction}
                />
              </div>

              {currentTeamUsers.length > 0 && isActionAllowed() && (
                <div>
                  <Button
                    data-testid="add-user"
                    disabled={!entityPermissions.EditAll}
                    title={
                      entityPermissions.EditAll
                        ? t('label.add-entity', { entity: t('label.user') })
                        : t('message.no-permission-for-action')
                    }
                    type="primary"
                    onClick={() => {
                      handleAddUser(true);
                    }}>
                    {t('label.add-entity', { entity: t('label.user') })}
                  </Button>
                </div>
              )}
            </div>

            {isTeamMemberLoading > 0 ? (
              <Loader />
            ) : (
              <div>
                <Fragment>
                  <Table
                    bordered
                    className="teams-list-table"
                    columns={columns}
                    dataSource={sortedUser}
                    pagination={false}
                    size="small"
                  />
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
              </div>
            )}
          </>
        )}
      </>
    );
  };

  /**
   * Check for current team datasets and return the dataset cards
   * @returns - dataset cards
   */
  const getAssetDetailCards = () => {
    const ownData = filterEntityAssets(currentTeam?.owns || []);

    if (ownData.length <= 0) {
      return fetchErrorPlaceHolder({
        description: (
          <div className="tw-mb-4">
            <p> {t('message.team-no-asset')} </p>
            <p>{t('message.would-like-to-start-adding-some')} </p>
          </div>
        ),
        button: (
          <Link to="/explore">
            <Button ghost type="primary">
              {t('label.explore')}
            </Button>
          </Link>
        ),
      });
    }

    return (
      <div data-testid="table-container">
        {assets.data.map((entity, index) => (
          <div className="m-b-sm" key={`${entity.name}${index}`}>
            <TableDataCard
              database={entity.database}
              databaseSchema={entity.databaseSchema}
              deleted={entity.deleted}
              description={entity.description}
              fullyQualifiedName={entity.fullyQualifiedName}
              id={`tabledatacard${index}`}
              indexType={entity.index}
              name={entity.name}
              owner={entity.owner}
              service={entity.service}
              serviceType={entity.serviceType || '--'}
              tags={entity.tags}
              tier={getTierFromEntityInfo(entity)}
              usage={entity.weeklyPercentileRank}
            />
          </div>
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

  const teamActionButton = (alreadyJoined: boolean, isJoinable: boolean) => {
    return alreadyJoined ? (
      isJoinable || hasAccess ? (
        <Button data-testid="join-teams" type="primary" onClick={joinTeam}>
          {t('label.join-team')}
        </Button>
      ) : null
    ) : (
      <Button
        ghost
        data-testid="leave-team-button"
        type="primary"
        onClick={() => currentUser && deleteUserHandler(currentUser.id, true)}>
        {t('label.leave-team')}
      </Button>
    );
  };

  const getTeamHeading = () => {
    return (
      <div className="tw-heading tw-text-link tw-text-base tw-mb-2">
        {isHeadingEditing ? (
          <div className="tw-flex tw-items-center tw-gap-1">
            <input
              className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-64"
              data-testid="synonyms"
              id="synonyms"
              name="synonyms"
              placeholder={t('message.enter-comma-separated-field', {
                field: t('label.term-lowercase'),
              })}
              type="text"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
            />
            <div className="tw-flex tw-justify-end" data-testid="buttons">
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                data-testid="cancelAssociatedTag"
                type="primary"
                onMouseDown={() => setIsHeadingEditing(false)}>
                <CloseOutlined />
              </Button>
              <Button
                className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                data-testid="saveAssociatedTag"
                type="primary"
                onMouseDown={handleHeadingSave}>
                <CheckOutlined />
              </Button>
            </div>
          </div>
        ) : (
          <div className="tw-flex tw-group" data-testid="team-heading">
            <Typography.Title ellipsis={{ rows: 1, tooltip: true }} level={5}>
              {heading}
            </Typography.Title>
            {isActionAllowed() && (
              <div className={classNames('tw-w-5 tw-min-w-max')}>
                <Tooltip
                  placement="bottomLeft"
                  title={
                    entityPermissions.EditAll ||
                    entityPermissions.EditDisplayName
                      ? t('label.edit-entity', {
                          entity: t('label.display-name'),
                        })
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    className="m-l-xss p-0"
                    data-testid="edit-synonyms"
                    disabled={
                      !(
                        entityPermissions.EditDisplayName ||
                        entityPermissions.EditAll
                      )
                    }
                    icon={<IconEdit height={16} width={16} />}
                    size="small"
                    type="text"
                    onClick={() => setIsHeadingEditing(true)}
                  />
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </div>
    );
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
            {getTeamHeading()}
            {!isOrganization ? (
              <Space align="center">
                {!isUndefined(currentUser) &&
                  teamActionButton(
                    !isAlreadyJoinedTeam(currentTeam.id),
                    currentTeam.isJoinable || false
                  )}
                {entityPermissions.EditAll && (
                  <ManageButton
                    isRecursiveDelete
                    afterDeleteAction={afterDeleteAction}
                    allowSoftDelete={!currentTeam.deleted}
                    buttonClassName="tw-p-4"
                    canDelete={entityPermissions.EditAll}
                    entityId={currentTeam.id}
                    entityName={
                      currentTeam.fullyQualifiedName || currentTeam.name
                    }
                    entityType="team"
                    extraDropdownContent={extraDropdownContent}
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
            ) : (
              <Dropdown
                align={{ targetOffset: [-12, 0] }}
                menu={{ items: [DELETED_TOGGLE_MENU_ITEM] }}
                open={showActions}
                overlayStyle={{ width: '350px' }}
                placement="bottomRight"
                trigger={['click']}
                onOpenChange={setShowActions}>
                <Button
                  className="manage-dropdown-button"
                  data-testid="teams-dropdown"
                  icon={
                    <IconDropdown className="text-primary self-center manage-dropdown-icon" />
                  }
                  size="small"
                />
              </Dropdown>
            )}
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
            <TabsPane
              activeTab={currentTab}
              setActiveTab={(tab) => setCurrentTab(tab)}
              tabs={tabs}
            />

            <div className="tw-flex-grow tw-flex tw-flex-col tw-pt-4">
              {currentTab === 1 &&
                (currentTeam.childrenCount === 0 && !searchTerm ? (
                  fetchErrorPlaceHolder({
                    title: createTeamPermission
                      ? addTeam
                      : t('message.no-permission-for-action'),
                    label: addTeam,
                    onClick: () => handleAddTeam(true),
                    disabled: !createTeamPermission,
                    heading: t('label.team'),
                    datatestid: 'add-team',
                  })
                ) : (
                  <Row
                    className="team-list-container"
                    gutter={[8, 16]}
                    justify="space-between">
                    <Col span={8}>
                      <Searchbar
                        removeMargin
                        placeholder={`${t('label.search-entity', {
                          entity: t('label.team'),
                        })}...`}
                        searchValue={searchTerm}
                        typingInterval={500}
                        onSearch={handleTeamSearch}
                      />
                    </Col>
                    <Col>
                      <Space align="center">
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

              {currentTab === 2 && getUserCards()}

              {currentTab === 3 && getAssetDetailCards()}

              {currentTab === 4 &&
                (isEmpty(currentTeam.defaultRoles || []) ? (
                  fetchErrorPlaceHolder({
                    title: entityPermissions.EditAll
                      ? addRole
                      : t('message.no-permission-for-action'),
                    label: addRole,
                    onClick: () =>
                      setAddAttribute({
                        type: EntityType.ROLE,
                        selectedData: currentTeam.defaultRoles || [],
                      }),
                    disabled: !entityPermissions.EditAll,
                    heading: t('label.role'),
                    datatestid: 'add-role',
                    doc: ROLE_DOCS,
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
              {currentTab === 5 &&
                (isEmpty(currentTeam.policies) ? (
                  fetchErrorPlaceHolder({
                    title: entityPermissions.EditAll
                      ? addPolicy
                      : t('message.no-permission-for-action'),
                    label: addPolicy,
                    datatestid: 'add-policy',
                    onClick: () =>
                      setAddAttribute({
                        type: EntityType.POLICY,
                        selectedData: currentTeam.policies || [],
                      }),
                    disabled: !entityPermissions.EditAll,
                    heading: t('label.policy-plural'),
                    doc: POLICY_DOCS,
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
        <ErrorPlaceHolder
          buttons={
            <div className="tw-text-lg tw-text-center">
              <Button
                ghost
                data-testid="add-team"
                disabled={!createTeamPermission}
                title={
                  createTeamPermission
                    ? addTeam
                    : t('message.no-permission-for-action')
                }
                type="primary"
                onClick={() => handleAddTeam(true)}>
                {t('label.add-new-entity', { entity: t('label.team') })}
              </Button>
            </div>
          }
          doc={TEAMS_DOCS}
          heading={t('label.team-plural')}
          type={ERROR_PLACEHOLDER_TYPE.ADD}
        />
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
        <ErrorPlaceHolder>
          <p>{t('message.no-permission-to-view')}</p>
        </ErrorPlaceHolder>
      </Col>
    </Row>
  );
};

export default TeamDetailsV1;
