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
  ButtonUtility,
  EmptyPlaceholder,
  Input,
  SelectItemType,
  Table,
  TableCard,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFilter } from 'react-aria';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { Role } from '../../../../../../generated/entity/teams/role';
import { EntityReference } from '../../../../../../generated/entity/type';
import { useAuth } from '../../../../../../hooks/authHooks';
import {
  getPolicies,
  getRoleByName,
  patchRole,
} from '../../../../../../rest/rolesAPIV1';
import {
  getTeamByName,
  patchTeamDetail,
} from '../../../../../../rest/teamsAPI';
import { getUserById, updateUserDetail } from '../../../../../../rest/userAPI';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { AccessControlView } from './AccessControl.types';

type RoleTab = 'policies' | 'teams' | 'users';
type DetailColumnId = 'name' | 'description' | 'actions';
type DetailColumn = { id: DetailColumnId; label: string; className?: string };

// ─── Description cell renderer ────────────────────────────────────────────────

const DescriptionCell: FC<{ value: string | undefined }> = ({ value }) => {
  if (value) {
    return <RichTextEditorPreviewerV1 markdown={value} />;
  }

  return (
    <Typography className="tw:text-tertiary" size="text-sm">
      --
    </Typography>
  );
};

// ─── Cell renderer (outside component to keep component complexity low) ────────

const renderEntityCell = (
  item: EntityReference,
  colId: DetailColumnId,
  showRemove: boolean,
  canEditAll: boolean,
  isLoadingOnSave: boolean,
  onRemove: (item: EntityReference) => void,
  t: ReturnType<typeof useTranslation>['t'],
  onNavigateToDetail?: (item: EntityReference) => void
) => {
  if (colId === 'name') {
    const name = getEntityName(item);
    if (onNavigateToDetail) {
      return (
        <Button
          ellipsis
          className="tw:max-w-58"
          color="link-color"
          data-testid={`link-${name}`}
          onPress={() => onNavigateToDetail(item)}>
          {name}
        </Button>
      );
    }

    return (
      <Typography ellipsis weight="medium">
        {name}
      </Typography>
    );
  }

  if (colId === 'description') {
    return <DescriptionCell value={item.description} />;
  }

  if (colId === 'actions' && showRemove) {
    return (
      <ButtonUtility
        color="tertiary"
        data-testid={`remove-${getEntityName(item)}`}
        icon={Delete}
        isDisabled={!canEditAll || isLoadingOnSave}
        size="xs"
        tooltip={String(
          canEditAll ? t('label.remove') : t(NO_PERMISSION_FOR_ACTION)
        )}
        tooltipPlacement="left"
        onPress={() => onRemove(item)}
      />
    );
  }

  return null;
};

// ─── Sub-component for entity table ───────────────────────────────────────────

interface EntityTableProps {
  ariaLabel: string;
  canEditAll: boolean;
  columns: DetailColumn[];
  emptyTitle: string;
  headerAction?: React.ReactNode;
  isLoadingOnSave: boolean;
  items: EntityReference[] | undefined;
  showRemove: boolean;
  onNavigateToDetail?: (item: EntityReference) => void;
  onRemove: (item: EntityReference) => void;
  t: ReturnType<typeof useTranslation>['t'];
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
  onNavigateToDetail,
  onRemove,
  t,
}) => (
  <TableCard.Root className="tw:w-full" size="compact">
    {headerAction && (
      <TableCard.Header
        className="tw:py-4"
        contentTrailing={headerAction}
        title=""
      />
    )}
    <Table aria-label={ariaLabel} className="tw:table-fixed" size="compact">
      <Table.Header columns={columns}>
        {(col) => (
          <Table.Head
            className={col.className}
            id={col.id}
            isRowHeader={col.id === 'name'}
            key={col.id}
            label={col.label}
          />
        )}
      </Table.Header>
      <Table.Body
        items={items ?? []}
        renderEmptyState={() => (
          <Box
            align="center"
            className="tw:min-h-32 tw:relative"
            justify="center">
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
              <Table.Cell className={col.className} key={col.id}>
                {renderEntityCell(
                  item,
                  col.id as DetailColumnId,
                  showRemove,
                  canEditAll,
                  isLoadingOnSave,
                  onRemove,
                  t,
                  onNavigateToDetail
                )}
              </Table.Cell>
            )}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  </TableCard.Root>
);

// ─── Inline description editor ─────────────────────────────────────────────────

