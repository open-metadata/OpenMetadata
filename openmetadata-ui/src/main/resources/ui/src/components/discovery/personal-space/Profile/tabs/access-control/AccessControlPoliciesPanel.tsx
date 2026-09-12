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
import {
    Operation,
    Policy
} from '../../../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Paging } from '../../../../../../generated/type/paging';
import { getPolicies } from '../../../../../../rest/rolesAPIV1';
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

type PolicyColumnId = 'name' | 'description' | 'roles' | 'actions';
type PolicyColumn = { id: PolicyColumnId; label: string; className?: string };

interface AccessControlPoliciesPanelProps {
  onNavigate?: (view: AccessControlView) => void;
}

const AccessControlPoliciesPanel: React.FC<AccessControlPoliciesPanelProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);
  const [paging, setPaging] = useState<Paging>({ total: 0 });

  const showPagination = useMemo(
    () => Boolean(paging.before || paging.after) || paging.total > pageSize,
    [paging, pageSize]
  );

  const { permissions } = usePermissionProvider();

  const deletePolicyPermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.POLICY, permissions),
    [permissions]
  );

  const viewRolePermission = useMemo(
    () =>
      !isEmpty(permissions) &&
      userPermissions?.hasViewPermissions(ResourceEntity.ROLE, permissions),
    [permissions]
  );

  const columns = useMemo<PolicyColumn[]>(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-70' },
      { id: 'description', label: t('label.description') },
      { id: 'roles', label: t('label.role-plural'), className: 'tw:w-60' },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
    ],
    [t]
  );

  const fetchPolicies = async (pagingParam?: Partial<Paging>) => {
    setIsLoading(true);
    try {
      const data = await getPolicies(
        'roles',
        pagingParam?.after,
        pagingParam?.before,
        pageSize
      );

      setPolicies(data.data || []);
      setPaging(data.paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAfterDeleteAction = useCallback(() => {
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePolicyDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(selectedPolicy),
      selectedPolicy?.id ?? '',
      EntityType.POLICY
    );

    if (isSuccess) {
      handleAfterDeleteAction();
    }

    setSelectedPolicy(undefined);
    setIsDeleting(false);
  }, [selectedPolicy, handleAfterDeleteAction]);

  const handlePolicyClick = (policy: Policy) => {
    if (onNavigate) {
      onNavigate({
        type: 'policies-detail',
        fqn: policy.fullyQualifiedName ?? '',
        name: getEntityName(policy),
      });
    }
  };

  const handlePageNavigation = (newPage: number) => {
    if (newPage > currentPage && paging?.after) {
      setCurrentPage(newPage);
      fetchPolicies({ after: paging.after });
    } else if (newPage < currentPage && paging?.before) {
      setCurrentPage(newPage);
      fetchPolicies({ before: paging.before });
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const renderRoleItem = (role: EntityReference) => {
    const key = uniqueId();

    if (!viewRolePermission) {
      return (
        <Tooltip key={key} title={t(NO_PERMISSION_TO_VIEW)}>
          <Typography ellipses>{getEntityName(role)}</Typography>
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
              type: 'roles-detail',
              fqn: role.fullyQualifiedName ?? '',
              name: getEntityName(role),
            })
          }>
          {getEntityName(role)}
        </Button>
      );
    }

    return (
      <Link
        key={key}
        className='tw:truncate tw:block'
        to={getRoleWithFqnPath(role.fullyQualifiedName ?? '')}>
        {getEntityName(role)}
      </Link>
    );
  };

  // Extracted to keep renderCell complexity under the threshold.
  const renderRolesCell = (roles: EntityReference[] | undefined) => {
    const listLength = roles?.length ?? 0;
    const hasMore = listLength > LIST_CAP;

    if (!roles?.length) {
      return '--';
    }

    return (
      <Box
        className="tw:flex-wrap"
        data-testid="role-link"
        direction="row"
        gap={1}>
        {roles.slice(0, LIST_CAP).map(renderRoleItem)}
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
                {roles.slice(LIST_CAP).map(renderRoleItem)}
              </Box>
            </Popover>
          </PopoverTrigger>
        )}
      </Box>
    );
  };

  const renderCell = (policy: Policy, colId: PolicyColumnId) => {
    switch (colId) {
      case 'name':
        return onNavigate ? (
          <Tooltip placement="top" title={getEntityName(policy)}>
            <Button
              className="tw:max-w-full tw:truncate tw:block tw:text-left"
              color="link-color"
              data-testid="policy-name"
              size="sm"
              onPress={() => handlePolicyClick(policy)}>
              {getEntityName(policy)}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip placement="top" title={getEntityName(policy)} triggerClassName="tw:block tw:w-full">
            <Link
              className="tw:block tw:truncate link-hover"
              data-testid="policy-name"
              to={
                policy.fullyQualifiedName
                  ? getPolicyWithFqnPath(policy.fullyQualifiedName)
                  : ''
              }>
              {getEntityName(policy)}
            </Link>
          </Tooltip>
        );

      case 'description':
        return policy.description ? (
          <RichTextEditorPreviewerV1 markdown={policy.description} />
        ) : (
          <span className="tw:text-sm tw:text-secondary">--</span>
        );

      case 'roles':
        return renderRolesCell(policy.roles);

      case 'actions':
        return (
          <Tooltip
            placement="left"
            title={
              deletePolicyPermission
                ? t('label.delete-entity', { entity: t('label.policy') })
                : t(NO_PERMISSION_FOR_ACTION)
            }>
            <Button
              color="tertiary"
              data-testid={`delete-action-${getEntityName(policy)}`}
              isDisabled={!deletePolicyPermission}
              size="xs"
              onPress={() => setSelectedPolicy(policy)}>
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
              entity: t('label.policy-plural'),
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
      data-testid="policies-list-container"
      direction="col"
      gap={4}>
      <TableCard.Root size="compact">
        <div className="tw:overflow-y-auto tw:max-h-[480px]">
          <Table
            className="tw:table-fixed"
            aria-label={t('label.policy-plural')}
            data-testid="policies-list-table"
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
              items={isLoading ? [] : policies}
              renderEmptyState={renderEmptyState}>
              {(policy) => (
                <Table.Row
                  columns={columns}
                  data-testid={`policy-${getEntityName(policy)}`}
                  id={policy.id ?? policy.name}
                  key={policy.id ?? policy.name}>
                  {(col) => (
                    <Table.Cell className={col.className} key={col.id}>
                      {renderCell(policy, col.id as PolicyColumnId)}
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

      {selectedPolicy && deletePolicyPermission && (
        <DeleteModal
          entityTitle={getEntityName(selectedPolicy)}
          isDeleting={isDeleting}
          message={t('message.permanently-delete-common-message', {
            entity: getEntityName(selectedPolicy)?.toLowerCase?.() ?? '',
          })}
          open={!isUndefined(selectedPolicy)}
          onCancel={() => setSelectedPolicy(undefined)}
          onDelete={handlePolicyDelete}
        />
      )}
    </Box>
  );
};

export default AccessControlPoliciesPanel;
