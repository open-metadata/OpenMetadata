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
    Input,
    Table,
    TableCard,
    Tabs,
    Tooltip,
    Typography
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, {
    Dispatch,
    FC,
    SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { OperationPermission, ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
    Effect,
    Rule
} from '../../../../../../generated/api/policies/createPolicy';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { EntityReference } from '../../../../../../generated/entity/type';
import {
    getPolicyByName,
    patchPolicy
} from '../../../../../../rest/rolesAPIV1';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
    showErrorToast,
    showSuccessToast
} from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import Loader from '../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { AccessControlView } from './AccessControlPanel';
import AccessControlRuleForm from './AccessControlRuleForm';

type PolicyTab = 'rules' | 'roles' | 'teams';
type DetailColumnId = 'name' | 'description' | 'actions';

const INITIAL_RULE: Rule = {
  name: '',
  description: '',
  resources: [],
  operations: [],
  condition: '',
  effect: Effect.Allow,
};

// ─── Description cell ─────────────────────────────────────────────────────────

const DescriptionCell: FC<{ value: string | undefined }> = ({ value }) => {
  if (value) {
    return <RichTextEditorPreviewerV1 markdown={value} />;
  }

  return <Typography className="tw:text-sm tw:text-tertiary">--</Typography>;
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
        <Tooltip
          placement="right"
          title={t('label.edit-entity', { entity: t('label.description') })}>
          <Button
            color="tertiary"
            data-testid="edit-description-btn"
            size="xs"
            onPress={onStartEdit}>
            <Edit name={t('label.edit')} width="14px" />
          </Button>
        </Tooltip>
      )}
    </Box>
    {isEditing ? (
      <Box className="tw:flex tw:flex-col tw:gap-2" direction="col">
        <RichTextEditor
          className="new-form-style"
          initialValue={description ?? ''}
          ref={editorRef}
        />
        <Box className="tw:flex tw:gap-2 tw:justify-end" direction="row">
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
    <Box className="tw:flex tw:items-center tw:gap-2" direction="row">
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

// ─── Header actions ───────────────────────────────────────────────────────────

interface PolicyHeaderActionsProps {
  canDelete: boolean;
  canEditAll: boolean;
  displayName: string;
  name: string;
  onDelete: () => void;
  onRename: (initial: string) => void;
  t: ReturnType<typeof useTranslation>['t'];
}

const PolicyHeaderActions: FC<PolicyHeaderActionsProps> = ({
  canDelete,
  canEditAll,
  displayName,
  name,
  onDelete,
  onRename,
  t,
}) => (
  <Box className="tw:flex tw:items-center tw:gap-1" direction="row">
    <Tooltip
      placement="left"
      title={String(canEditAll ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION))}>
      <Button
        color="tertiary"
        data-testid="rename-policy-btn"
        isDisabled={!canEditAll}
        size="sm"
        onPress={() => onRename(displayName || name)}>
        <Edit name={t('label.rename')} width="16px" />
      </Button>
    </Tooltip>
    <Tooltip
      placement="left"
      title={String(canDelete ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION))}>
      <Button
        color="tertiary"
        data-testid="delete-policy-btn"
        isDisabled={!canDelete}
        size="sm"
        onPress={onDelete}>
        <Delete name={t('label.delete')} width="16px" />
      </Button>
    </Tooltip>
  </Box>
);

// ─── Rule card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  canEditAll: boolean;
  isLoadingOnSave: boolean;
  rule: Rule;
  t: ReturnType<typeof useTranslation>['t'];
  onDelete: (name: string) => void;
  onEdit: (rule: Rule) => void;
}

