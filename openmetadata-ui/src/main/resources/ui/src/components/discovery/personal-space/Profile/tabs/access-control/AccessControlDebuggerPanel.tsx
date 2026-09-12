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
    Box, Button, Card, Input,
    Select,
    SelectItemType,
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/resourcePermission';
import {
    evaluatePermission,
    getPermissionDebugInfo,
    PermissionDebugInfo,
    PermissionEvaluationDebugInfo
} from '../../../../../../rest/permissionAPI';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';
import {
    PERMISSION_OPERATIONS,
    PERMISSION_RESOURCES
} from '../../../../../Settings/Users/AdminPermissionDebugger/AdminPermissionDebugger.constants';
import AccessControlUserPermissions from './AccessControlUserPermissions';

const RESOURCE_ITEMS: SelectItemType[] = PERMISSION_RESOURCES.map((r) => ({
  id: r,
  label: r,
}));

const OPERATION_ITEMS: SelectItemType[] = PERMISSION_OPERATIONS.map((op) => ({
  id: op,
  label: op,
}));

const AccessControlDebuggerPanel: React.FC = () => {
  const { t } = useTranslation();
  const [selectedUsername, setSelectedUsername] = useState('');
  const [permissionInfo, setPermissionInfo] = useState<PermissionDebugInfo>();
  const [evaluationInfo, setEvaluationInfo] =
    useState<PermissionEvaluationDebugInfo>();
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [userOptions, setUserOptions] = useState<SelectItemType[]>([]);

  // Evaluation form state
  const [formResource, setFormResource] = useState<string | null>(null);
  const [formOperation, setFormOperation] = useState<string | null>(null);
  const [formResourceId, setFormResourceId] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const searchUsers = useCallback(
    debounce(async (searchText: string) => {
      if (!searchText) {
        setUserOptions([]);

        return;
      }

      try {
        const response = await searchQuery({
          query: searchText,
          pageNumber: 1,
          pageSize: 10,
          filters: '',
          sortField: '',
          sortOrder: '',
          searchIndex: SearchIndex.USER,
          includeDeleted: false,
          trackTotalHits: false,
          fetchSource: true,
          includeFields: ['name', 'displayName'],
        });

        const options = response.hits.hits.map(
          (hit: { _source: { name: string; displayName?: string } }) => ({
            id: hit._source.name,
            label: `${hit._source.displayName || hit._source.name} (${hit._source.name})`,
          })
        );

        setUserOptions(options);
      } catch {
        setUserOptions([]);
      }
    }, 300),
    []
  );

  const handleUserSelect = async (username: string) => {
    setSelectedUsername(username);
    setLoadingPermissions(true);
    try {
      const response = await getPermissionDebugInfo(username);
      setPermissionInfo(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formResource) {
      errors.resource = t('label.field-required', {
        field: t('label.resource'),
      });
    }

    if (!formOperation) {
      errors.operation = t('label.field-required', {
        field: t('label.operation'),
      });
    }

    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleEvaluate = async () => {
    if (!selectedUsername) {
      showErrorToast(t('message.select-user-first'));

      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoadingEvaluation(true);
    try {
      const response = await evaluatePermission(
        selectedUsername,
        formResource ?? '',
        formOperation as Operation,
        formResourceId || undefined
      );
      setEvaluationInfo(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingEvaluation(false);
    }
  };

  const renderEvaluationResult = () => {
    if (!evaluationInfo) {
      return null;
    }

    const allowedColor = evaluationInfo.allowed
      ? 'tw:text-green-600'
      : 'tw:text-red-600';

    return (
      <>
      <Card
        className="tw:mt-4 tw:overflow-hidden"
        data-testid="evaluation-result">
        <Box
          className={`tw:px-6 tw:py-4 tw:border-b-2 ${
            evaluationInfo.allowed
              ? 'tw:bg-green-50 tw:border-green-500'
              : 'tw:bg-red-50 tw:border-red-500'
          }`}>
          <Typography className="tw:text-md tw:font-semibold tw:text-primary">
            {t('label.permission-evaluation-result')}
          </Typography>
        </Box>
        <Box className="tw:p-6" direction="col" gap={4}>
          <Box className="tw:bg-tertiary tw:p-4 tw:rounded-lg" direction="col" gap={2}>
            <Typography className="tw:text-lg tw:font-semibold tw:text-primary">
              {`${t('label.decision')}: ${evaluationInfo.finalDecision}`}
            </Typography>
            <Typography className="tw:text-sm tw:text-tertiary">
              {`${t('label.user')} `}
              <strong>{evaluationInfo.user.name}</strong>
              {` ${t('label.is')} `}
              <strong className={allowedColor}>
                {evaluationInfo.allowed
                  ? t('label.allowed')
                  : t('label.denied')}
              </strong>
              {` ${t('label.to-perform')} `}
              <strong>{evaluationInfo.operation}</strong>
              {` ${t('label.on')} `}
              <strong>{evaluationInfo.resource}</strong>
              {evaluationInfo.resourceId &&
                ` (${evaluationInfo.resourceId})`}
            </Typography>
          </Box>

          {evaluationInfo.summary && (
            <Box className="tw:bg-tertiary tw:p-4 tw:rounded-lg" direction="row" gap={4} wrap='wrap'>
              <Typography className="tw:text-sm tw:text-secondary">
                {`${t('label.policies-evaluated')}: ${evaluationInfo.summary.totalPoliciesEvaluated}`}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {`${t('label.rules-evaluated')}: ${evaluationInfo.summary.totalRulesEvaluated}`}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {`${t('label.matching-rule-plural')}: ${evaluationInfo.summary.matchingRules}`}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {`${t('label.allow-rule-plural')}: ${evaluationInfo.summary.allowRules}`}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {`${t('label.deny-rule-plural')}: ${evaluationInfo.summary.denyRules}`}
              </Typography>
              <Typography className="tw:text-sm tw:text-secondary">
                {t('label.time-ms', {
                  milliseconds: evaluationInfo.summary.evaluationTimeMs,
                })}
              </Typography>
            </Box>
          )}

          <Box direction="col" gap={2}>
            <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
              {`${t('label.evaluation-step-plural')}:`}
            </Typography>
            {evaluationInfo.evaluationSteps.map((step) => {
              const stepEffectColor =
                step.effect.toUpperCase() === 'ALLOW'
                  ? 'tw:text-green-600'
                  : 'tw:text-red-600';

              return (
                <Card
                  className="tw:p-4 tw:bg-tertiary tw:border-l-4 tw:border-l-utility-gray-500" direction="col" gap={2}
                  key={step.stepNumber}>
                  <Box className="tw:flex-wrap" align="center" direction="row" gap={2}>
                    <Typography className="tw:text-sm tw:text-secondary">
                      {`${t('label.step')} ${step.stepNumber}: `}
                    </Typography>
                    <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
                      {step.policy.name}
                    </Typography>
                    <Typography className="tw:text-sm tw:text-secondary">
                      {`- ${t('label.rule')}: ${step.rule}`}
                    </Typography>
                  </Box>
                  <Typography className="tw:text-sm tw:text-secondary">
                    {`${t('label.source')}: ${step.source} (${step.sourceEntity.name})`}
                  </Typography>
                  <Typography className="tw:text-sm tw:text-secondary">
                    {`${t('label.effect')}: `}
                    <strong className={stepEffectColor}>{step.effect}</strong>
                  </Typography>
                  <Typography className="tw:text-sm tw:text-secondary">
                    {`${t('label.matched')}: `}
                    <strong>
                      {step.matched ? t('label.yes') : t('label.no')}
                    </strong>
                  </Typography>
                  <Typography className="tw:text-xs tw:text-tertiary">
                    {step.matchReason}
                  </Typography>
                  {step.conditionEvaluations.length > 0 && (
                    <Box direction="col" gap={1}>
                      <Typography className="tw:text-sm tw:text-secondary">
                        {`${t('label.condition-plural')}:`}
                      </Typography>
                      {step.conditionEvaluations.map((cond) => (
                        <Box
                          align="center" direction="row" gap={2}
                          direction="row"
                          key={cond.condition}>
                          <Typography className="tw:text-xs tw:font-mono tw:bg-secondary tw:px-1 tw:rounded">
                            {cond.condition}
                          </Typography>
                          <Typography className="tw:text-xs tw:text-secondary">
                            {` → ${cond.result ? t('label.true') : t('label.false')}`}
                          </Typography>
                          <Typography className="tw:text-xs tw:text-tertiary">
                            {`(${cond.evaluationDetails})`}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>

          {evaluationInfo.summary?.reasonsForDecision && (
            <Box className="tw:bg-tertiary tw:p-4 tw:rounded-lg" direction="col" gap={2}>
              <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
                {`${t('label.reasons-for-decision')}:`}
              </Typography>
              {evaluationInfo.summary.reasonsForDecision.map((reason) => (
                <Typography
                  className="tw:text-sm tw:text-secondary"
                  key={reason}>
                  {`• ${reason}`}
                </Typography>
              ))}
            </Box>
          )}
        </Box>
      </Card>
      </>
    );
  };

  return (
    <Box
      className="tw:pt-0" direction="col" gap={4}
      data-testid="admin-permission-debugger"
      direction="col"
      gap={4}>

      {/* Card 1: Select a user */}
      <Card className="tw:p-6" direction="col" gap={4}>
        <Typography weight='semibold'>
          {t('label.select-user-to-debug-permissions')}
        </Typography>

        <Box className="tw:max-w-100 tw:min-w-64 tw:mt-2">
          <Select.ComboBox
            allowsEmptyCollection
            showSearchIcon
            className="tw:min-w-80"
            items={userOptions}
            placeholder={t('label.search-entity', {
              entity: t('label.user'),
            })}
            onInputChange={(v) => searchUsers(v)}
            onSelectionChange={(key) =>
              key && handleUserSelect(String(key))
            }>
            {(item) => (
              <Select.Item id={item.id} key={item.id}>
                {item.label}
              </Select.Item>
            )}
          </Select.ComboBox>
        </Box>

        {selectedUsername && (
          <Typography className="tw:text-sm tw:text-secondary">
            {`${t('label.selected-entity', { entity: t('label.user-lowercase') })}: `}
            <strong>{selectedUsername}</strong>
          </Typography>
        )}
      </Card>

      {/* Card 2: Evaluate Permission */}
      <Card className="tw:overflow-hidden">
        <Box className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary">
          <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
            {t('label.evaluate-permission')}
          </Typography>
        </Box>
        <Box className="tw:p-6">
          {!selectedUsername ? (
            <Typography className="tw:text-sm tw:text-tertiary">
              {t('message.select-user-first')}
            </Typography>
          ) : (
            <Box direction="col" gap={4}>
              <Box
                className="tw:flex-wrap" align="start" direction="row" gap={4}
                direction="row">
                <Box className="tw:min-w-48" direction="col" gap={1}>
                  <Typography className="tw:text-sm tw:font-medium tw:text-secondary">
                    {`${t('label.resource')} *`}
                  </Typography>
                  <Select
                    items={RESOURCE_ITEMS}
                    placeholder={t('label.select-entity', {
                      entity: t('label.resource'),
                    })}
                    selectedKey={formResource}
                    onSelectionChange={(key) => {
                      setFormResource(key ? String(key) : null);
                      setFormErrors((prev) => ({ ...prev, resource: '' }));
                    }}>
                    {(item) => (
                      <Select.Item id={item.id} key={item.id}>
                        {item.label}
                      </Select.Item>
                    )}
                  </Select>
                  {formErrors.resource && (
                    <Typography className="tw:text-xs tw:text-red-500">
                      {formErrors.resource}
                    </Typography>
                  )}
                </Box>

                <Box className="tw:min-w-48" direction="col" gap={1}>
                  <Typography className="tw:text-sm tw:font-medium tw:text-secondary">
                    {`${t('label.operation')} *`}
                  </Typography>
                  <Select
                    items={OPERATION_ITEMS}
                    placeholder={t('label.select-entity', {
                      entity: t('label.operation'),
                    })}
                    selectedKey={formOperation}
                    onSelectionChange={(key) => {
                      setFormOperation(key ? String(key) : null);
                      setFormErrors((prev) => ({ ...prev, operation: '' }));
                    }}>
                    {(item) => (
                      <Select.Item id={item.id} key={item.id}>
                        {item.label}
                      </Select.Item>
                    )}
                  </Select>
                  {formErrors.operation && (
                    <Typography className="tw:text-xs tw:text-red-500">
                      {formErrors.operation}
                    </Typography>
                  )}
                </Box>

                <Box className="tw:min-w-64" direction="col" gap={1}>
                  <Typography className="tw:text-sm tw:font-medium tw:text-secondary">
                    {`${t('label.resource-fqn-or-id')} (${t('label.optional')})`}
                  </Typography>
                  <Input
                    placeholder={t('label.enter-resource-fqn-or-id')}
                    value={formResourceId}
                    onChange={(value) => setFormResourceId(value)}
                  />
                </Box>
              </Box>

              <Box>
                <Button
                  color="primary"
                  data-testid="evaluate-permission-button"
                  isLoading={loadingEvaluation}
                  onPress={handleEvaluate}>
                  {t('label.evaluate')}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Card>

      {/* Card 3: Permission Evaluation Result (only after evaluating) */}
      {renderEvaluationResult()}

      {/* Card 4: Permissions for {username} (only after user is selected) */}
      {selectedUsername && (
        <Card className="tw:overflow-hidden tw:w-full">
          <Box className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary">
            <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
              {`${t('label.permissions-for')} ${selectedUsername}`}
            </Typography>
          </Box>
          <Box className="tw:p-6">
            {loadingPermissions ? (
              <Box className="tw:py-8" justify="center">
                <Loader />
              </Box>
            ) : permissionInfo ? (
              <AccessControlUserPermissions
                isLoggedInUser={false}
                username={selectedUsername}
              />
            ) : (
              <Typography className="tw:text-sm tw:text-tertiary">
                {t('message.select-user-first')}
              </Typography>
            )}
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default AccessControlDebuggerPanel;
