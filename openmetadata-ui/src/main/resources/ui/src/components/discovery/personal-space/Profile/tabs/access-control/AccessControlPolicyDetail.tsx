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
  Table,
  Tabs,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, Delete } from '@openmetadata/ui-core-components/icons'; 
import Loader from '../../../../../common/Loader/Loader';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  Effect,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import { EntityReference } from '../../../../../../generated/entity/type';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import {
  getPolicyByName,
  patchPolicy,
} from '../../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import AccessControlRuleForm from './AccessControlRuleForm';
import type { AccessControlView } from './AccessControlPanel';

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

// ─── Cell renderers (outside component to keep complexity under threshold) ────

const renderDetailCell = (item: EntityReference, colId: DetailColumnId) => {
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

  return null;
};

// ─── Business-logic hook (outside component to keep component complexity low) ─

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

  return {
    canEditAll: policyPermission?.EditAll ?? false,
    editingRule,
    handleCancelRuleForm,
    handleDeleteRule,
    handleEditRule,
    handleSaveRule,
    handleStartAdd,
    isAddingRule,
    isLoading,
    isLoadingOnSave,
    policy,
    ruleData,
    setRuleData,
  };
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AccessControlPolicyDetailProps {
  fqn: string;
  onNavigate: (view: AccessControlView) => void;
}

const AccessControlPolicyDetail: FC<AccessControlPolicyDetailProps> = ({
  fqn,
}) => {
  const { t } = useTranslation();
  const {
    canEditAll,
    editingRule,
    handleCancelRuleForm,
    handleDeleteRule,
    handleEditRule,
    handleSaveRule,
    handleStartAdd,
    isAddingRule,
    isLoading,
    isLoadingOnSave,
    policy,
    ruleData,
    setRuleData,
  } = usePolicyDetail(fqn);

  const [activeTab, setActiveTab] = useState<PolicyTab>('rules');

  const detailColumns = useMemo(
    () => [
      { id: 'name' as DetailColumnId, label: t('label.name') },
      { id: 'description' as DetailColumnId, label: t('label.description') },
      { id: 'actions' as DetailColumnId, label: t('label.action-plural') },
    ],
    [t]
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!policy) {
    return null;
  }

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="policy-detail-container"
      direction="col">
      <Box className="tw:flex tw:flex-col tw:gap-1" direction="col">
        <Typography className="tw:text-primary" weight="medium">
          {t('label.description')}
        </Typography>
        {policy.description && (
          <Typography className="tw:text-tertiary" size="text-sm">
            {policy.description}
          </Typography>
        )}
      </Box>

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

      <Box className="tw:flex-1 tw:min-h-0 tw:overflow-auto" direction="col">
        {activeTab === 'rules' && (
          <Box direction="col" gap={3}>
            {canEditAll && !isAddingRule && !editingRule && (
              <Box direction="row" justify='end'>
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
                  setRuleData={
                    setRuleData as Dispatch<SetStateAction<Rule>>
                  }
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
                <Box
                  className="tw:border tw:border-secondary tw:rounded-xl tw:p-4 tw:flex tw:flex-col tw:gap-2"
                  data-testid={`rule-${rule.name}`}
                  direction="col"
                  key={rule.name ?? ''}>
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
                        title={String(
                          canEditAll ? t('label.edit') : t(NO_PERMISSION_FOR_ACTION)
                        )}>
                        <Button
                          color="tertiary"
                          data-testid={`edit-rule-${rule.name}`}
                          isDisabled={!canEditAll || isLoadingOnSave}
                          size="xs"
                          onPress={() => handleEditRule(rule)}>
                          <Edit name={String(t('label.edit'))} width="14px" />
                        </Button>
                      </Tooltip>
                      <Tooltip
                        placement="left"
                        title={String(
                          canEditAll ? t('label.delete') : t(NO_PERMISSION_FOR_ACTION)
                        )}>
                        <Button
                          color="tertiary"
                          data-testid={`delete-rule-${rule.name}`}
                          isDisabled={!canEditAll || isLoadingOnSave}
                          size="xs"
                          onPress={() => handleDeleteRule(rule.name ?? '')}>
                          <Delete
                            name={String(t('label.delete'))}
                            width="14px"
                          />
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
                        className={`tw:text-sm tw:font-medium ${
                          rule.effect === Effect.Allow
                            ? 'tw:text-green-600'
                            : 'tw:text-red-600'
                        }`}
                        size="text-sm"
                        weight="medium">
                        {rule.effect}
                      </Typography>
                    </Box>
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
          <Box className="tw:rounded-xl tw:overflow-hidden tw:border tw:border-secondary">
            <Table aria-label={t('label.role-plural')} size="compact">
              <Table.Header columns={detailColumns}>
                {(col) => (
                  <Table.Head id={col.id} key={col.id} label={col.label} />
                )}
              </Table.Header>
              <Table.Body
                items={policy.roles ?? []}
                renderEmptyState={() => (
                  <EmptyPlaceholder
                    title={t('label.no-entity-found', {
                      entity: t('label.role-plural'),
                    })}
                  />
                )}>
                {(item) => (
                  <Table.Row
                    columns={detailColumns}
                    data-testid={getEntityName(item)}
                    id={item.fullyQualifiedName ?? item.name ?? item.id}
                    key={item.fullyQualifiedName ?? item.name ?? item.id}>
                    {(col) => (
                      <Table.Cell key={col.id}>
                        {renderDetailCell(item, col.id as DetailColumnId)}
                      </Table.Cell>
                    )}
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Box>
        )}

        {activeTab === 'teams' && (
          <Box className="tw:rounded-xl tw:overflow-hidden tw:border tw:border-secondary">
            <Table aria-label={t('label.team-plural')} size="compact">
              <Table.Header columns={detailColumns}>
                {(col) => (
                  <Table.Head id={col.id} key={col.id} label={col.label} />
                )}
              </Table.Header>
              <Table.Body
                items={policy.teams ?? []}
                renderEmptyState={() => (
                  <EmptyPlaceholder
                    title={t('label.no-entity-found', {
                      entity: t('label.team-plural'),
                    })}
                  />
                )}>
                {(item) => (
                  <Table.Row
                    columns={detailColumns}
                    data-testid={getEntityName(item)}
                    id={item.fullyQualifiedName ?? item.name ?? item.id}
                    key={item.fullyQualifiedName ?? item.name ?? item.id}>
                    {(col) => (
                      <Table.Cell key={col.id}>
                        {renderDetailCell(item, col.id as DetailColumnId)}
                      </Table.Cell>
                    )}
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AccessControlPolicyDetail;