interface InlineDescriptionEditorProps {
  canEdit: boolean;
  description: string | undefined;
  isSaving: boolean;
  editorRef: React.RefObject<EditorContentRef>;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const InlineDescriptionEditor: FC<InlineDescriptionEditorProps> = ({
  canEdit,
  description,
  isSaving,
  editorRef,
  isEditing,
  onStartEdit,
  onCancel,
  onSave,
  t,
}) => (
  <Box className="tw:mb-4" direction="col">
    <Box align="center" direction="row" gap={2}>
      <Typography className="tw:text-primary" weight="medium">
        {t('label.description')}
      </Typography>
      {canEdit && !isEditing && (
        <ButtonUtility
          color="tertiary"
          data-testid="edit-description-btn"
          icon={Edit}
          size="xs"
          tooltip={String(
            t('label.edit-entity', { entity: t('label.description') })
          )}
          tooltipPlacement="right"
          onPress={onStartEdit}
        />
      )}
    </Box>

    {isEditing ? (
      <Box data-testid="edit-description-modal" direction="col" gap={2}>
        <RichTextEditor
          className="new-form-style"
          initialValue={description ?? ''}
          ref={editorRef}
        />
        <Box direction="row" gap={2} justify="end">
          <Button
            color="tertiary"
            isDisabled={isSaving}
            size="sm"
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            isLoading={isSaving}
            size="sm"
            onPress={onSave}>
            {t('label.save')}
          </Button>
        </Box>
      </Box>
    ) : (
      <DescriptionCell value={description} />
    )}
  </Box>
);

// ─── Rename input rendered inside the page header ─────────────────────────────

interface RenameHeaderInputProps {
  isSaving: boolean;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const RenameHeaderInput: FC<RenameHeaderInputProps> = ({
  isSaving,
  value,
  onChange,
  onCancel,
  onSave,
  t,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <Box align="center" direction="row" gap={2}>
      <Input
        className="tw:text-lg tw:font-bold"
        data-testid="rename-input"
        ref={inputRef}
        value={value}
        onChange={onChange}
      />
      <Button
        color="tertiary"
        isDisabled={isSaving}
        size="sm"
        onPress={onCancel}>
        {t('label.cancel')}
      </Button>
      <Button
        color="primary"
        isDisabled={!value.trim()}
        isLoading={isSaving}
        size="sm"
        onPress={onSave}>
        {t('label.save')}
      </Button>
    </Box>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface AccessControlRoleDetailProps {
  fqn: string;
  onNavigate: (view: AccessControlView) => void;
  onRename?: (newDisplayName: string) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput?: (titleInput: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (titleSuffix: React.ReactNode) => void;
}

const AccessControlRoleDetail: React.FC<AccessControlRoleDetailProps> = ({
  fqn,
  onNavigate,
  onRename,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { contains } = useFilter({ sensitivity: 'base' });

  const [role, setRole] = useState<Role>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [activeTab, setActiveTab] = useState<RoleTab>('policies');
  const [rolePermission, setRolePermission] =
    useState<OperationPermission | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>();

  // Inline description editing
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  // Inline rename via page header
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Delete role modal
  const [isDeleteRoleOpen, setIsDeleteRoleOpen] = useState(false);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  // Add policy state
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState<Policy[]>([]);
  const [selectedNewPolicies, setSelectedNewPolicies] = useState<string[]>([]);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);

  const [removeKind, setRemoveKind] = useState<'policy' | 'user' | 'team'>(
    'policy'
  );

  const columns = useMemo<DetailColumn[]>(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-60' },
      { id: 'description', label: t('label.description') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
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

  const { canEditAll, canDelete } = getDerivedPermissionFlags(
    rolePermission ?? DEFAULT_ENTITY_PERMISSION
  );

  const handleSaveRename = useCallback(async () => {
    if (!role || !renameValue.trim()) {
      return;
    }

    const updatedRole = { ...role, displayName: renameValue.trim() };

    setIsSavingRename(true);
    try {
      await patchRole(compare(role, updatedRole), role.id);
      setIsRenameOpen(false);
      onRename?.(renameValue.trim());
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.role') })
      );
      await fetchRole();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingRename(false);
    }
  }, [role, renameValue, t, fetchRole]);

  // Inject rename/delete actions + optional inline title into the page header.
  useEffect(() => {
    if (!role) {
      return;
    }

    const titleInputNode: React.ReactNode = isRenameOpen ? (
      <RenameHeaderInput
        isSaving={isSavingRename}
        t={t}
        value={renameValue}
        onCancel={() => {
          setIsRenameOpen(false);
          setRenameValue('');
        }}
        onChange={setRenameValue}
        onSave={handleSaveRename}
      />
    ) : undefined;

    const renameButtonNode: React.ReactNode = isRenameOpen ? undefined : (
      <ButtonUtility
        color="tertiary"
        data-testid="rename-role-btn"
        icon={Edit}
        isDisabled={!canEditAll}
        size="xs"
        tooltip={String(
          canEditAll ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION)
        )}
        tooltipPlacement="right"
        onPress={() => {
          setRenameValue(role.displayName || role.name || '');
          setIsRenameOpen(true);
        }}
      />
    );

    const deleteButtonNode: React.ReactNode = isRenameOpen ? undefined : (
      <ButtonUtility
        color="tertiary"
        data-testid="delete-role-btn"
        icon={Delete}
        isDisabled={!canDelete}
        size="xs"
        tooltip={String(
          canDelete ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION)
        )}
        tooltipPlacement="left"
        onPress={() => setIsDeleteRoleOpen(true)}
      />
    );

    onSetHeaderTitleSuffix?.(renameButtonNode);
    onSetHeaderActions?.(deleteButtonNode);
    onSetHeaderTitleInput?.(titleInputNode);
  }, [
    role,
    canEditAll,
    canDelete,
    isRenameOpen,
    renameValue,
    isSavingRename,
    handleSaveRename,
    t,
    onSetHeaderActions,
    onSetHeaderTitleInput,
    onSetHeaderTitleSuffix,
  ]);

  const handleSaveDescription = useCallback(async () => {
    if (!role || !descEditorRef.current) {
      return;
    }

    const newDescription = descEditorRef.current.getEditorContent();
    const updatedRole = { ...role, description: newDescription };

    setIsSavingDesc(true);
    try {
      await patchRole(compare(role, updatedRole), role.id);
      setIsEditingDesc(false);
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.role') })
      );
      await fetchRole();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDesc(false);
    }
  }, [role, t, fetchRole]);

  const handleDeleteRole = useCallback(async () => {
    if (!role) {
      return;
    }

    setIsDeletingRole(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(role),
      role.id ?? '',
      EntityType.ROLE
    );
    setIsDeletingRole(false);
    setIsDeleteRoleOpen(false);

    if (isSuccess) {
      onNavigate({ type: 'roles' });
    }
  }, [role, onNavigate]);

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
          t('server.entity-updated-success', { entity: t('label.role') })
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

      const userId = userRef.id;

      if (!userId) {
        return;
      }

      setIsLoadingOnSave(true);
      try {
        const user = await getUserById(userId, { fields: 'roles' });
        const updatedUser = {
          ...user,
          roles: (user.roles ?? []).filter((r) => r.id !== role.id),
        };
        await updateUserDetail(userId, compare(user, updatedUser));
        setRole({
          ...role,
          users: (role.users ?? []).filter((u) => u.id !== userRef.id),
        });
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.role') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    },
    [role, t]
  );

  const handleRemoveTeam = useCallback(
    async (teamRef: EntityReference) => {
      if (!role) {
        return;
      }

      setIsLoadingOnSave(true);
      try {
        const team = await getTeamByName(
          teamRef.fullyQualifiedName ?? teamRef.name ?? '',
          { fields: 'defaultRoles' }
        );
        const updatedDefaultRoles = (team.defaultRoles ?? []).filter(
          (r) => r.id !== role.id
        );
        const patch = compare(team, {
          ...team,
          defaultRoles: updatedDefaultRoles,
        });
        await patchTeamDetail(team.id ?? '', patch);
        setRole((prev) =>
          prev
            ? {
                ...prev,
                teams: (prev.teams ?? []).filter((t) => t.id !== teamRef.id),
              }
            : prev
        );
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.role') })
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
      .map((selectedFqn) => {
        const p = availablePolicies.find(
          (ap) =>
            ap.fullyQualifiedName === selectedFqn || ap.name === selectedFqn
        );

        return p
          ? ({
              id: p.id,
              type: 'policy',
              fullyQualifiedName: p.fullyQualifiedName,
              name: p.name,
            } as EntityReference)
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
        t('server.entity-updated-success', { entity: t('label.role') })
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
      selectedNewPolicies.map((selectedFqn) => {
        const match = availablePolicies.find(
          (p) => p.fullyQualifiedName === selectedFqn || p.name === selectedFqn
        );

        return {
          id: selectedFqn,
          label: match?.displayName || match?.name || selectedFqn,
        };
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
    (item: EntityReference, kind: 'policy' | 'user' | 'team') => {
      setSelectedEntity(item);
      setRemoveKind(kind);
    },
    []
  );

  const renderPoliciesTab = useCallback(
    () => (
      <Box className="tw:w-full" direction="col" gap={3}>
        {isAddingPolicy && (
          <Box
            className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
            direction="col"
            gap={4}>
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="semibold">
              {t('label.add-entity', { entity: t('label.policy') })}
            </Typography>
            {isLoadingPolicies ? (
              <Loader />
            ) : (
              <Autocomplete
                data-testid="add-policy-select"
                filterOption={(item, filterText) =>
                  contains(item.label || '', filterText) ||
                  contains(String(item.id), filterText)
                }
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
            <Box direction="row" gap={3} justify="end">
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
          items={role?.policies}
          showRemove={canEditAll}
          t={t}
          onNavigateToDetail={(item) =>
            onNavigate({
              type: 'policies-detail',
              fqn: item.fullyQualifiedName ?? item.name ?? '',
              name: getEntityName(item),
            })
          }
          onRemove={(item) => handleEntityRemove(item, 'policy')}
        />
      </Box>
    ),
    [
      canEditAll,
      columns,
      contains,
      handleConfirmAddPolicies,
      handleEntityRemove,
      handlePolicyItemCleared,
      handlePolicyItemInserted,
      handleStartAddPolicy,
      isAddingPolicy,
      isLoadingOnSave,
      isLoadingPolicies,
      onNavigate,
      policyItems,
      role,
      selectedNewPolicies,
      selectedPolicyItems,
      t,
    ]
  );

  const renderTeamsTab = useCallback(
    () => (
      <EntityTable
        ariaLabel={t('label.team-plural')}
        canEditAll={Boolean(isAdminUser)}
        columns={columns}
        emptyTitle={t('label.no-entity-found', {
          entity: t('label.team-plural'),
        })}
        isLoadingOnSave={isLoadingOnSave}
        items={role?.teams}
        showRemove={Boolean(isAdminUser)}
        t={t}
        onRemove={(item) => handleEntityRemove(item, 'team')}
      />
    ),
    [columns, handleEntityRemove, isAdminUser, isLoadingOnSave, role, t]
  );

  const renderUsersTab = useCallback(
    () => (
      <EntityTable
        ariaLabel={t('label.user-plural')}
        canEditAll={Boolean(isAdminUser)}
        columns={columns}
        emptyTitle={t('label.no-entity-found', {
          entity: t('label.user-plural'),
        })}
        isLoadingOnSave={isLoadingOnSave}
        items={role?.users}
        showRemove={Boolean(isAdminUser)}
        t={t}
        onRemove={(item) => handleEntityRemove(item, 'user')}
      />
    ),
    [columns, handleEntityRemove, isAdminUser, isLoadingOnSave, role, t]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!role) {
    return null;
  }

  const roleName = getEntityName(role);

  const tabRenderers: Record<RoleTab, () => React.ReactNode> = {
    policies: renderPoliciesTab,
    teams: renderTeamsTab,
    users: renderUsersTab,
  };

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="role-detail-container"
      direction="col"
      gap={4}>
      <InlineDescriptionEditor
        canEdit={canEditAll}
        description={role.description}
        editorRef={descEditorRef}
        isEditing={isEditingDesc}
        isSaving={isSavingDesc}
        t={t}
        onCancel={() => setIsEditingDesc(false)}
        onSave={handleSaveDescription}
        onStartEdit={() => setIsEditingDesc(true)}
      />

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
        {tabRenderers[activeTab]()}
      </Box>

      {selectedEntity && (
        <DeleteModal
          entityTitle={t('label.remove-entity', {
            entity: getEntityName(selectedEntity),
          })}
          isDeleting={isLoadingOnSave}
          message={t(
            'message.are-you-sure-you-want-to-remove-child-from-parent',
            {
              child: getEntityName(selectedEntity),
              parent: roleName,
            }
          )}
          open={!isUndefined(selectedEntity)}
          onCancel={() => setSelectedEntity(undefined)}
          onDelete={async () => {
            if (removeKind === 'user') {
              await handleRemoveUser(selectedEntity);
            } else if (removeKind === 'team') {
              await handleRemoveTeam(selectedEntity);
            } else {
              await handleRemovePolicy(selectedEntity);
            }
            setSelectedEntity(undefined);
          }}
        />
      )}

      <DeleteModal
        entityTitle={roleName}
        isDeleting={isDeletingRole}
        message={t('message.permanently-delete-common-message', {
          entity: roleName.toLowerCase(),
        })}
        open={isDeleteRoleOpen}
        onCancel={() => setIsDeleteRoleOpen(false)}
        onDelete={handleDeleteRole}
      />
    </Box>
  );
};

export default AccessControlRoleDetail;
