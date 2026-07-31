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
  AutoComplete,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd';
import { Typography as CoreTypography } from '@openmetadata/ui-core-components';
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
import { getSettingPageEntityBreadCrumb } from '../../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import UserPermissions from '../UsersProfile/UserPermissions/UserPermissions.component';
import {
  PERMISSION_OPERATIONS,
  PERMISSION_RESOURCES,
} from './AdminPermissionDebugger.constants';
import './AdminPermissionDebugger.style.less';

const {
  Text
} = Typography;
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
        headStyle={{
          backgroundColor: evaluationInfo.allowed ? '#f6ffed' : '#fff1f0',
          borderBottom: `2px solid ${
            evaluationInfo.allowed ? '#52c41a' : '#f5222d'
          }`,
        }}
        title={t('label.permission-evaluation-result')}>
        <Space className="w-full" direction="vertical">
          <div className="evaluation-summary">
            <CoreTypography as='h4' size='text-lg'>
              {t('label.decision') + ': '}{' '}
              <span>{evaluationInfo.finalDecision}</span>
            </CoreTypography>
            <CoreTypography>
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
                <span>{` (${evaluationInfo.resourceId})`}</span>
              )}
            </CoreTypography>
          </div>

          {evaluationInfo.summary && (
            <div className="evaluation-stats">
              <Space wrap>
                <CoreTypography>
                  {t('label.policies-evaluated')}:{' '}
                  {evaluationInfo.summary.totalPoliciesEvaluated}
                </CoreTypography>
                <CoreTypography>
                  {t('label.rules-evaluated')}:{' '}
                  {evaluationInfo.summary.totalRulesEvaluated}
                </CoreTypography>
                <CoreTypography>
                  {t('label.matching-rule-plural')}:{' '}
                  {evaluationInfo.summary.matchingRules}
                </CoreTypography>
                <CoreTypography>
                  {t('label.allow-rule-plural')}:{' '}
                  {evaluationInfo.summary.allowRules}
                </CoreTypography>
                <CoreTypography>
                  {t('label.deny-rule-plural')}:{' '}
                  {evaluationInfo.summary.denyRules}
                </CoreTypography>
                <CoreTypography>
                  {t('label.time-ms', {
                    milliseconds: evaluationInfo.summary.evaluationTimeMs,
                  })}
                </CoreTypography>
              </Space>
            </div>
          )}

          <div className="evaluation-steps">
            <CoreTypography as='h5' size='text-md'>{t('label.evaluation-step-plural')}:</CoreTypography>
            {evaluationInfo.evaluationSteps.map((step) => (
              <Card
                className={`evaluation-step ${
                  step.matched ? 'matched' : 'not-matched'
                }`}
                key={step.stepNumber}
                size="small"
                title={
                  <Space>
                    <CoreTypography>
                      {t('label.step')} <span>{step.stepNumber}</span>
                      {' : '}
                    </CoreTypography>
                    <CoreTypography weight='bold'>{step.policy.name}</CoreTypography>
                    <CoreTypography>
                      {' - '} {t('label.rule') + ': '} <span>{step.rule}</span>
                    </CoreTypography>
                  </Space>
                }>
                <Space className="w-full" direction="vertical" size="small">
                  <CoreTypography>
                    {t('label.source') + ': '} <span>{step.source}</span>{' '}
                    <span>({step.sourceEntity.name})</span>
                  </CoreTypography>
                  <CoreTypography>
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
                  </CoreTypography>
                  <CoreTypography>
                    {t('label.matched')}:{' '}
                    <strong>
                      {step.matched ? t('label.yes') : t('label.no')}
                    </strong>
                  </CoreTypography>
                  <CoreTypography color='secondary'>{step.matchReason}</CoreTypography>
                  {step.conditionEvaluations.length > 0 && (
                    <div>
                      <CoreTypography>{t('label.condition-plural')}:</CoreTypography>
                      {step.conditionEvaluations.map((cond, idx) => (
                        <div className="condition-eval" key={idx}>
                          <Text code>{cond.condition}</Text>
                          <CoreTypography>
                            {' → '}
                            <span>
                              {cond.result ? t('label.true') : t('label.false')}
                            </span>
                          </CoreTypography>
                          <CoreTypography color='secondary'>
                            <span>(${cond.evaluationDetails})</span>
                          </CoreTypography>
                        </div>
                      ))}
                    </div>
                  )}
                </Space>
              </Card>
            ))}
          </div>

          {evaluationInfo.summary?.reasonsForDecision && (
            <div className="decision-reasons">
              <CoreTypography as='h5' size='text-md'>{t('label.reasons-for-decision')}:</CoreTypography>
              {evaluationInfo.summary.reasonsForDecision.map((reason, idx) => (
                <CoreTypography key={idx}>
                  {'• '}
                  <span>{reason}</span>
                </CoreTypography>
              ))}
            </div>
          )}
        </Space>
      </Card>
    );
  };

  return (
    <PageLayoutV1
      className="bg-grey admin-permission-debugger"
      pageTitle={t('label.permission-debugger')}>
      <Row className="p-x-lg" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Card>
            <Space className="w-full" direction="vertical" size={16}>
              <div>
                <CoreTypography as='h5' size='text-md'>
                  {t('label.select-user-to-debug-permissions')}
                </CoreTypography>
              </div>

              <AutoComplete
                className="w-full"
                notFoundContent={searchingUsers ? <Spin size="small" /> : null}
                options={userOptions}
                placeholder={t('label.search-entity', {
                  entity: t('label.user'),
                })}
                style={{ maxWidth: 400 }}
                onSearch={searchUsers}
                onSelect={handleUserSelect}
              />

              {selectedUsername && (
                <>
                  <CoreTypography color='secondary'>
                    {t('label.selected-entity', {
                      entity: t('label.user-lowercase'),
                    })}
                    {': '}
                    <strong>
                      <span>{selectedUsername}</span>
                    </strong>
                  </CoreTypography>
                </>
              )}
            </Space>
          </Card>

          <Card className="m-b-md" title={t('label.evaluate-permission')}>
            {!selectedUsername ? (
              <CoreTypography color='secondary'>{t('message.select-user-first')}</CoreTypography>
            ) : (
              <Form form={form} layout="vertical" onFinish={handleEvaluate}>
                <Space className="w-full" direction="vertical">
                  <Space>
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
                  </Space>

                  <Form.Item>
                    <Button
                      htmlType="submit"
                      loading={loadingEvaluation}
                      type="primary">
                      {t('label.evaluate')}
                    </Button>
                  </Form.Item>
                </Space>
              </Form>
            )}
          </Card>

          {renderEvaluationResult()}

          {loadingPermissions && (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          )}

          {permissionInfo && !loadingPermissions && (
            <Card title={`${t('label.permissions-for')} ${selectedUsername}`}>
              <UserPermissions
                isLoggedInUser={false}
                username={selectedUsername}
              />
            </Card>
          )}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default AdminPermissionDebugger;
