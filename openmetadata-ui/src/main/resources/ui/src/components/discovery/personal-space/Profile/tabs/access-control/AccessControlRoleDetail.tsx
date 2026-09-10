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
  Autocomplete,
  Box,
  Button,
  EmptyPlaceholder,
  SelectItemType,
  Table,
  TableCard,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { TFunction } from 'i18next';
import { isUndefined } from 'lodash';
import type { Key } from 'react-aria-components';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Role } from '../../../../../../generated/entity/teams/role';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import {
  getPolicies,
  getRoleByName,
  patchRole,
} from '../../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import type { AccessControlView } from './AccessControlPanel';

type RoleTab = 'policies' | 'teams' | 'users';
type DetailColumnId = 'name' | 'description' | 'actions';

// ─── Cell renderer (outside component to keep component complexity low) ────────

const renderEntityCell = (
  item: EntityReference,
  colId: DetailColumnId,
  showRemove: boolean,
  canEditAll: boolean,
  isLoadingOnSave: boolean,
  onRemove: (item: EntityReference) => void,
  t: TFunction
) => {
  if (colId === 'name') {
    return (
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {getEntityName(item)}
      </Typography>
    );
  }

  if (colId === 'description') {
    return (
      <Typography className="tw:text-sm tw:text-tertiary">
        {item.description || '--'}
      </Typography>
    );
  }

  if (colId === 'actions' && showRemove) {
    return (
      <Tooltip
        placement="left"
        title={String(canEditAll ? t('label.remove') : t(NO_PERMISSION_FOR_ACTION))}>
        <Button
          color="tertiary"
          data-testid={`remove-${getEntityName(item)}`}
          isDisabled={!canEditAll || isLoadingOnSave}
          size="xs"
          onPress={() => onRemove(item)}>
          <Delete name={String(t('label.remove'))} width="16px" />
        </Button>
      </Tooltip>
    );
  }

  return null;
};

// ─── Sub-component for entity table ───────────────────────────────────────────

interface EntityTableProps {
  ariaLabel: string;
  canEditAll: boolean;
  columns: { id: DetailColumnId; label: string }[];
  emptyTitle: string;
  headerAction?: React.ReactNode;
  isLoadingOnSave: boolean;
  items: EntityReference[] | undefined;
  showRemove: boolean;
  onRemove: (item: EntityReference) => void;
  t: TFunction;
}

