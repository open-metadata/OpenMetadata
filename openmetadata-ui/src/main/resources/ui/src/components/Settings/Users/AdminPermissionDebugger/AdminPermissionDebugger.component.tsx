/*
 *  Copyright 2025 Collate.
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
  Card,
  ComboBox,
  Grid,
  Select as CoreSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { Form, Input, Select, Spin } from 'antd';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import {
  evaluatePermission,
  getPermissionDebugInfo,
  PermissionDebugInfo,
  PermissionEvaluationDebugInfo,
} from '../../../../rest/permissionAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { getSettingPageEntityBreadCrumb } from '../../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Loader from '../../../common/Loader/Loader';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import UserPermissions from '../UsersProfile/UserPermissions/UserPermissions.component';
import {
  PERMISSION_OPERATIONS,
  PERMISSION_RESOURCES,
} from './AdminPermissionDebugger.constants';
import './AdminPermissionDebugger.style.less';

const { Option } = Select;

interface EvaluationFormValues {
  resource: string;
  operation: Operation;
  resourceId?: string;
}

const AdminPermissionDebugger: React.FC = () => {
  const { t } = useTranslation();
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [permissionInfo, setPermissionInfo] = useState<PermissionDebugInfo>();
  const [evaluationInfo, setEvaluationInfo] =
    useState<PermissionEvaluationDebugInfo>();
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [form] = Form.useForm();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.ACCESS,
        t('label.permission-debugger')
      ),
    []
  );

  const searchUsers = useCallback(
    debounce(async (searchText: string) => {
      if (!searchText) {
        setUserOptions([]);

        return;
      }

      setSearchingUsers(true);
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
          (hit: {
            _source: {
              name: string;
              displayName?: string;
            };
          }) => ({
            value: hit._source.name,
            label: `${hit._source.displayName || hit._source.name} (${
              hit._source.name
            })`,
          })
        );

        setUserOptions(options);
      } catch (error) {
        // Reset user options on error - this allows the user to try again
        setUserOptions([]);
      } finally {
        setSearchingUsers(false);
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

  const handleEvaluate = async (values: EvaluationFormValues) => {
    if (!selectedUsername) {
      showErrorToast(t('message.select-user-first'));

      return;
    }
    setLoadingEvaluation(true);
    try {
      const response = await evaluatePermission(
        selectedUsername,
        values.resource,
        values.operation,
        values.resourceId
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

    return (
      <Card
        className="m-t-md"
        color={evaluationInfo.allowed ? 'success' : 'error'}>
        <Card.Header title={t('label.permission-evaluation-result')} />
        <Card.Content>
          <Box
            inline
            align="stretch"
            className="layout-space w-full"
            direction="col"
            gap={2}
            itemClassName="layout-space-item">
            <div className="evaluation-summary">
              <Typography as="h4">
                {t('label.decision') + ': '}{' '}
                <Typography>{evaluationInfo.finalDecision}</Typography>
              </Typography>
              <Typography>
                {t('label.user')} <strong>{evaluationInfo.user.name}</strong>{' '}
                {t('label.is')}{' '}
                <strong
                  style={{
                    color: evaluationInfo.allowed ? '#52c41a' : '#f5222d',
                  }}>
                  {evaluationInfo.allowed
                    ? t('label.allowed')
                    : t('label.denied')}
                </strong>{' '}
                {t('label.to-perform')}{' '}
                <strong>{evaluationInfo.operation}</strong> {t('label.on')}{' '}
                <strong>{evaluationInfo.resource}</strong>
                {evaluationInfo.resourceId && (
                  <Typography>{` (${evaluationInfo.resourceId})`}</Typography>
                )}
              </Typography>
            </div>

            {evaluationInfo.summary && (
              <div className="evaluation-stats">
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal"
                  gap={2}
                  itemClassName="layout-space-item"
                  wrap="wrap">
                  <Typography>
                    {t('label.policies-evaluated')}:{' '}
                    {evaluationInfo.summary.totalPoliciesEvaluated}
                  </Typography>
                  <Typography>
                    {t('label.rules-evaluated')}:{' '}
                    {evaluationInfo.summary.totalRulesEvaluated}
                  </Typography>
                  <Typography>
                    {t('label.matching-rule-plural')}:{' '}
                    {evaluationInfo.summary.matchingRules}
                  </Typography>
                  <Typography>
                    {t('label.allow-rule-plural')}:{' '}
                    {evaluationInfo.summary.allowRules}
                  </Typography>
                  <Typography>
                    {t('label.deny-rule-plural')}:{' '}
                    {evaluationInfo.summary.denyRules}
                  </Typography>
                  <Typography>
                    {t('label.time-ms', {
                      milliseconds: evaluationInfo.summary.evaluationTimeMs,
                    })}
                  </Typography>
                </Box>
              </div>
            )}

            <div className="evaluation-steps">
              <Typography as="h5" size="text-md" weight="semibold">
                {t('label.evaluation-step-plural')}:
              </Typography>
              {evaluationInfo.evaluationSteps.map((step) => (
                <Card
                  className="evaluation-step"
                  color={step.matched ? 'success' : 'default'}
                  key={step.stepNumber}
                  size="sm">
                  <Card.Header
                    title={
                      <Box
                        inline
                        align="center"
                        className="layout-space layout-space-horizontal"
                        gap={2}
                        itemClassName="layout-space-item">
                        <Typography>
                          {t('label.step')}{' '}
                          <Typography>{step.stepNumber}</Typography>
                          {' : '}
                        </Typography>
                        <Typography weight="semibold">
                          {step.policy.name}
                        </Typography>
                        <Typography>
                          {' - '} {t('label.rule') + ': '}{' '}
                          <Typography>{step.rule}</Typography>
                        </Typography>
                      </Box>
                    }
                  />
                  <Card.Content>
                    <Box
                      inline
                      align="stretch"
                      className="layout-space w-full"
                      direction="col"
                      gap={2}
                      itemClassName="layout-space-item">
                      <Typography>
                        {t('label.source') + ': '}{' '}
                        <Typography>{step.source}</Typography>{' '}
                        <Typography>({step.sourceEntity.name})</Typography>
                      </Typography>
                      <Typography>
                        {t('label.effect')}:{' '}
                        <strong
                          style={{
                            color:
                              step.effect.toUpperCase() === 'ALLOW'
                                ? '#52c41a'
                                : '#f5222d',
                          }}>
                          {step.effect}
                        </strong>
                      </Typography>
                      <Typography>
                        {t('label.matched')}:{' '}
                        <strong>
                          {step.matched ? t('label.yes') : t('label.no')}
                        </strong>
                      </Typography>
                      <Typography color="secondary">
                        {step.matchReason}
                      </Typography>
                      {step.conditionEvaluations.length > 0 && (
                        <div>
                          <Typography>
                            {t('label.condition-plural')}:
                          </Typography>
                          {step.conditionEvaluations.map((cond) => (
                            <div
                              className="condition-eval"
                              key={cond.condition}>
                              <Typography>
                                <code>{cond.condition}</code>
                              </Typography>
                              <Typography>
                                {' → '}
                                <Typography>
                                  {cond.result
                                    ? t('label.true')
                                    : t('label.false')}
                                </Typography>
                              </Typography>
                              <Typography color="secondary">
                                <Typography>
                                  (${cond.evaluationDetails})
                                </Typography>
                              </Typography>
                            </div>
                          ))}
                        </div>
                      )}
                    </Box>
                  </Card.Content>
                </Card>
              ))}
            </div>

            {evaluationInfo.summary?.reasonsForDecision && (
              <div className="decision-reasons">
                <Typography as="h5" size="text-md" weight="semibold">
                  {t('label.reasons-for-decision')}:
                </Typography>
                {evaluationInfo.summary.reasonsForDecision.map((reason) => (
                  <Typography className="decision-reason" key={reason}>
                    {'• '}
                    <Typography>{reason}</Typography>
                  </Typography>
                ))}
              </div>
            )}
          </Box>
        </Card.Content>
      </Card>
    );
  };

  return (
    <PageLayoutV1
      className="bg-grey admin-permission-debugger"
      pageTitle={t('label.permission-debugger')}>
      <Grid
        className="layout-row layout-grid p-x-lg"
        style={{ ...getLayoutGutter(0, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          <Card className="m-b-md">
            <Card.Content>
              <Box
                inline
                align="stretch"
                className="layout-space w-full"
                direction="col"
                gap={4}
                itemClassName="layout-space-item">
                <div>
                  <Typography as="h5" size="text-md" weight="semibold">
                    {t('label.select-user-to-debug-permissions')}
                  </Typography>
                </div>

                <div className="tw:w-full tw:max-w-100">
                  {/* Keep the popup open while the debounced search replaces its empty collection. */}
                  <ComboBox
                    allowsEmptyCollection
                    aria-label={t('label.search-entity', {
                      entity: t('label.user'),
                    })}
                    emptyState={
                      searchingUsers ? <Loader size="small" /> : undefined
                    }
                    items={userOptions.map((option) => ({
                      id: option.value,
                      label: option.label,
                    }))}
                    placeholder={t('label.search-entity', {
                      entity: t('label.user'),
                    })}
                    shortcut={false}
                    onInputChange={searchUsers}
                    onSelectionChange={(key) => {
                      if (key != null) {
                        handleUserSelect(String(key));
                      }
                    }}>
                    {(item) => (
                      <CoreSelect.Item id={item.id}>
                        {item.label}
                      </CoreSelect.Item>
                    )}
                  </ComboBox>
                </div>

                {selectedUsername && (
                  <>
                    <Typography color="secondary">
                      {t('label.selected-entity', {
                        entity: t('label.user-lowercase'),
                      })}
                      {': '}
                      <strong>
                        <Typography>{selectedUsername}</Typography>
                      </strong>
                    </Typography>
                  </>
                )}
              </Box>
            </Card.Content>
          </Card>

          <Card className="m-b-md">
            <Card.Header title={t('label.evaluate-permission')} />
            <Card.Content>
              {!selectedUsername ? (
                <Typography color="secondary">
                  {t('message.select-user-first')}
                </Typography>
              ) : (
                <Form form={form} layout="vertical" onFinish={handleEvaluate}>
                  <Box
                    inline
                    align="stretch"
                    className="layout-space w-full"
                    direction="col"
                    gap={2}
                    itemClassName="layout-space-item">
                    <Box
                      inline
                      align="center"
                      className="layout-space layout-space-horizontal"
                      gap={2}
                      itemClassName="layout-space-item">
                      <Form.Item
                        label={t('label.resource')}
                        name="resource"
                        rules={[
                          {
                            required: true,
                            message: t('label.field-required', {
                              field: t('label.resource'),
                            }),
                          },
                        ]}>
                        <Select
                          showSearch
                          placeholder={t('label.select-entity', {
                            entity: t('label.resource'),
                          })}
                          style={{ width: 200 }}>
                          {PERMISSION_RESOURCES.map((resource) => (
                            <Option key={resource} value={resource}>
                              {resource}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item
                        label={t('label.operation')}
                        name="operation"
                        rules={[
                          {
                            required: true,
                            message: t('label.field-required', {
                              field: t('label.operation'),
                            }),
                          },
                        ]}>
                        <Select
                          showArrow
                          placeholder={t('label.select-entity', {
                            entity: t('label.operation'),
                          })}
                          style={{ width: 200 }}>
                          {PERMISSION_OPERATIONS.map((operation) => (
                            <Option key={operation} value={operation}>
                              {operation}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item
                        label={t('label.resource-fqn-or-id') + ' (Optional)'}
                        name="resourceId">
                        <Input
                          placeholder={t('label.enter-resource-fqn-or-id')}
                        />
                      </Form.Item>
                    </Box>

                    <Form.Item>
                      <Button
                        color="primary"
                        isLoading={loadingEvaluation}
                        type="submit">
                        {t('label.evaluate')}
                      </Button>
                    </Form.Item>
                  </Box>
                </Form>
              )}
            </Card.Content>
          </Card>

          {renderEvaluationResult()}

          {loadingPermissions && (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          )}

          {permissionInfo && !loadingPermissions && (
            <Card className="m-b-md">
              <Card.Header
                title={`${t('label.permissions-for')} ${selectedUsername}`}
              />
              <Card.Content>
                <UserPermissions
                  isLoggedInUser={false}
                  username={selectedUsername}
                />
              </Card.Content>
            </Card>
          )}
        </Grid.Item>
      </Grid>
    </PageLayoutV1>
  );
};

export default AdminPermissionDebugger;
