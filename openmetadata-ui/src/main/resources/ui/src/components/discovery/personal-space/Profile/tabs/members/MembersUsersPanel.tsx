/*
 *  Copyright 2026 Collate.
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

import {
  Box,
  Button,
  EmptyPlaceholder,
  Toggle,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { Delete } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as BotIcon } from '../../../../../../assets/svg/bot.svg';
import { ReactComponent as IconRestore } from '../../../../../../assets/svg/ic-restore.svg';
import { WILD_CARD_CHAR } from '../../../../../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  TEXT_GREY_MUTED,
} from '../../../../../../constants/constants';
import { ADMIN_ONLY_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { User } from '../../../../../../generated/entity/teams/user';
import { Include } from '../../../../../../generated/type/include';
import { useAuth } from '../../../../../../hooks/authHooks';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { getUsers, restoreUser } from '../../../../../../rest/userAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { checkPermission, LIST_CAP } from '../../../../../../utils/PermissionsUtils';
import {
  getRoleWithFqnPath,
  getTeamsWithFqnPath,
} from '../../../../../../utils/RouterUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteEntityModal from '../../../../../common/DeleteWidget/DeleteEntityModal';
import ConfirmationModal from '../../../../../Modals/ConfirmationModal/ConfirmationModal';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import type { ColumnsType } from '../../../../../common/Table/Table.interface';
import Table from '../../../../../common/Table/TableV2';

import type { MembersUsersPanelProps } from './Members.types';
import MembersPagination from './MembersPagination';

const USER_FIELDS = [
  TabSpecificField.PROFILE,
  TabSpecificField.TEAMS,
  TabSpecificField.ROLES,
].join(',');

const MembersUsersPanel: React.FC<MembersUsersPanelProps> = ({
  isAdmin,
  onNavigate,
  onSetHeaderActions,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { permissions } = usePermissionProvider();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedUser, setSelectedUser] = useState<User>();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const latestSearchIdRef = useRef(0);

  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    pageSize,
    paging,
    showPagination,
  } = usePaging();

  const canCreateUser = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.USER, permissions),
    [permissions]
  );

  const fetchUsers = useCallback(
    async (params?: { after?: string; before?: string }) => {
      setIsLoading(true);
      try {
        const response = await getUsers({
          fields: USER_FIELDS,
          limit: pageSize,
          isAdmin: isAdmin || undefined,
          isBot: false,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
          ...params,
        });
        setUsers(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', { entity: t('label.user') })
        );
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, isAdmin, showDeleted, handlePagingChange, t]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const searchId = ++latestSearchIdRef.current;
      setIsLoading(true);
      try {
        const response = await searchQuery({
          query: `${WILD_CARD_CHAR}${query}${WILD_CARD_CHAR}`,
          pageNumber: INITIAL_PAGING_VALUE,
          pageSize,
          searchIndex: SearchIndex.USER,
          queryFilter: {
            query: {
              bool: {
                must: [
                  { term: { isBot: false } },
                  ...(isAdmin ? [{ term: { isAdmin: true } }] : []),
                ],
              },
            },
          },
        });
        if (searchId !== latestSearchIdRef.current) {
          return;
        }
        const data = response.hits.hits.map(
          ({ _source }) => _source as User
        );
        setUsers(data);
        handlePagingChange({ total: response.hits.total.value });
      } catch (error) {
        showErrorToast(error as AxiosError);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, isAdmin, handlePagingChange]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      handlePageChange(INITIAL_PAGING_VALUE);
      if (value) {
        searchUsers(value);
      } else {
        fetchUsers();
      }
    },
    [handlePageChange, fetchUsers, searchUsers]
  );

  const handleShowDeletedChange = useCallback(
    (checked: boolean) => {
      setShowDeleted(checked);
      handlePageChange(INITIAL_PAGING_VALUE);
      setSearchValue('');
    },
    [handlePageChange]
  );

  const handleRestoreUser = useCallback(async () => {
    if (!selectedUser) {
      return;
    }
    setIsRestoring(true);
    try {
      await restoreUser(selectedUser.id);
      showSuccessToast(
        t('message.entity-restored-success', { entity: t('label.user') })
      );
      fetchUsers();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsRestoring(false);
      setShowRestoreModal(false);
      setSelectedUser(undefined);
    }
  }, [selectedUser, t, fetchUsers]);

  useEffect(() => {
    if (searchValue) {
      searchUsers(searchValue);
    } else {
      fetchUsers();
    }
  }, [pageSize, showDeleted]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!onSetHeaderActions || !canCreateUser) {
      onSetHeaderActions?.(undefined);

      return;
    }
    onSetHeaderActions(
      <Button
        color="primary"
        data-testid="add-user"
        size="sm"
        onPress={() =>
          onNavigate({ type: 'user-create', isAdmin: Boolean(isAdmin) })
        }>
        {t('label.add-entity', {
          entity: t(isAdmin ? 'label.admin' : 'label.user'),
        })}
      </Button>
    );

    return () => onSetHeaderActions(undefined);
  }, [canCreateUser, isAdmin, onNavigate, onSetHeaderActions, t]);

  const columns: ColumnsType<User> = useMemo(() => {
    const usernameColumn = {
      title: t('label.username'),
      dataIndex: 'username',
      key: 'username',
      render: (_: unknown, record: User) => (
        <Box align="center" direction="row" gap={1}>
          {record.isBot && (
            <Tooltip title={t('label.bot')}>
              <BotIcon
                aria-label={t('label.bot')}
                color={TEXT_GREY_MUTED}
                data-testid="bot-icon"
                height={16}
                width={16}
              />
            </Tooltip>
          )}
          {record.name ? (
            <UserPopOverCard
              showUserName
              profileWidth={16}
              userName={record.name}
            />
          ) : (
            getEntityName(record)
          )}
        </Box>
      ),
    };

    const nameColumn = {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, record: User) => getEntityName(record),
    };

    const teamsColumn = {
      title: t('label.team-plural'),
      dataIndex: 'teams',
      key: 'teams',
      render: (_: unknown, record: User) => {
        const teams = record.teams ?? [];

        if (teams.length === 0) {
          return t('label.no-entity', { entity: t('label.team') });
        }

        const visible = teams.slice(0, LIST_CAP);
        const overflow = teams.length - LIST_CAP;

        return (
          <Box align="center" direction="row" gap={1}>
            {visible.map((team) => (
              <Link
                key={team.id}
                to={getTeamsWithFqnPath(
                  team.fullyQualifiedName ?? ''
                )}>
                {getEntityName(team)}
              </Link>
            ))}
            {overflow > 0 && (
              <Tooltip
                title={teams
                  .slice(LIST_CAP)
                  .map((team) => getEntityName(team))
                  .join(', ')}>
                <span
                  className="tw:text-xs tw:text-tertiary tw:cursor-pointer"
                  data-testid="plus-more-count">
                  {`+${overflow} ${t('label.more')}`}
                </span>
              </Tooltip>
            )}
          </Box>
        );
      },
    };

    const rolesColumn = {
      title: t('label.role-plural'),
      dataIndex: 'roles',
      key: 'roles',
      render: (_: unknown, record: User) => {
        const roles = record.roles ?? [];

        if (roles.length === 0) {
          return t('label.no-entity', { entity: t('label.role') });
        }

        const visible = roles.slice(0, LIST_CAP);
        const overflow = roles.length - LIST_CAP;

        return (
          <Box align="center" direction="row" gap={1}>
            {visible.map((role) => (
              <Link
                key={role.id}
                to={getRoleWithFqnPath(
                  role.fullyQualifiedName ?? ''
                )}>
                {getEntityName(role)}
              </Link>
            ))}
            {overflow > 0 && (
              <Tooltip
                title={roles
                  .slice(LIST_CAP)
                  .map((role) => getEntityName(role))
                  .join(', ')}>
                <span
                  className="tw:text-xs tw:text-tertiary tw:cursor-pointer"
                  data-testid="plus-more-count">
                  {`+${overflow} ${t('label.more')}`}
                </span>
              </Tooltip>
            )}
          </Box>
        );
      },
    };

    const actionColumn = {
      title: t('label.action-plural'),
      dataIndex: 'actions',
      key: 'actions',
      width: 90,
      render: (_: unknown, record: User) => (
        <Box align="center" direction="row" gap={2}>
          {showDeleted && (
            <Tooltip
              title={
                isAdminUser
                  ? t('label.restore-entity', {
                      entity: t('label.user'),
                    })
                  : t(ADMIN_ONLY_ACTION)
              }>
              <Button
                aria-label={t('label.restore')}
                color="tertiary"
                data-testid={`restore-user-btn-${record.name}`}
                isDisabled={!isAdminUser}
                size="sm"
                onPress={() => {
                  setSelectedUser(record);
                  setShowRestoreModal(true);
                }}>
                <IconRestore height={16} width={16} />
              </Button>
            </Tooltip>
          )}
          <Tooltip
            title={
              isAdminUser
                ? t('label.delete-entity', {
                    entity: t('label.user'),
                  })
                : t(ADMIN_ONLY_ACTION)
            }>
            <Button
              aria-label={t('label.delete')}
              color="tertiary"
              data-testid={`delete-user-btn-${record.name}`}
              isDisabled={!isAdminUser}
              size="sm"
              onPress={() => {
                setSelectedUser(record);
                setShowDeleteModal(true);
              }}>
              <Delete className="tw:size-4" />
            </Button>
          </Tooltip>
        </Box>
      ),
    };

    const baseColumns = [usernameColumn, nameColumn, teamsColumn];

    if (!isAdmin) {
      baseColumns.push(rolesColumn);
    }

    baseColumns.push(actionColumn);

    return baseColumns;
  }, [showDeleted, isAdminUser, isAdmin, t]);

  return (
    <Box
      className="tw:pt-1 tw:h-full tw:px-8 tw:pb-8"
      data-testid="users-list-container"
      direction="col"
      gap={4}>
      <Table
        className="user-list-table"
        columns={columns}
        data-testid="users-list-table"
        dataSource={users}
        extraTableFilters={
          <Box align="center" direction="row" gap={2}>
            <Toggle
              data-testid="show-deleted"
              isSelected={showDeleted}
              label={t('label.deleted')}
              size="sm"
              onChange={handleShowDeletedChange}
            />
          </Box>
        }
        loading={isLoading}
        locale={{
          emptyText: (
            <Box
              align="center"
              className="tw:min-h-32 tw:relative"
              justify="center">
              <EmptyPlaceholder
                title={t('label.no-entity-found', {
                  entity: t('label.user-plural'),
                })}
              />
            </Box>
          ),
        }}
        pagination={false}
        rowKey="id"
        searchProps={{
          placeholder: `${t('label.search-for-type', {
            type: t('label.user'),
          })}...`,
          searchValue,
          typingInterval: 350,
          onSearch: handleSearch,
        }}
        size="small"
      />

      {showPagination && (
        <MembersPagination
          currentPage={currentPage}
          isLoading={isLoading}
          isNumberBased={Boolean(searchValue)}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={({ currentPage: page, cursorType }) => {
            handlePageChange(page);
            if (cursorType && paging[cursorType]) {
              fetchUsers({
                [cursorType === 'after' ? 'after' : 'before']:
                  paging[cursorType],
              });
            }
          }}
          onShowSizeChange={handlePageSizeChange}
        />
      )}

      {showDeleteModal && selectedUser && (
        <DeleteEntityModal
          afterDeleteAction={() => {
            handleSearch('');
          }}
          allowSoftDelete={!showDeleted}
          entityId={selectedUser.id}
          entityName={getEntityName(selectedUser)}
          entityType={EntityType.USER}
          visible={showDeleteModal}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedUser(undefined);
          }}
        />
      )}

      {showRestoreModal && selectedUser && (
        <ConfirmationModal
          bodyText={t('message.are-you-want-to-restore', {
            entity: getEntityName(selectedUser),
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.restore')}
          header={t('label.restore-entity', { entity: t('label.user') })}
          isLoading={isRestoring}
          visible={showRestoreModal}
          onCancel={() => {
            setShowRestoreModal(false);
            setSelectedUser(undefined);
          }}
          onConfirm={handleRestoreUser}
        />
      )}
    </Box>
  );
};

export default MembersUsersPanel;