const EntityTable: FC<EntityTableProps> = ({
  ariaLabel,
  canEditAll,
  columns,
  emptyTitle,
  headerAction,
  isLoadingOnSave,
  items,
  showRemove,
  onRemove,
  t,
}) => (
  <TableCard.Root className='tw:w-full' size="compact">
    {headerAction && <TableCard.Header
      className='tw:py-4'
      contentTrailing={headerAction}
    />}
    <Table aria-label={ariaLabel} size="compact">
      <Table.Header columns={columns}>
        {(col) => (
          <Table.Head id={col.id} key={col.id} label={col.label} />
        )}
      </Table.Header>
      <Table.Body
        items={items ?? []}
        renderEmptyState={() => (
          <Box className="tw:min-h-32 tw:flex tw:items-center tw:justify-center tw:relative">
            <EmptyPlaceholder title={emptyTitle} />
          </Box>
        )}>
        {(item) => (
          <Table.Row
            columns={columns}
            data-testid={getEntityName(item)}
            id={item.fullyQualifiedName ?? item.name ?? item.id}
            key={item.fullyQualifiedName ?? item.name ?? item.id}>
            {(col) => (
              <Table.Cell key={col.id}>
                {renderEntityCell(
                  item,
                  col.id as DetailColumnId,
                  showRemove,
                  canEditAll,
                  isLoadingOnSave,
                  onRemove,
                  t
                )}
              </Table.Cell>
            )}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  </TableCard.Root>
);

// ─── Main component ───────────────────────────────────────────────────────────

interface AccessControlRoleDetailProps {
  fqn: string;
  onNavigate: (view: AccessControlView) => void;
}

const AccessControlRoleDetail: React.FC<AccessControlRoleDetailProps> = ({
  fqn,
}) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [role, setRole] = useState<Role>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [activeTab, setActiveTab] = useState<RoleTab>('policies');
  const [rolePermission, setRolePermission] =
    useState<OperationPermission | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>();

  // Add policy state
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<Policy[]>([]);
  const [selectedNewPolicies, setSelectedNewPolicies] = useState<string[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);

  // Track which kind of entity is being removed
  const [removeKind, setRemoveKind] = useState<'policy' | 'user'>('policy');

  const columns = useMemo(
    () => [
      { id: 'name' as DetailColumnId, label: t('label.name') },
      { id: 'description' as DetailColumnId, label: t('label.description') },
      { id: 'actions' as DetailColumnId, label: t('label.action-plural') },
    ],
    [t]
  );

  const fetchRole = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getRoleByName(fqn, 'policies,teams,users');
      setRole(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  useEffect(() => {
    getEntityPermissionByFqn(ResourceEntity.ROLE, fqn).then(setRolePermission);
  }, [fqn, getEntityPermissionByFqn]);

  const canEditAll = rolePermission?.EditAll ?? false;

  const handleRemovePolicy = useCallback(
    async (policyRef: EntityReference) => {
      if (!role) {
        return;
      }

      const updatedRole = {
        ...role,
        policies: (role.policies ?? []).filter(
          (p) => p.fullyQualifiedName !== policyRef.fullyQualifiedName
        ),
      };

      setIsLoadingOnSave(true);
      try {
        await patchRole(compare(role, updatedRole), role.id);
        setRole(updatedRole);
        showSuccessToast(
          t('server.entity-updated-successfully', { entity: t('label.role') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    },
    [role, t]
  );

  const handleRemoveUser = useCallback(
    async (userRef: EntityReference) => {
      if (!role) {
        return;
      }

      const updatedRole = {
        ...role,
        users: (role.users ?? []).filter(
          (u) => u.fullyQualifiedName !== userRef.fullyQualifiedName
        ),
      };

      setIsLoadingOnSave(true);
      try {
        await patchRole(compare(role, updatedRole), role.id);
        setRole(updatedRole);
        showSuccessToast(
          t('server.entity-updated-successfully', { entity: t('label.role') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    },
    [role, t]
  );

  const handleStartAddPolicy = useCallback(async () => {
    setIsAddingPolicy(true);
    setIsLoadingPolicies(true);
    try {
      const data = await getPolicies('', undefined, undefined, 100);
      const existingFqns = new Set(
        (role?.policies ?? []).map((p) => p.fullyQualifiedName)
      );
      const available = (data.data ?? []).filter(
        (p) => !existingFqns.has(p.fullyQualifiedName)
      );
      setAvailablePolicies(available);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingPolicies(false);
    }
  }, [role]);

  const handleConfirmAddPolicies = useCallback(async () => {
    if (!role || selectedNewPolicies.length === 0) {
      return;
    }

    const newPolicyRefs = selectedNewPolicies
      .map((fqn) => {
        const p = availablePolicies.find(
          (ap) => ap.fullyQualifiedName === fqn || ap.name === fqn
        );

        return p
          ? ({ id: p.id, type: 'policy', fullyQualifiedName: p.fullyQualifiedName, name: p.name } as EntityReference)
          : null;
      })
      .filter(Boolean) as EntityReference[];

    const updatedRole = {
      ...role,
      policies: [...(role.policies ?? []), ...newPolicyRefs],
    };

    setIsLoadingOnSave(true);
    try {
      await patchRole(compare(role, updatedRole), role.id);
      setRole(updatedRole);
      setIsAddingPolicy(false);
      setSelectedNewPolicies([]);
      showSuccessToast(
        t('server.entity-updated-successfully', { entity: t('label.role') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingOnSave(false);
    }
  }, [role, selectedNewPolicies, availablePolicies, t]);

  const policyItems = useMemo<SelectItemType[]>(
    () =>
      availablePolicies.map((p) => ({
        id: p.fullyQualifiedName ?? p.name,
        label: p.displayName || p.name,
      })),
    [availablePolicies]
  );

  const selectedPolicyItems = useMemo<SelectItemType[]>(
    () =>
      selectedNewPolicies.map((fqn) => {
        const match = availablePolicies.find(
          (p) => p.fullyQualifiedName === fqn || p.name === fqn
        );

        return { id: fqn, label: match?.displayName || match?.name || fqn };
      }),
    [selectedNewPolicies, availablePolicies]
  );

  const handlePolicyItemInserted = useCallback((key: Key) => {
    setSelectedNewPolicies((prev) => [...prev, String(key)]);
  }, []);

  const handlePolicyItemCleared = useCallback((key: Key) => {
    setSelectedNewPolicies((prev) => prev.filter((id) => id !== String(key)));
  }, []);

  const handleEntityRemove = useCallback(
    (item: EntityReference, kind: 'policy' | 'user') => {
      setSelectedEntity(item);
      setRemoveKind(kind);
    },
    []
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!role) {
    return null;
  }

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="role-detail-container"
      direction="col">
      <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
        <Typography className="tw:text-primary" weight="medium">
          {t('label.description')}
        </Typography>
        {role.description && (
          <Typography className="tw:text-tertiary" size="text-sm">
            {role.description}
          </Typography>
        )}
      </Box>

      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(k) => setActiveTab(k as RoleTab)}>
        <Tabs.List size="sm" type="underline">
          <Tabs.Item id="policies">
            {`${t('label.policy-plural')} (${role.policies?.length ?? 0})`}
          </Tabs.Item>
          <Tabs.Item id="teams">
            {`${t('label.team-plural')} (${role.teams?.length ?? 0})`}
          </Tabs.Item>
          <Tabs.Item id="users">
            {`${t('label.user-plural')} (${role.users?.length ?? 0})`}
          </Tabs.Item>
        </Tabs.List>
      </Tabs>

      <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:p-1">
        {activeTab === 'policies' && (
          <Box className="tw:w-full" direction='col' gap={3}>
            {isAddingPolicy && (
              <Box
                className="tw:border tw:border-secondary tw:rounded-xl tw:p-4 tw:flex tw:flex-col tw:gap-4"
                direction="col">
                <Typography
                  className="tw:text-sm tw:font-semibold tw:text-primary"
                  size="text-sm"
                  weight="semibold">
                  {t('label.add-entity', { entity: t('label.policy') })}
                </Typography>
                {isLoadingPolicies ? (
                  <Loader />
                ) : (
                  <Autocomplete
                    data-testid="add-policy-select"
                    items={policyItems}
                    placeholder={t('label.select-a-policy')}
                    selectedItems={selectedPolicyItems}
                    onItemCleared={handlePolicyItemCleared}
                    onItemInserted={handlePolicyItemInserted}>
                    {(item) => (
                      <Autocomplete.Item id={item.id} key={item.id}>
                        {item.label}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete>
                )}
                <Box
                  className="tw:flex tw:gap-3 tw:justify-end"
                  direction="row">
                  <Button
                    color="tertiary"
                    size="sm"
                    onPress={() => {
                      setIsAddingPolicy(false);
                      setSelectedNewPolicies([]);
                    }}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    isDisabled={selectedNewPolicies.length === 0}
                    isLoading={isLoadingOnSave}
                    size="sm"
                    onPress={handleConfirmAddPolicies}>
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            )}

            <EntityTable
              ariaLabel={t('label.policy-plural')}
              canEditAll={canEditAll}
              columns={columns}
              emptyTitle={t('label.no-entity-found', {
                entity: t('label.policy-plural'),
              })}
              headerAction={
                canEditAll && !isAddingPolicy ? (
                  <Button
                    color="primary"
                    data-testid="add-policy"
                    size="sm"
                    onPress={handleStartAddPolicy}>
                    {t('label.add-entity', { entity: t('label.policy') })}
                  </Button>
                ) : undefined
              }
              isLoadingOnSave={isLoadingOnSave}
              items={role.policies}
              showRemove={canEditAll}
              t={t}
              onRemove={(item) => handleEntityRemove(item, 'policy')}
            />
          </Box>
        )}

        {activeTab === 'teams' && (
          <EntityTable
            ariaLabel={t('label.team-plural')}
            canEditAll={canEditAll}
            columns={columns}
            emptyTitle={t('label.no-entity-found', {
              entity: t('label.team-plural'),
            })}
            isLoadingOnSave={isLoadingOnSave}
            items={role.teams}
            showRemove={false}
            t={t}
            onRemove={(item) => handleEntityRemove(item, 'policy')}
          />
        )}

        {activeTab === 'users' && (
          <EntityTable
            ariaLabel={t('label.user-plural')}
            canEditAll={canEditAll}
            columns={columns}
            emptyTitle={t('label.no-entity-found', {
              entity: t('label.user-plural'),
            })}
            isLoadingOnSave={isLoadingOnSave}
            items={role.users}
            showRemove={canEditAll}
            t={t}
            onRemove={(item) => handleEntityRemove(item, 'user')}
          />
        )}
      </Box>

      {selectedEntity && (
        <DeleteModal
          entityTitle={getEntityName(selectedEntity)}
          isDeleting={isLoadingOnSave}
          message={t('message.remove-entity-from-role', {
            entity: getEntityName(selectedEntity),
            role: getEntityName(role),
          })}
          open={!isUndefined(selectedEntity)}
          onCancel={() => setSelectedEntity(undefined)}
          onDelete={async () => {
            if (removeKind === 'user') {
              await handleRemoveUser(selectedEntity);
            } else {
              await handleRemovePolicy(selectedEntity);
            }
            setSelectedEntity(undefined);
          }}
        />
      )}
    </Box>
  );
};

export default AccessControlRoleDetail;
