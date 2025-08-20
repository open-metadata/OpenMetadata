/*
 *  Copyright 2023 Collate.
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
import { Button, Col, Modal, Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { isEmpty, orderBy } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ExportIcon from '../../../../../assets/svg/ic-export.svg?react';
import ImportIcon from '../../../../../assets/svg/ic-import.svg?react';
import IconRemove from '../../../../../assets/svg/ic-remove.svg?react';
import { INITIAL_PAGING_VALUE } from '../../../../../constants/constants';
import { ExportTypes } from '../../../../../constants/Export.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import {
  EntityAction,
  EntityType,
  TabSpecificField,
} from '../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../enums/search.enum';
import { TeamType } from '../../../../../generated/entity/teams/team';
import { User } from '../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../generated/entity/type';
import { Paging } from '../../../../../generated/type/paging';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import { SearchResponse } from '../../../../../interface/search.interface';
import { ImportType } from '../../../../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage.interface';
import { searchData } from '../../../../../rest/miscAPI';
import { exportUserOfTeam } from '../../../../../rest/teamsAPI';
import { getUsers } from '../../../../../rest/userAPI';
import { formatUsersResponse } from '../../../../../utils/APIUtils';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../../utils/EntityUtils';
import { getSettingsPathWithFqn } from '../../../../../utils/RouterUtils';
import { commonUserDetailColumns } from '../../../../../utils/Users.util';
import ManageButton from '../../../../common/EntityPageInfos/ManageButton/ManageButton';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { ManageButtonItemLabel } from '../../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import Table from '../../../../common/Table/Table';
import { UserSelectableList } from '../../../../common/UserSelectableList/UserSelectableList.component';
import { useEntityExportModalProvider } from '../../../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { UserTabProps } from './UserTab.interface';

export const UserTab = ({
  permission,
  currentTeam,
  onAddUser,
  onRemoveUser,
}: UserTabProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [deletingUser, setDeletingUser] = useState<EntityReference>();
  const { showModal } = useEntityExportModalProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const usersList = useMemo(() => {
    return users.map((item) =>
      getEntityReferenceFromEntity(item, EntityType.USER)
    );
  }, [users]);

  const handleRemoveClick = (id: string) => {
    const user = usersList?.find((u) => u.id === id);
    setDeletingUser(user);
  };

  const isGroupType = useMemo(
    () => currentTeam.teamType === TeamType.Group,
    [currentTeam.teamType]
  );

  const editUserPermission = useMemo(
    () => permission.EditAll || permission.EditUsers,
    [permission.EditAll, permission.EditUsers]
  );

  /**
   * Make API call to fetch current team user data
   */
  const getCurrentTeamUsers = (team: string, paging: Partial<Paging> = {}) => {
    setIsLoading(true);
    getUsers({
      fields: `${TabSpecificField.ROLES}`,
      limit: pageSize,
      team,
      ...paging,
    })
      .then((res) => {
        if (res.data) {
          setUsers(res.data);
          handlePagingChange(res.paging);
        }
      })
      .catch(() => {
        setUsers([]);
        handlePagingChange({ total: 0 });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const searchUsers = (text: string, currentPage: number) => {
    setIsLoading(true);
    searchData(
      text,
      currentPage,
      pageSize,
      `(teams.id:${currentTeam?.id})`,
      '',
      '',
      SearchIndex.USER
    )
      .then((res) => {
        const data = formatUsersResponse(
          (res.data as SearchResponse<SearchIndex.USER>).hits.hits
        );
        setUsers(data);
        handlePagingChange({
          total: res.data.hits.total.value,
        });
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setIsLoading(false));
  };

  const userPagingHandler = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (searchText) {
      handlePageChange(currentPage);
      searchUsers(searchText, currentPage);
    } else if (cursorType) {
      handlePageChange(currentPage);
      getCurrentTeamUsers(currentTeam.name, {
        [cursorType]: paging[cursorType],
      });
    }
  };

  const handleCurrentUserPage = (value?: number) => {
    handlePageChange(value ?? INITIAL_PAGING_VALUE);
  };

  const handleUsersSearchAction = (text: string) => {
    setSearchText(text);
    handleCurrentUserPage(INITIAL_PAGING_VALUE);
    if (text) {
      searchUsers(text, INITIAL_PAGING_VALUE);
    } else {
      getCurrentTeamUsers(currentTeam.name);
    }
  };

  useEffect(() => {
    getCurrentTeamUsers(currentTeam.name);
    handlePageChange(INITIAL_PAGING_VALUE);
  }, [currentTeam, pageSize]);

  const isTeamDeleted = useMemo(
    () => currentTeam.deleted ?? false,
    [currentTeam]
  );

  const columns: ColumnsType<User> = useMemo(() => {
    const tabColumns: ColumnsType<User> = [
      // will not show teams column in the Team Page
      ...commonUserDetailColumns().filter((item) => item.key !== 'teams'),
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="w-full justify-center remove-icon"
            size={8}>
            <Tooltip
              placement="left"
              title={
                editUserPermission
                  ? t('label.remove')
                  : t('message.no-permission-for-action')
              }>
              <Button
                data-testid="remove-user-btn"
                disabled={!editUserPermission}
                icon={
                  <IconRemove height={16} name={t('label.remove')} width={16} />
                }
                type="text"
                onClick={() => handleRemoveClick(record.id)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];

    return tabColumns.filter((column) =>
      column.key === 'actions' ? !isTeamDeleted : true
    );
  }, [handleRemoveClick, editUserPermission, isTeamDeleted]);

  const sortedUser = useMemo(() => orderBy(users, ['name'], 'asc'), [users]);

  const handleUserExportClick = useCallback(async () => {
    if (currentTeam?.name) {
      showModal({
        name: currentTeam.name,
        onExport: exportUserOfTeam,
        exportTypes: [ExportTypes.CSV],
      });
    }
  }, [currentTeam, exportUserOfTeam]);

  const handleImportClick = useCallback(async () => {
    navigate({
      pathname: getSettingsPathWithFqn(
        GlobalSettingsMenuCategory.MEMBERS,
        GlobalSettingOptions.TEAMS,
        currentTeam.name,
        EntityAction.IMPORT
      ),
      search: QueryString.stringify({ type: ImportType.USERS }),
    });
  }, []);

  const IMPORT_EXPORT_MENU_ITEM = useMemo(() => {
    const option = [
      {
        label: (
          <ManageButtonItemLabel
            description={t('message.export-entity-help', {
              entity: t('label.user-lowercase'),
            })}
            icon={ExportIcon}
            id="export"
            name={t('label.export')}
          />
        ),

        onClick: handleUserExportClick,
        key: 'export-button',
      },
    ];
    if (permission.EditAll) {
      option.push({
        label: (
          <ManageButtonItemLabel
            description={t('message.import-entity-help', {
              entity: t('label.team-lowercase'),
            })}
            icon={ImportIcon}
            id="import-button"
            name={t('label.import')}
          />
        ),
        onClick: handleImportClick,
        key: 'import-button',
      });
    }

    return option;
  }, [handleUserExportClick, handleImportClick, permission]);

  const handleRemoveUser = () => {
    if (deletingUser?.id) {
      onRemoveUser(deletingUser.id).then(() => {
        setDeletingUser(undefined);
      });
    }
  };

  const addUserButtonTitle = useMemo(() => {
    if (isTeamDeleted) {
      return t('message.this-action-is-not-allowed-for-deleted-entities');
    }

    return permission.EditAll
      ? t('label.add-new-entity', { entity: t('label.user') })
      : t('message.no-permission-for-action');
  }, [permission, isTeamDeleted]);

  if (isEmpty(users) && !searchText && !isLoading) {
    return isGroupType ? (
      <ErrorPlaceHolder
        button={
          <Space>
            <UserSelectableList
              hasPermission
              selectedUsers={currentTeam?.users ?? []}
              onUpdate={onAddUser}>
              <Tooltip placement="topRight" title={addUserButtonTitle}>
                <Button
                  ghost
                  className={classNames({
                    'p-x-lg': editUserPermission && !isTeamDeleted,
                  })}
                  data-testid="add-new-user"
                  disabled={!editUserPermission || isTeamDeleted}
                  icon={<PlusOutlined />}
                  type="primary">
                  {t('label.add')}
                </Button>
              </Tooltip>
            </UserSelectableList>
            {!isTeamDeleted && (
              <ManageButton
                canDelete={false}
                displayName={getEntityName(currentTeam)}
                entityName={currentTeam.name}
                entityType={EntityType.USER}
                extraDropdownContent={IMPORT_EXPORT_MENU_ITEM}
              />
            )}
          </Space>
        }
        className="mt-0-important border-none"
        heading={t('label.user')}
        permission={editUserPermission}
        permissionValue={t('label.edit-entity', {
          entity: t('label.user'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.ASSIGN}
      />
    ) : (
      <ErrorPlaceHolder
        placeholderText={t('message.no-user-part-of-team', {
          team: getEntityName(currentTeam),
        })}
      />
    );
  }

  return (
    <div className="p-y-md">
      <Table
        className="teams-list-table"
        columns={columns}
        customPaginationProps={{
          currentPage,
          isLoading,
          showPagination,
          isNumberBased: Boolean(searchText),
          pageSize,
          paging,
          pagingHandler: userPagingHandler,
          onShowSizeChange: handlePageSizeChange,
        }}
        dataSource={sortedUser}
        extraTableFilters={
          !currentTeam.deleted &&
          isGroupType && (
            <Col>
              <Space>
                {users.length > 0 && editUserPermission && (
                  <UserSelectableList
                    hasPermission
                    selectedUsers={currentTeam?.users ?? []}
                    onUpdate={onAddUser}>
                    <Button data-testid="add-new-user" type="primary">
                      {t('label.add-entity', { entity: t('label.user') })}
                    </Button>
                  </UserSelectableList>
                )}
                <ManageButton
                  canDelete={false}
                  displayName={getEntityName(currentTeam)}
                  entityName={currentTeam.name}
                  entityType={EntityType.USER}
                  extraDropdownContent={IMPORT_EXPORT_MENU_ITEM}
                />
              </Space>
            </Col>
          )
        }
        loading={isLoading}
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowKey="name"
        searchProps={{
          placeholder: t('label.search-for-type', {
            type: t('label.user-lowercase'),
          }),
          value: searchText,
          typingInterval: 500,
          onSearch: handleUsersSearchAction,
        }}
        size="small"
      />
      <Modal
        cancelText={t('label.cancel')}
        data-testid="confirmation-modal"
        okText={t('label.confirm')}
        open={Boolean(deletingUser)}
        title={t('label.removing-user')}
        onCancel={() => setDeletingUser(undefined)}
        onOk={handleRemoveUser}>
        {t('message.are-you-sure-want-to-text', {
          text: t('label.remove-entity', {
            entity: getEntityName(deletingUser),
          }),
        })}
      </Modal>
    </div>
  );
};
