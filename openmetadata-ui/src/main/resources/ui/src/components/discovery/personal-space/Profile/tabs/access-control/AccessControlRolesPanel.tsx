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
    Popover,
    PopoverTrigger,
    Skeleton,
    Table,
    TableCard,
    Tooltip
} from '@openmetadata/ui-core-components';
import { Delete } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PAGE_SIZE_BASE } from '../../../../../../constants/constants';
import {
    NO_PERMISSION_FOR_ACTION,
    NO_PERMISSION_TO_VIEW
} from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Operation } from '../../../../../../generated/entity/policies/policy';
import { Role } from '../../../../../../generated/entity/teams/role';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Paging } from '../../../../../../generated/type/paging';
import { getRoles } from '../../../../../../rest/rolesAPIV1';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
    checkPermission,
    LIST_CAP,
    userPermissions
} from '../../../../../../utils/PermissionsUtils';
import {
    getPolicyWithFqnPath,
    getRoleWithFqnPath
} from '../../../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { AccessControlView } from './AccessControlPanel';

type RoleColumnId = 'name' | 'description' | 'policies' | 'actions';
type RoleColumn = { id: RoleColumnId; label: string; className?: string };

interface AccessControlRolesPanelProps {
  onNavigate?: (view: AccessControlView) => void;
}

const AccessControlRolesPanel: React.FC<AccessControlRolesPanelProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
  const [paging, setPaging] = useState<Paging>({ total: 0 });

  const showPagination = useMemo(
    () => Boolean(paging.before || paging.after) || paging.total > pageSize,
    [paging, pageSize]
  );

  const { permissions } = usePermissionProvider();

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

  const columns = useMemo<RoleColumn[]>(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-70' },
      { id: 'description', label: t('label.description') },
      { id: 'policies', label: t('label.policy-plural'), className: 'tw:w-60' },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
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
      setPaging(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setCurrentPage(newPage);
      fetchRoles({ after: paging.after });
    } else if (newPage < currentPage && paging?.before) {
      setCurrentPage(newPage);
      fetchRoles({ before: paging.before });
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const renderPolicyItem = (policy: EntityReference) => {
    const key = uniqueId();

    if (!viewPolicyPermission) {
      return (
        <Tooltip key={key} title={t(NO_PERMISSION_TO_VIEW)}>
          <Box className="tw:text-sm tw:truncate tw:block">{getEntityName(policy)}</Box>
        </Tooltip>
      );
    }

    if (onNavigate) {
      return (
        <Button
          className='tw:truncate tw:block'
          color="link-color"
          key={key}
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
      );
    }

    return (
      <Link
        key={key}
        className='tw:truncate tw:block'
        to={getPolicyWithFqnPath(policy.fullyQualifiedName || '')}>
        {getEntityName(policy)}
      </Link>
    );
  };

  // Extracted to keep renderCell complexity under the threshold.
  const renderPoliciesCell = (policies: EntityReference[] | undefined) => {
    const listLength = policies?.length ?? 0;
    const hasMore = listLength > LIST_CAP;

    if (!policies?.length) {
      return '--';
    }

    return (
      <Box
        className="tw:flex-wrap"
        data-testid="policy-link"
        direction="row"
        gap={1}>
        {policies.slice(0, LIST_CAP).map(renderPolicyItem)}
        {hasMore && (
          <PopoverTrigger>
            <Button
              color="tertiary"
              className='tw:py-0'
              data-testid="plus-more-count"
              size="xs">
              {`+${listLength - LIST_CAP} more`}
            </Button>
            <Popover className='tw:max-h-80! tw:overflow-scroll'>
              <Box className="tw:p-3" direction="col" gap={1}>
                {policies.slice(LIST_CAP).map(renderPolicyItem)}
              </Box>
            </Popover>
          </PopoverTrigger>
        )}
      </Box>
    );
  };

  const renderCell = (role: Role, colId: RoleColumnId) => {
    switch (colId) {
      case 'name':
        return onNavigate ? (
          <Tooltip placement="top" title={getEntityName(role)}>
            <Button
              className="tw:max-w-full tw:truncate tw:block tw:text-left"
              color="link-color"
              data-testid="role-name"
              size="sm"
              onPress={() => handleRoleClick(role)}>
              {getEntityName(role)}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip placement="top" title={getEntityName(role)} triggerClassName="tw:block tw:w-full">
            <Link
              className="tw:block tw:truncate link-hover"
              data-testid="role-name"
              to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
              {getEntityName(role)}
            </Link>
          </Tooltip>
        );

      case 'description':
        return role.description ? (
          <RichTextEditorPreviewerV1 markdown={role.description} />
        ) : (
          <span className="tw:text-sm tw:text-secondary">--</span>
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

  const renderEmptyState = useCallback(
    () =>
      isLoading ? (
        <Box className="tw:p-3" direction="col" gap={2}>
          {Array.from({ length: pageSize }, (_, i) => (
            <Skeleton height={28} key={i} variant="rounded" />
          ))}
        </Box>
      ) : (
        <Box className="tw:min-h-32 tw:relative" align="center" justify="center">
          <EmptyPlaceholder
            title={t('label.no-entity-found', {
              entity: t('label.role-plural'),
            })}
          />
        </Box>
      ),
    [isLoading, pageSize, t]
  );

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  return (
    <Box
      className="tw:pt-1"
      data-testid="roles-list-container"
      direction="col"
      gap={4}>
      <TableCard.Root size="compact">
        <div className="tw:overflow-y-auto tw:max-h-[480px]">
          <Table
            className="tw:table-fixed"
            aria-label={t('label.role-plural')}
            data-testid="roles-list-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head
                  className={col.className}
                  id={col.id}
                  key={col.id}
                  label={col.label}
                />
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : roles}
              renderEmptyState={renderEmptyState}>
              {(role) => (
                <Table.Row
                  columns={columns}
                  data-testid={`role-${getEntityName(role)}`}
                  id={role.id ?? role.name}
                  key={role.id ?? role.name}>
                  {(col) => (
                    <Table.Cell className={col.className} key={col.id}>
                      {renderCell(role, col.id as RoleColumnId)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
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
