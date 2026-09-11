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
import { Link } from 'react-router-dom';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { CursorType } from '../../../../../../enums/pagination.enum';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
  Operation,
  Policy,
} from '../../../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Paging } from '../../../../../../generated/type/paging';
import { usePaging } from '../../../../../../hooks/paging/usePaging';
import { getPolicies } from '../../../../../../rest/rolesAPIV1';
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

type PolicyColumnId = 'name' | 'description' | 'roles' | 'actions';

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

  const columns = useMemo(
    () => [
      { id: 'name' as PolicyColumnId, label: t('label.name') },
      { id: 'description' as PolicyColumnId, label: t('label.description') },
      { id: 'roles' as PolicyColumnId, label: t('label.role-plural') },
      { id: 'actions' as PolicyColumnId, label: t('label.action-plural') },
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
      handlePagingChange(data.paging);
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
      fetchPolicies({ after: paging.after, total: paging.total } as Paging);
      handlePageChange(
        newPage,
        { cursorType: CursorType.AFTER, cursorValue: paging.after },
        pageSize
      );
    } else if (newPage < currentPage && paging?.before) {
      fetchPolicies({ before: paging.before, total: paging.total } as Paging);
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
      fetchPolicies({ [cursorType]: cursorValue });
    } else {
      fetchPolicies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, pagingCursor]);

  const renderRoleItem = (role: EntityReference) => {
    const key = uniqueId();

    if (!viewRolePermission) {
      return (
        <Tooltip key={key} title={t(NO_PERMISSION_TO_VIEW)}>
          <Box className="tw:text-sm">{getEntityName(role)}</Box>
        </Tooltip>
      );
    }

    if (onNavigate) {
      return (
        <Button
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
        className="tw:flex tw:flex-wrap tw:gap-1"
        data-testid="role-link"
        direction="row">
        {roles.slice(0, LIST_CAP).map(renderRoleItem)}
        {hasMore && (
          <Tooltip
            title={
              <Box className="tw:flex tw:flex-col tw:gap-1">
                {roles.slice(LIST_CAP).map(renderRoleItem)}
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

  const renderCell = (policy: Policy, colId: PolicyColumnId) => {
    switch (colId) {
      case 'name':
        return onNavigate ? (
          <Button
            color="link-color"
            data-testid="policy-name"
            size="sm"
            onPress={() => handlePolicyClick(policy)}>
            {getEntityName(policy)}
          </Button>
        ) : (
          <Link
            className="link-hover"
            data-testid="policy-name"
            to={
              policy.fullyQualifiedName
                ? getPolicyWithFqnPath(policy.fullyQualifiedName)
                : ''
            }>
            {getEntityName(policy)}
          </Link>
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

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4 tw:pt-1"
      data-testid="policies-list-container">
      <TableCard.Root size="compact">
        {isLoading ? (
          <Box className="tw:flex tw:justify-center tw:p-8">
            <Loader />
          </Box>
        ) : (
          <Table
            aria-label={t('label.policy-plural')}
            data-testid="policies-list-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head id={col.id} key={col.id} label={col.label} />
              )}
            </Table.Header>
            <Table.Body
              items={policies}
              renderEmptyState={() => (
                <Box className="tw:min-h-32 tw:flex tw:items-center tw:justify-center tw:relative">
                  <EmptyPlaceholder
                    title={t('label.no-entity-found', {
                      entity: t('label.policy-plural'),
                    })}
                  />
                </Box>
              )}>
              {(policy) => (
                <Table.Row
                  columns={columns}
                  data-testid={`policy-${getEntityName(policy)}`}
                  id={policy.id ?? policy.name}
                  key={policy.id ?? policy.name}>
                  {(col) => (
                    <Table.Cell key={col.id}>
                      {renderCell(policy, col.id as PolicyColumnId)}
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