const RuleCard: FC<RuleCardProps> = ({
  canEditAll,
  isLoadingOnSave,
  rule,
  t,
  onDelete,
  onEdit,
}) => {
  const effectClass =
    rule.effect === Effect.Allow ? 'tw:text-green-600' : 'tw:text-red-600';

  return (
    <Box
      className="tw:border tw:border-secondary tw:rounded-xl tw:p-4 tw:flex tw:flex-col tw:gap-2"
      data-testid={`rule-${rule.name}`}
      direction="col">
      <Box
        className="tw:flex tw:items-center tw:justify-between"
        direction="row">
        <Typography
          className="tw:text-sm tw:font-semibold tw:text-primary"
          size="text-sm"
          weight="semibold">
          {rule.name}
        </Typography>
        <Box className="tw:flex tw:gap-1" direction="row">
          <Tooltip
            placement="left"
            title={String(canEditAll ? t('label.edit') : t(NO_PERMISSION_FOR_ACTION))}>
            <Button
              color="tertiary"
              data-testid={`edit-rule-${rule.name}`}
              isDisabled={!canEditAll || isLoadingOnSave}
              size="xs"
              onPress={() => onEdit(rule)}>
              <Edit name={String(t('label.edit'))} width="14px" />
            </Button>
          </Tooltip>
          <Tooltip
            placement="left"
            title={String(canEditAll ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION))}>
            <Button
              color="tertiary"
              data-testid={`delete-rule-${rule.name}`}
              isDisabled={!canEditAll || isLoadingOnSave}
              size="xs"
              onPress={() => onDelete(rule.name ?? '')}>
              <Delete name={String(t('label.delete'))} width="14px" />
            </Button>
          </Tooltip>
        </Box>
      </Box>
      <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
        <Box className="tw:flex tw:gap-2" direction="row">
          <Typography className="tw:text-sm tw:text-secondary tw:shrink-0">
            {`${t('label.resource-plural')}:`}
          </Typography>
          <Typography className="tw:text-sm tw:text-primary">
            {(rule.resources ?? []).join(', ') || '--'}
          </Typography>
        </Box>
        <Box className="tw:flex tw:gap-2" direction="row">
          <Typography className="tw:text-sm tw:text-secondary tw:shrink-0">
            {`${t('label.operation-plural')}:`}
          </Typography>
          <Typography className="tw:text-sm tw:text-primary">
            {(rule.operations ?? []).join(', ') || '--'}
          </Typography>
        </Box>
        <Box className="tw:flex tw:gap-2" direction="row">
          <Typography className="tw:text-sm tw:text-secondary tw:shrink-0">
            {`${t('label.effect')}:`}
          </Typography>
          <Typography
            className={`tw:text-sm tw:font-medium ${effectClass}`}
            size="text-sm"
            weight="medium">
            {rule.effect}
          </Typography>
        </Box>
        {rule.description && (
          <Box className="tw:flex tw:gap-2" direction="row">
            <Typography className="tw:text-sm tw:text-secondary tw:shrink-0">
              {`${t('label.description')}:`}
            </Typography>
            <RichTextEditorPreviewerV1 markdown={rule.description} />
          </Box>
        )}
        {rule.condition && (
          <Box className="tw:flex tw:gap-2" direction="row">
            <Typography className="tw:text-sm tw:text-secondary tw:shrink-0">
              {`${t('label.condition')}:`}
            </Typography>
            <code className="tw:font-mono tw:text-xs tw:bg-secondary tw:px-1 tw:rounded">
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
  t: ReturnType<typeof useTranslation>['t']
) => {
  if (colId === 'name') {
    return (
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {getEntityName(item)}
      </Typography>
    );
  }

  if (colId === 'description') {
    return <DescriptionCell value={item.description} />;
  }

  if (colId === 'actions' && canEditAll) {
    return (
      <Tooltip
        placement="left"
        title={String(canEditAll ? t('label.remove') : t(NO_PERMISSION_FOR_ACTION))}>
        <Button
          color="tertiary"
          data-testid={`remove-${getEntityName(item)}`}
          isDisabled={!canEditAll || isLoadingOnSave}
          size="xs"
          onPress={() => onRemove(item, kind)}>
          <Delete name={String(t('label.remove'))} width="16px" />
        </Button>
      </Tooltip>
    );
  }

  return null;
};

// ─── Role/team table ──────────────────────────────────────────────────────────

interface RoleOrTeamTableProps {
  canEditAll: boolean;
  columns: { id: DetailColumnId; label: string }[];
  emptyTitle: string;
  isLoadingOnSave: boolean;
  items: EntityReference[];
  kind: 'role' | 'team';
  label: string;
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
  t,
  onRemove,
}) => (
  <Box className="tw:w-full tw:overflow-x-auto tw:p-1" direction="col">
    <TableCard.Root className="tw:w-full" size="compact">
      <Table aria-label={label} size="compact">
        <Table.Header columns={columns}>
          {(col) => (
            <Table.Head id={col.id} key={col.id} label={col.label} />
          )}
        </Table.Header>
        <Table.Body
          items={items}
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
                  {renderRoleOrTeamCell(
                    item,
                    col.id as DetailColumnId,
                    kind,
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
  const [ruleData, setRuleData] = useState<Rule>(INITIAL_RULE);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>();
  const [removeKind, setRemoveKind] = useState<'role' | 'team'>('role');

  useEffect(() => {
    setIsLoading(true);
    getPolicyByName(fqn, 'owners,location,teams,roles')
      .then(setPolicy)
      .catch((err: AxiosError) => showErrorToast(err))
      .finally(() => setIsLoading(false));
  }, [fqn]);

  useEffect(() => {
    getEntityPermissionByFqn(ResourceEntity.POLICY, fqn).then(
      setPolicyPermission
    );
  }, [fqn, getEntityPermissionByFqn]);

  const handleSaveRule = useCallback(async () => {
    if (!policy) {
      return;
    }

    const { condition, ...rest } = {
      ...ruleData,
      name: ruleData.name?.trim() ?? '',
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
      setRuleData(INITIAL_RULE);
      showSuccessToast(
        t('server.entity-updated-successfully', { entity: t('label.policy') })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoadingOnSave(false);
    }
  }, [policy, ruleData, editingRule, t]);

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
          t('server.entity-updated-successfully', { entity: t('label.rule') })
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

      const updated = {
        ...policy,
        roles: (policy.roles ?? []).filter(
          (r) => r.fullyQualifiedName !== roleRef.fullyQualifiedName
        ),
      };
      const patch = compare(policy, updated);

      setIsLoadingOnSave(true);
      try {
        setPolicy(await patchPolicy(patch, policy.id));
        showSuccessToast(
          t('server.entity-updated-successfully', { entity: t('label.policy') })
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

      const updated = {
        ...policy,
        teams: (policy.teams ?? []).filter(
          (r) => r.fullyQualifiedName !== teamRef.fullyQualifiedName
        ),
      };
      const patch = compare(policy, updated);

      setIsLoadingOnSave(true);
      try {
        setPolicy(await patchPolicy(patch, policy.id));
        showSuccessToast(
          t('server.entity-updated-successfully', { entity: t('label.policy') })
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

  const handleEditRule = useCallback((rule: Rule) => {
    setEditingRule(rule);
    setRuleData(rule);
    setIsAddingRule(false);
  }, []);

  const handleCancelRuleForm = useCallback(() => {
    setIsAddingRule(false);
    setEditingRule(null);
    setRuleData(INITIAL_RULE);
  }, []);

  const handleStartAdd = useCallback(() => {
    setIsAddingRule(true);
    setRuleData(INITIAL_RULE);
  }, []);

  const handleEntityRemove = useCallback(
    (item: EntityReference, kind: 'role' | 'team') => {
      setSelectedEntity(item);
      setRemoveKind(kind);
    },
    []
  );

  return {
    canDelete: policyPermission?.Delete ?? false,
    canEditAll: policyPermission?.EditAll ?? false,
    editingRule,
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
    ruleData,
    selectedEntity,
    setPolicy,
    setRuleData,
    setSelectedEntity,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AccessControlPolicyDetailProps {
  fqn: string;
  onNavigate: (view: AccessControlView) => void;
  onSetHeaderActions?: (actions: React.ReactNode) => void;
  onSetHeaderTitleInput?: (titleInput: React.ReactNode) => void;
  onSetHeaderTitleSuffix?: (titleSuffix: React.ReactNode) => void;
}

 
const AccessControlPolicyDetail: FC<AccessControlPolicyDetailProps> = ({
  fqn,
  onNavigate,
  onSetHeaderActions,
  onSetHeaderTitleInput,
  onSetHeaderTitleSuffix,
}) => {
  const { t } = useTranslation();
  const {
    canDelete,
    canEditAll,
    editingRule,
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
    ruleData,
    selectedEntity,
    setPolicy,
    setRuleData,
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

  const detailColumns = useMemo(
    () => [
      { id: 'name' as DetailColumnId, label: t('label.name') },
      { id: 'description' as DetailColumnId, label: t('label.description') },
      { id: 'actions' as DetailColumnId, label: t('label.action-plural') },
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
      const saved = await patchPolicy(compare(policy, updated), policy.id);
      setPolicy(saved);
      setIsRenameOpen(false);
      showSuccessToast(
        t('server.entity-updated-successfully', { entity: t('label.policy') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingRename(false);
    }
  }, [policy, renameValue, setPolicy, t]);

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
      <Tooltip
        placement="right"
        title={String(canEditAll ? t('label.rename') : t(NO_PERMISSION_FOR_ACTION))}>
        <Button
          color="tertiary"
          data-testid="rename-policy-btn"
          isDisabled={!canEditAll}
          size="sm"
          onPress={() => {
            setRenameValue(policy.displayName || policy.name || '');
            setIsRenameOpen(true);
          }}>
          <Edit name={t('label.rename')} width="16px" />
        </Button>
      </Tooltip>
    );

    const deleteButtonNode: React.ReactNode = isRenameOpen ? undefined : (
      <Tooltip
        placement="left"
        title={String(canDelete ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION))}>
        <Button
          color="tertiary"
          data-testid="delete-policy-btn"
          isDisabled={!canDelete}
          size="sm"
          onPress={() => setIsDeletePolicyOpen(true)}>
          <Delete name={t('label.delete')} width="16px" />
        </Button>
      </Tooltip>
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
      const saved = await patchPolicy(compare(policy, updated), policy.id);
      setPolicy(saved);
      setIsEditingDesc(false);
      showSuccessToast(
        t('server.entity-updated-successfully', { entity: t('label.policy') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDesc(false);
    }
  }, [policy, setPolicy, t]);

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

  if (isLoading) {
    return <Loader />;
  }

  if (!policy) {
    return null;
  }

  const policyName = getEntityName(policy);

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="policy-detail-container"
      direction="col">

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

      <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto tw:w-full" direction="col">
        {activeTab === 'rules' && (
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
                className="tw:border tw:border-secondary tw:rounded-xl tw:p-4 tw:flex tw:flex-col tw:gap-4"
                direction="col">
                <Typography
                  className="tw:text-sm tw:font-semibold tw:text-primary"
                  size="text-sm"
                  weight="semibold">
                  {editingRule
                    ? t('label.edit-entity', { entity: t('label.rule') })
                    : t('label.add-entity', { entity: t('label.rule') })}
                </Typography>
                <AccessControlRuleForm
                  ruleData={ruleData}
                  setRuleData={setRuleData as Dispatch<SetStateAction<Rule>>}
                />
                <Box
                  className="tw:flex tw:gap-3 tw:justify-end"
                  direction="row">
                  <Button
                    color="tertiary"
                    size="sm"
                    onPress={handleCancelRuleForm}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    isLoading={isLoadingOnSave}
                    size="sm"
                    onPress={handleSaveRule}>
                    {t('label.save')}
                  </Button>
                </Box>
              </Box>
            )}

            {policy.rules?.length ? (
              policy.rules.map((rule) => (
                <RuleCard
                  canEditAll={canEditAll}
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
        )}

        {activeTab === 'roles' && (
          <RoleOrTeamTable
            canEditAll={canEditAll}
            columns={detailColumns}
            emptyTitle={t('label.no-entity-found', {
              entity: t('label.role-plural'),
            })}
            isLoadingOnSave={isLoadingOnSave}
            items={policy.roles ?? []}
            kind="role"
            label={t('label.role-plural')}
            t={t}
            onRemove={handleEntityRemove}
          />
        )}

        {activeTab === 'teams' && (
          <RoleOrTeamTable
            canEditAll={canEditAll}
            columns={detailColumns}
            emptyTitle={t('label.no-entity-found', {
              entity: t('label.team-plural'),
            })}
            isLoadingOnSave={isLoadingOnSave}
            items={policy.teams ?? []}
            kind="team"
            label={t('label.team-plural')}
            t={t}
            onRemove={handleEntityRemove}
          />
        )}
      </Box>

      {selectedEntity && (
        <DeleteModal
          entityTitle={t('label.remove-entity', {
            entity: getEntityName(selectedEntity),
          })}
          isDeleting={isLoadingOnSave}
          message={t('message.are-you-sure-you-want-to-remove-child-from-parent', {
            child: getEntityName(selectedEntity),
            parent: policyName,
          })}
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
