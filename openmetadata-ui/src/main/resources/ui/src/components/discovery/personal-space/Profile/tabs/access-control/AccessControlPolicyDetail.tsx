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
  ButtonUtility,
  EmptyPlaceholder,
  Input,
  Table,
  TableCard,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
  Effect,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../../../generated/entity/type';
import { useAuth } from '../../../../../../hooks/authHooks';
import {
  getPolicyByName,
  getRoleByName,
  patchPolicy,
  patchRole,
} from '../../../../../../rest/rolesAPIV1';
import {
  getTeamByName,
  patchTeamDetail,
} from '../../../../../../rest/teamsAPI';
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
import { INITIAL_RULE } from './AccessControl.constants';
import type { AccessControlView } from './AccessControl.types';
import AccessControlRuleForm from './AccessControlRuleForm';

type PolicyTab = 'rules' | 'roles' | 'teams';
type DetailColumnId = 'name' | 'description' | 'actions';
type DetailColumn = { id: DetailColumnId; label: string; className?: string };

// ─── Description cell ─────────────────────────────────────────────────────────

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

// ─── Inline description editor ────────────────────────────────────────────────

interface InlineDescriptionEditorProps {
  canEdit: boolean;
  description: string | undefined;
  editorRef: React.RefObject<EditorContentRef>;
  isEditing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  onStartEdit: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const InlineDescriptionEditor: FC<InlineDescriptionEditorProps> = ({
  canEdit,
  description,
  editorRef,
  isEditing,
  isSaving,
  onCancel,
  onSave,
  onStartEdit,
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
          tooltip={t('label.edit-entity', { entity: t('label.description') })}
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

// ─── Rename input for page header ─────────────────────────────────────────────

interface RenameHeaderInputProps {
  isSaving: boolean;
  value: string;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const RenameHeaderInput: FC<RenameHeaderInputProps> = ({
  isSaving,
  value,
  onCancel,
  onChange,
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

// ─── Rule card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  canEditAll: boolean;
  isActionsDisabled: boolean;
  isLoadingOnSave: boolean;
  rule: Rule;
  t: ReturnType<typeof useTranslation>['t'];
  onDelete: (name: string) => void;
  onEdit: (rule: Rule) => void;
}

function getPermissionTooltipTitle(
  canEdit: boolean,
  allowed: string,
  denied: string
): string {
  return String(canEdit ? allowed : denied);
}

const formatList = (items?: string[]) => items?.join(', ') || '--';

const RuleCard: FC<RuleCardProps> = ({
  canEditAll,
  isActionsDisabled,
  isLoadingOnSave,
  rule,
  t,
  onDelete,
  onEdit,
}) => {
  const effectClass =
    rule.effect === Effect.Allow
      ? 'tw:text-success-primary'
      : 'tw:text-error-primary';

  return (
    <Box
      className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
      data-testid={`rule-${rule.name}`}
      direction="col"
      gap={2}>
      <Box align="center" direction="row" justify="between">
        <Typography
          className="tw:text-primary"
          size="text-sm"
          weight="semibold">
          {rule.name}
        </Typography>
        <Box direction="row" gap={1}>
          <ButtonUtility
            color="tertiary"
            data-testid={`edit-rule-${rule.name}`}
            icon={Edit}
            isDisabled={!canEditAll || isLoadingOnSave || isActionsDisabled}
            size="xs"
            tooltip={getPermissionTooltipTitle(
              canEditAll,
              t('label.edit'),
              t(NO_PERMISSION_FOR_ACTION)
            )}
            tooltipPlacement="left"
            onPress={() => onEdit(rule)}
          />
          <ButtonUtility
            color="tertiary"
            data-testid={`delete-rule-${rule.name}`}
            icon={Delete}
            isDisabled={!canEditAll || isLoadingOnSave || isActionsDisabled}
            size="xs"
            tooltip={getPermissionTooltipTitle(
              canEditAll,
              t('label.delete'),
              t(NO_PERMISSION_FOR_ACTION)
            )}
            tooltipPlacement="left"
            onPress={() => onDelete(rule.name ?? '')}
          />
        </Box>
      </Box>
      <Box direction="col" gap={1}>
        <Box direction="row" gap={2}>
          <Typography className="tw:text-secondary tw:shrink-0" size="text-sm">
            {`${t('label.resource-plural')}:`}
          </Typography>
          <Typography className="tw:text-primary" size="text-sm">
            {formatList(rule.resources)}
          </Typography>
        </Box>
        <Box direction="row" gap={2}>
          <Typography className="tw:text-secondary tw:shrink-0" size="text-sm">
            {`${t('label.operation-plural')}:`}
          </Typography>
          <Typography className="tw:text-primary" size="text-sm">
            {formatList(rule.operations)}
          </Typography>
        </Box>
        <Box direction="row" gap={2}>
          <Typography className="tw:text-secondary tw:shrink-0" size="text-sm">
            {`${t('label.effect')}:`}
          </Typography>
          <Typography className={effectClass} size="text-sm" weight="medium">
            {rule.effect}
          </Typography>
        </Box>
        {rule.description && (
          <Box direction="row" gap={2}>
            <Typography
              className="tw:text-secondary tw:shrink-0"
              size="text-sm">
              {`${t('label.description')}:`}
            </Typography>
            <RichTextEditorPreviewerV1 markdown={rule.description} />
          </Box>
        )}
        {rule.condition && (
          <Box direction="row" gap={2}>
            <Typography
              className="tw:text-secondary tw:shrink-0"
              size="text-sm">
              {`${t('label.condition')}:`}
            </Typography>
            <code className="tw:text-xs tw:bg-secondary tw:px-1 tw:rounded">
              {rule.condition}
            </code>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ─── Role/team cell ───────────────────────────────────────────────────────────

const renderRoleOrTeamCell = (
  item: EntityReference,
  colId: DetailColumnId,
  kind: 'role' | 'team',
  canEditAll: boolean,
  isLoadingOnSave: boolean,
  onRemove: (item: EntityReference, kind: 'role' | 'team') => void,
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

  if (colId === 'actions' && canEditAll) {
    return (
      <ButtonUtility
        color="tertiary"
        data-testid={`remove-${getEntityName(item)}`}
        icon={Delete}
        isDisabled={isLoadingOnSave}
        size="xs"
        tooltip={t('label.remove')}
        tooltipPlacement="left"
        onPress={() => onRemove(item, kind)}
      />
    );
  }

  return null;
};

// ─── Role/team table ──────────────────────────────────────────────────────────

interface RoleOrTeamTableProps {
  canEditAll: boolean;
  columns: DetailColumn[];
  emptyTitle: string;
  isLoadingOnSave: boolean;
  items: EntityReference[];
  kind: 'role' | 'team';
  label: string;
  onNavigateToDetail?: (item: EntityReference) => void;
  t: ReturnType<typeof useTranslation>['t'];
  onRemove: (item: EntityReference, kind: 'role' | 'team') => void;
}

const RoleOrTeamTable: FC<RoleOrTeamTableProps> = ({
  canEditAll,
  columns,
  emptyTitle,
  isLoadingOnSave,
  items,
  kind,
  label,
  onNavigateToDetail,
  t,
  onRemove,
}) => (
  <Box className="tw:w-full tw:overflow-x-auto tw:p-1" direction="col">
    <TableCard.Root className="tw:w-full" size="compact">
      <Table aria-label={label} className="tw:table-fixed" size="compact">
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
          items={items}
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
                  {renderRoleOrTeamCell(
                    item,
                    col.id as DetailColumnId,
                    kind,
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
  </Box>
);

// ─── Business-logic hook ──────────────────────────────────────────────────────

const usePolicyDetail = (fqn: string) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const [policy, setPolicy] = useState<Policy>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [policyPermission, setPolicyPermission] =
    useState<OperationPermission | null>(null);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>();
  const ruleForm = useForm<Rule>({ defaultValues: INITIAL_RULE });
  const [removeKind, setRemoveKind] = useState<'role' | 'team'>('role');

  const fetchPolicy = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPolicyByName(fqn, 'owners,location,teams,roles');
      setPolicy(data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  useEffect(() => {
    getEntityPermissionByFqn(ResourceEntity.POLICY, fqn).then(
      setPolicyPermission
    );
  }, [fqn, getEntityPermissionByFqn]);

  const handleSaveRule = useCallback(
    async (formData: Rule) => {
      if (!policy) {
        return;
      }

      const { condition, ...rest } = {
        ...formData,
        name: formData.name?.trim() ?? '',
      };
      const newRule = condition ? { ...rest, condition } : rest;
      const updatedRules = editingRule
        ? (policy.rules ?? []).map((r) =>
            r.name === editingRule.name ? newRule : r
          )
        : [...(policy.rules ?? []), newRule];
      const patch = compare(policy, { ...policy, rules: updatedRules });

      setIsLoadingOnSave(true);
      try {
        const saved = await patchPolicy(patch, policy.id);
        setPolicy(saved);
        setIsAddingRule(false);
        setEditingRule(null);
        ruleForm.reset(INITIAL_RULE);
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.policy') })
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    },
    [policy, editingRule, t, ruleForm]
  );

  const handleDeleteRule = useCallback(
    async (ruleName: string) => {
      if (!policy) {
        return;
      }

      const updated = {
        ...policy,
        rules: (policy.rules ?? []).filter((r) => r.name !== ruleName),
      };
      const patch = compare(policy, updated);

      setIsLoadingOnSave(true);
      try {
        setPolicy(await patchPolicy(patch, policy.id));
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.rule') })
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
      }
    },
    [policy, t]
  );

  const handleRemoveRole = useCallback(
    async (roleRef: EntityReference) => {
      if (!policy) {
        return;
      }

      setIsLoadingOnSave(true);
      try {
        const role = await getRoleByName(
          roleRef.fullyQualifiedName ?? roleRef.name ?? '',
          'policies'
        );
        const updatedPolicies = (role.policies ?? []).filter(
          (p) => p.id !== policy.id
        );
        const patch = compare(role, { ...role, policies: updatedPolicies });
        // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls -- patch needs entity fetched above
        await patchRole(patch, role.id);
        setPolicy((prev) =>
          prev
            ? {
                ...prev,
                roles: (prev.roles ?? []).filter((r) => r.id !== roleRef.id),
              }
            : prev
        );
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.policy') })
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
        setSelectedEntity(undefined);
      }
    },
    [policy, t]
  );

  const handleRemoveTeam = useCallback(
    async (teamRef: EntityReference) => {
      if (!policy) {
        return;
      }

      setIsLoadingOnSave(true);
      try {
        const team = await getTeamByName(
          teamRef.fullyQualifiedName ?? teamRef.name ?? '',
          { fields: 'policies' }
        );
        const updatedPolicies = (team.policies ?? []).filter(
          (p) => p.id !== policy.id
        );
        const patch = compare(team, { ...team, policies: updatedPolicies });
        // eslint-disable-next-line openmetadata-imports/review-sequential-api-calls -- patch needs entity fetched above
        await patchTeamDetail(team.id ?? '', patch);
        setPolicy((prev) =>
          prev
            ? {
                ...prev,
                teams: (prev.teams ?? []).filter((t) => t.id !== teamRef.id),
              }
            : prev
        );
        showSuccessToast(
          t('server.entity-updated-success', { entity: t('label.policy') })
        );
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoadingOnSave(false);
        setSelectedEntity(undefined);
      }
    },
    [policy, t]
  );

  const handleEditRule = useCallback(
    (rule: Rule) => {
      setEditingRule(rule);
      ruleForm.reset(rule);
      setIsAddingRule(false);
    },
    [ruleForm]
  );

  const handleCancelRuleForm = useCallback(() => {
    setIsAddingRule(false);
    setEditingRule(null);
    ruleForm.reset(INITIAL_RULE);
  }, [ruleForm]);

  const handleStartAdd = useCallback(() => {
    setIsAddingRule(true);
    ruleForm.reset(INITIAL_RULE);
  }, [ruleForm]);

  const handleEntityRemove = useCallback(
    (item: EntityReference, kind: 'role' | 'team') => {
      setSelectedEntity(item);
      setRemoveKind(kind);
    },
    []
  );

  const { canDelete, canEditAll } = getDerivedPermissionFlags(
    policyPermission ?? DEFAULT_ENTITY_PERMISSION
  );

  return {
    canDelete,
    canEditAll,
    editingRule,
    fetchPolicy,
    handleCancelRuleForm,
    handleDeleteRule,
    handleEditRule,
    handleEntityRemove,
    handleRemoveRole,
    handleRemoveTeam,
    handleSaveRule,
    handleStartAdd,
    isAddingRule,
    isLoading,
    isLoadingOnSave,
    policy,
    removeKind,
    ruleForm,
    selectedEntity,
    setSelectedEntity,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AccessControlPolicyDetailProps {
  fqn: string;
  onNavigate: (view: AccessControlView) => void;
  onRename?: (newDisplayName: string) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput?: (titleInput: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (titleSuffix: React.ReactNode) => void;
}

const AccessControlPolicyDetail: FC<AccessControlPolicyDetailProps> = ({
  fqn,
  onNavigate,
  onRename,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const {
    canDelete,
    canEditAll,
    editingRule,
    fetchPolicy,
    handleCancelRuleForm,
    handleDeleteRule,
    handleEditRule,
    handleEntityRemove,
    handleRemoveRole,
    handleRemoveTeam,
    handleSaveRule,
    handleStartAdd,
    isAddingRule,
    isLoading,
    isLoadingOnSave,
    policy,
    removeKind,
    ruleForm,
    selectedEntity,
    setSelectedEntity,
  } = usePolicyDetail(fqn);

  const [activeTab, setActiveTab] = useState<PolicyTab>('rules');

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [isDeletePolicyOpen, setIsDeletePolicyOpen] = useState(false);
  const [isDeletingPolicy, setIsDeletingPolicy] = useState(false);

  const detailColumns = useMemo<DetailColumn[]>(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-60' },
      { id: 'description', label: t('label.description') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
    ],
    [t]
  );

  const handleSaveRename = useCallback(async () => {
    if (!policy || !renameValue.trim()) {
      return;
    }

    const updated = { ...policy, displayName: renameValue.trim() };

    setIsSavingRename(true);
    try {
      await patchPolicy(compare(policy, updated), policy.id);
      setIsRenameOpen(false);
      onRename?.(renameValue.trim());
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.policy') })
      );
      await fetchPolicy();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingRename(false);
    }
  }, [policy, renameValue, fetchPolicy, t, onRename]);

  useEffect(() => {
    if (!policy) {
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
        data-testid="rename-policy-btn"
        icon={Edit}
        isDisabled={!canEditAll}
        size="xs"
        tooltip={String(
          canEditAll ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION)
        )}
        tooltipPlacement="right"
        onPress={() => {
          setRenameValue(policy.displayName || policy.name || '');
          setIsRenameOpen(true);
        }}
      />
    );

    const deleteButtonNode: React.ReactNode = isRenameOpen ? undefined : (
      <ButtonUtility
        color="tertiary"
        data-testid="delete-policy-btn"
        icon={Delete}
        isDisabled={!canDelete}
        size="xs"
        tooltip={String(
          canDelete ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION)
        )}
        tooltipPlacement="left"
        onPress={() => setIsDeletePolicyOpen(true)}
      />
    );

    onSetHeaderTitleSuffix?.(renameButtonNode);
    onSetHeaderActions?.(deleteButtonNode);
    onSetHeaderTitleInput?.(titleInputNode);
  }, [
    policy,
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
    if (!policy || !descEditorRef.current) {
      return;
    }

    const newDescription = descEditorRef.current.getEditorContent();
    const updated = { ...policy, description: newDescription };

    setIsSavingDesc(true);
    try {
      await patchPolicy(compare(policy, updated), policy.id);
      setIsEditingDesc(false);
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.policy') })
      );
      await fetchPolicy();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDesc(false);
    }
  }, [policy, fetchPolicy, t]);

  const handleDeletePolicy = useCallback(async () => {
    if (!policy) {
      return;
    }

    setIsDeletingPolicy(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(policy),
      policy.id ?? '',
      EntityType.POLICY
    );
    setIsDeletingPolicy(false);
    setIsDeletePolicyOpen(false);

    if (isSuccess) {
      onNavigate({ type: 'policies' });
    }
  }, [policy, onNavigate]);

  const renderRulesTab = useCallback(
    () => (
      <Box direction="col" gap={3}>
        {canEditAll && !isAddingRule && !editingRule && (
          <Box direction="row" justify="end">
            <Button
              color="primary"
              data-testid="add-rule"
              size="sm"
              onPress={handleStartAdd}>
              {t('label.add-entity', { entity: t('label.rule') })}
            </Button>
          </Box>
        )}

        {(isAddingRule || editingRule) && (
          <Box
            className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
            direction="col"
            gap={4}>
            <Typography
              className="tw:text-primary"
              size="text-sm"
              weight="semibold">
              {editingRule
                ? t('label.edit-entity', { entity: t('label.rule') })
                : t('label.add-entity', { entity: t('label.rule') })}
            </Typography>
            <AccessControlRuleForm
              form={ruleForm}
              key={editingRule?.name ?? 'new-rule'}
              takenNames={(policy?.rules ?? [])
                .filter((r) => r.name !== editingRule?.name)
                .map((r) => r.name ?? '')}
            />
            <Box direction="row" gap={3} justify="end">
              <Button color="tertiary" size="sm" onPress={handleCancelRuleForm}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                isLoading={isLoadingOnSave}
                size="sm"
                onPress={() => ruleForm.handleSubmit(handleSaveRule)()}>
                {t('label.save')}
              </Button>
            </Box>
          </Box>
        )}

        {policy?.rules?.length ? (
          policy.rules.map((rule) => (
            <RuleCard
              canEditAll={canEditAll}
              isActionsDisabled={isAddingRule || !!editingRule}
              isLoadingOnSave={isLoadingOnSave}
              key={rule.name ?? ''}
              rule={rule}
              t={t}
              onDelete={handleDeleteRule}
              onEdit={handleEditRule}
            />
          ))
        ) : (
          <EmptyPlaceholder
            title={t('label.no-entity-found', {
              entity: t('label.rule-plural'),
            })}
          />
        )}
      </Box>
    ),
    [
      canEditAll,
      editingRule,
      handleCancelRuleForm,
      handleDeleteRule,
      handleEditRule,
      handleSaveRule,
      handleStartAdd,
      isAddingRule,
      isLoadingOnSave,
      policy,
      ruleForm,
      t,
    ]
  );

  const renderRolesTab = useCallback(
    () => (
      <RoleOrTeamTable
        canEditAll={Boolean(isAdminUser)}
        columns={detailColumns}
        emptyTitle={t('label.no-entity-found', {
          entity: t('label.role-plural'),
        })}
        isLoadingOnSave={isLoadingOnSave}
        items={policy?.roles ?? []}
        kind="role"
        label={t('label.role-plural')}
        t={t}
        onNavigateToDetail={(item) =>
          onNavigate({
            type: 'roles-detail',
            fqn: item.fullyQualifiedName ?? item.name ?? '',
            name: getEntityName(item),
          })
        }
        onRemove={handleEntityRemove}
      />
    ),
    [
      detailColumns,
      handleEntityRemove,
      isAdminUser,
      isLoadingOnSave,
      onNavigate,
      policy,
      t,
    ]
  );

  const renderTeamsTab = useCallback(
    () => (
      <RoleOrTeamTable
        canEditAll={Boolean(isAdminUser)}
        columns={detailColumns}
        emptyTitle={t('label.no-entity-found', {
          entity: t('label.team-plural'),
        })}
        isLoadingOnSave={isLoadingOnSave}
        items={policy?.teams ?? []}
        kind="team"
        label={t('label.team-plural')}
        t={t}
        onRemove={handleEntityRemove}
      />
    ),
    [detailColumns, handleEntityRemove, isAdminUser, isLoadingOnSave, policy, t]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!policy) {
    return null;
  }

  const policyName = getEntityName(policy);

  const tabRenderers: Record<PolicyTab, () => React.ReactNode> = {
    rules: renderRulesTab,
    roles: renderRolesTab,
    teams: renderTeamsTab,
  };

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="policy-detail-container"
      direction="col"
      gap={4}>
      <InlineDescriptionEditor
        canEdit={canEditAll}
        description={policy.description}
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
        onSelectionChange={(k) => setActiveTab(k as PolicyTab)}>
        <Tabs.List size="sm" type="underline">
          <Tabs.Item id="rules">
            {`${t('label.rule-plural')} (${policy.rules?.length ?? 0})`}
          </Tabs.Item>
          <Tabs.Item id="roles">
            {`${t('label.role-plural')} (${policy.roles?.length ?? 0})`}
          </Tabs.Item>
          <Tabs.Item id="teams">
            {`${t('label.team-plural')} (${policy.teams?.length ?? 0})`}
          </Tabs.Item>
        </Tabs.List>
      </Tabs>

      <Box
        className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:w-full"
        direction="col">
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
              parent: policyName,
            }
          )}
          open={Boolean(selectedEntity)}
          onCancel={() => setSelectedEntity(undefined)}
          onDelete={async () => {
            if (removeKind === 'role') {
              await handleRemoveRole(selectedEntity);
            } else {
              await handleRemoveTeam(selectedEntity);
            }
          }}
        />
      )}

      <DeleteModal
        entityTitle={policyName}
        isDeleting={isDeletingPolicy}
        message={t('message.permanently-delete-common-message', {
          entity: policyName.toLowerCase(),
        })}
        open={isDeletePolicyOpen}
        onCancel={() => setIsDeletePolicyOpen(false)}
        onDelete={handleDeletePolicy}
      />
    </Box>
  );
};

export default AccessControlPolicyDetail;
