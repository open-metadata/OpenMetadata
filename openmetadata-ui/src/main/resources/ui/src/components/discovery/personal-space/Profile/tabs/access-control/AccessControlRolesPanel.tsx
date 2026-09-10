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
  PaginationCardWithControls,
  Table,
  TableCard,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { Delete } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import { ROUTES } from '../../../../../../constants/constants';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { CursorType } from '../../../../../../enums/pagination.enum';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { Role } from '../../../../../../generated/entity/teams/role';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Paging } from '../../../../../../generated/type/paging';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { getRoles } from '../../../../../../rest/rolesAPIV1';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  checkPermission,
  LIST_CAP,
  userPermissions,
} from '../../../../../../utils/PermissionsUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../../../../utils/RouterUtils';
import type { AccessControlView } from './AccessControlPanel';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

type RoleColumnId = 'name' | 'description' | 'policies' | 'actions';

interface AccessControlRolesPanelProps {
  onNavigate?: (view: AccessControlView) => void;
}

const AccessControlRolesPanel: React.FC<AccessControlRolesPanelProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>();
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
    pagingCursor,
  } = usePaging();

  const { permissions } = usePermissionProvider();

  const addRolePermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Create, ResourceEntity.ROLE, permissions),
    [permissions]
  );

  const viewPolicyPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      userPermissions?.hasViewPermissions(ResourceEntity.POLICY, permissions),
    [permissions]
  );

  const deleteRolePermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.ROLE, permissions),
    [permissions]
  );

  const columns = useMemo(
    () => [
      { id: 'name' as RoleColumnId, label: t('label.name') },
      { id: 'description' as RoleColumnId, label: t('label.description') },
      { id: 'policies' as RoleColumnId, label: t('label.policy-plural') },
      { id: 'actions' as RoleColumnId, label: t('label.action-plural') },
    ],
    [t]
  );

  const fetchRoles = async (pagingParam?: Partial<Paging>) => {
    setIsLoading(true);
    try {
      const data = await getRoles(
        'policies',
        pagingParam?.after,
        pagingParam?.before,
        undefined,
        pageSize
      );

      setRoles(data.data || []);
      handlePagingChange(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    fetchRoles();
  }, []);

  const handleRoleDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(selectedRole).toString(),
      selectedRole?.id ?? '',
      EntityType.ROLE
    );

    if (isSuccess) {
      handleAfterDeleteAction();
    }

    setSelectedRole(undefined);
    setIsDeleting(false);
  }, [selectedRole, handleAfterDeleteAction]);

  const handleAddRole = () => {
    if (onNavigate) {
      onNavigate({ type: 'roles-add' });
    } else {
      navigate(ROUTES.ADD_ROLE);
    }
  };

  const handleRoleClick = (role: Role) => {
    if (onNavigate) {
      onNavigate({
        type: 'roles-detail',
        fqn: role.fullyQualifiedName ?? '',
        name: getEntityName(role),
      });
    }
  };

  const handlePageNavigation = (newPage: number) => {
    if (newPage > currentPage && paging?.after) {
      fetchRoles({ after: paging.after, total: paging.total } as Paging);
      handlePageChange(
        newPage,
        { cursorType: CursorType.AFTER, cursorValue: paging.after },
        pageSize
      );
    } else if (newPage < currentPage && paging?.before) {
      fetchRoles({ before: paging.before, total: paging.total } as Paging);
      handlePageChange(
        newPage,
        { cursorType: CursorType.BEFORE, cursorValue: paging.before },
        pageSize
      );
    }
  };

  useEffect(() => {
    const { cursorType, cursorValue } = pagingCursor ?? {};

    if (cursorType && cursorValue) {
      fetchRoles({ [cursorType]: cursorValue });
    } else {
      fetchRoles();
    }
  }, [pageSize, pagingCursor]);

  // Extracted to keep renderCell complexity under the threshold.
  const renderPoliciesCell = (policies: EntityReference[] | undefined) => {
    const listLength = policies?.length ?? 0;
    const hasMore = listLength > LIST_CAP;

    if (!policies?.length) {
      return '--';
    }

    return (
      <Box
        className="tw:flex tw:flex-wrap tw:gap-1"
        data-testid="policy-link"
        direction="row">
        {policies.slice(0, LIST_CAP).map((policy) =>
          viewPolicyPermission ? (
            onNavigate ? (
              <Button
                color="link-color"
                key={uniqueId()}
                size="sm"
                onPress={() =>
                  onNavigate({
                    type: 'policies-detail',
                    fqn: policy.fullyQualifiedName ?? '',
                    name: getEntityName(policy),
                  })
                }>
                {getEntityName(policy)}
              </Button>
            ) : (
              <Link
                key={uniqueId()}
                to={getPolicyWithFqnPath(policy.fullyQualifiedName || '')}>
                {getEntityName(policy)}
              </Link>
            )
          ) : (
            <Tooltip key={uniqueId()} title={t(NO_PERMISSION_TO_VIEW)}>
              <Box className="tw:text-sm">{getEntityName(policy)}</Box>
            </Tooltip>
          )
        )}
        {hasMore && (
          <Tooltip
            title={
              <Box className="tw:flex tw:flex-col tw:gap-1">
                {policies.slice(LIST_CAP).map((policy) =>
                  viewPolicyPermission ? (
                    onNavigate ? (
                      <Button
                        color="link-color"
                        key={uniqueId()}
                        size="sm"
                        onPress={() =>
                          onNavigate({
                            type: 'policies-detail',
                            fqn: policy.fullyQualifiedName ?? '',
                            name: getEntityName(policy),
                          })
                        }>
                        {getEntityName(policy)}
                      </Button>
                    ) : (
                      <Link
                        key={uniqueId()}
                        to={getPolicyWithFqnPath(
                          policy.fullyQualifiedName || ''
                        )}>
                        {getEntityName(policy)}
                      </Link>
                    )
                  ) : (
                    <Box className="tw:text-sm" key={uniqueId()}>
                      {getEntityName(policy)}
                    </Box>
                  )
                )}
              </Box>
            }>
            <Box
              className="tw:cursor-pointer tw:rounded tw:bg-secondary tw:px-1.5 tw:py-0.5 tw:text-xs tw:text-tertiary"
              data-testid="plus-more-count">
              {`+${listLength - LIST_CAP} more`}
            </Box>
          </Tooltip>
        )}
      </Box>
    );
  };

  const renderCell = (role: Role, colId: RoleColumnId) => {
    switch (colId) {
      case 'name':
        return onNavigate ? (
          <Button
            color="link-color"
            data-testid="role-name"
            size="sm"
            onPress={() => handleRoleClick(role)}>
            {getEntityName(role)}
          </Button>
        ) : (
          <Link
            className="link-hover"
            data-testid="role-name"
            to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
            {getEntityName(role)}
          </Link>
        );

      case 'description':
        return (
          <Box className="tw:text-sm tw:text-secondary">
            {role.description || '--'}
          </Box>
        );

      case 'policies':
        return renderPoliciesCell(role.policies);

      case 'actions':
        return (
          <Tooltip
            placement="left"
            title={
              deleteRolePermission
                ? t('label.delete-entity', { entity: t('label.role') })
                : t(NO_PERMISSION_FOR_ACTION)
            }>
            <Button
              color="tertiary"
              data-testid={`delete-action-${getEntityName(role)}`}
              isDisabled={!deleteRolePermission}
              size="xs"
              onPress={() => setSelectedRole(role)}>
              <Delete name={t('label.delete')} width="16px" />
            </Button>
          </Tooltip>
        );

      default:
        return null;
    }
  };

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4 tw:pt-1"
      data-testid="roles-list-container">
      <TableCard.Root size="compact">
        <TableCard.Header
          className='tw:py-4'
          contentTrailing={
            addRolePermission ? (
              <Button
                color="primary"
                data-testid="add-role"
                size="sm"
                onPress={handleAddRole}>
                {t('label.add-entity', { entity: t('label.role') })}
              </Button>
            ) : undefined
          }
        />
        {isLoading ? (
          <Box className="tw:flex tw:justify-center tw:p-8">
            <Loader />
          </Box>
        ) : (
          <Table
            ariaLabel='label.role-plural'
            data-testid="roles-list-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head id={col.id} key={col.id} label={col.label} />
              )}
            </Table.Header>
            <Table.Body
              items={roles}
              renderEmptyState={() => (
                <Box className="tw:min-h-32 tw:flex tw:items-center tw:justify-center tw:relative">
                  <EmptyPlaceholder
                    description={
                      addRolePermission
                        ? t('message.add-entity-to-get-started', {
                            entity: t('label.role'),
                          })
                        : undefined
                    }
                    title={t('label.no-entity-found', {
                      entity: t('label.role-plural'),
                    })}
                  />
                </Box>
              )}>
              {(role) => (
                <Table.Row
                  columns={columns}
                  data-testid={`role-${getEntityName(role)}`}
                  id={role.id ?? role.name}
                  key={role.id ?? role.name}>
                  {(col) => (
                    <Table.Cell key={col.id}>
                      {renderCell(role, col.id as RoleColumnId)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        )}
        {showPagination && (
          <PaginationCardWithControls
            page={currentPage}
            pageSize={pageSize}
            total={totalPages}
            onPageChange={handlePageNavigation}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </TableCard.Root>

      {selectedRole && (
        <DeleteModal
          entityTitle={getEntityName(selectedRole).toString()}
          isDeleting={isDeleting}
          message={t('message.permanently-delete-common-message', {
            entity: getEntityName(selectedRole).toString().toLowerCase(),
          })}
          open={!isUndefined(selectedRole)}
          onCancel={() => setSelectedRole(undefined)}
          onDelete={handleRoleDelete}
        />
      )}
    </Box>
  );
};

export default AccessControlRolesPanel;
