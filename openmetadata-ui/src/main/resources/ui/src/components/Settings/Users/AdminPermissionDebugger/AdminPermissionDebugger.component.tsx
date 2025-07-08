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
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchQuery } from '../../../../rest/searchAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import UserPermissions from '../UsersProfile/UserPermissions/UserPermissions.component';
import {
  evaluatePermission,
  getPermissionDebugInfo,
  PermissionDebugInfo,
  PermissionEvaluationDebugInfo,
} from '../../../../rest/permissionAPI';
import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';
import { SearchIndex } from '../../../../enums/search.enum';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import './AdminPermissionDebugger.style.less';

const { Title, Text } = Typography;
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

  const operations = useMemo(
    () => [
      // View operations
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewUsage,
      Operation.ViewTests,
      Operation.ViewQueries,
      Operation.ViewDataProfile,
      Operation.ViewSampleData,
      Operation.ViewProfilerGlobalConfiguration,
      Operation.ViewTestCaseFailedRowsSample,

      // Create operations
      Operation.Create,
      Operation.CreateIngestionPipelineAutomator,

      // Edit operations
      Operation.EditAll,
      Operation.EditDescription,
      Operation.EditDisplayName,
      Operation.EditLineage,
      Operation.EditOwners,
      Operation.EditCustomFields,
      Operation.EditTags,
      Operation.EditQueries,
      Operation.EditDataProfile,
      Operation.EditSampleData,
      Operation.EditTests,
      Operation.EditCertification,
      Operation.EditEntityRelationship,
      Operation.EditPolicy,
      Operation.EditReviewers,
      Operation.EditRole,
      Operation.EditStatus,
      Operation.EditGlossaryTerms,
      Operation.EditTeams,
      Operation.EditTier,
      Operation.EditUsage,
      Operation.EditUsers,
      Operation.EditLifeCycle,
      Operation.EditKnowledgePanel,
      Operation.EditPage,
      Operation.EditIngestionPipelineStatus,

      // Delete operations
      Operation.Delete,
      Operation.DeleteTestCaseFailedRowsSample,

      // Other operations
      Operation.Deploy,
      Operation.Trigger,
      Operation.Kill,
      Operation.GenerateToken,

      // SCIM operations
      Operation.CreateScim,
      Operation.EditScim,
      Operation.DeleteScim,
      Operation.ViewScim,
    ],
    []
  );

  const resources = useMemo(
    () => [
      'table',
      'database',
      'databaseSchema',
      'dashboard',
      'pipeline',
      'topic',
      'container',
      'mlmodel',
      'searchIndex',
      'glossary',
      'glossaryTerm',
      'tag',
      'policy',
      'role',
      'team',
      'user',
    ],
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
          includeSourceFields: ['name', 'displayName'],
        });

        const options = response.hits.hits.map((hit: any) => ({
          value: hit._source.name,
          label: `${hit._source.displayName || hit._source.name} (${
            hit._source.name
          })`,
        }));

        setUserOptions(options);
      } catch (error) {
        // Error is handled by not setting user options
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
      showErrorToast(new Error('Please select a user first'));

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
            <Title level={4}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              {t('label.decision')}: <span>{evaluationInfo.finalDecision}</span>
            </Title>
            <Text>
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
            </Text>
          </div>

          {evaluationInfo.summary && (
            <div className="evaluation-stats">
              <Space>
                <Text>
                  {t('label.policies-evaluated')}:{' '}
                  {evaluationInfo.summary.totalPoliciesEvaluated}
                </Text>
                <Text>
                  {t('label.rules-evaluated')}:{' '}
                  {evaluationInfo.summary.totalRulesEvaluated}
                </Text>
                <Text>
                  {t('label.matching-rule-plural')}:{' '}
                  {evaluationInfo.summary.matchingRules}
                </Text>
                <Text>
                  {t('label.allow-rule-plural')}:{' '}
                  {evaluationInfo.summary.allowRules}
                </Text>
                <Text>
                  {t('label.deny-rule-plural')}:{' '}
                  {evaluationInfo.summary.denyRules}
                </Text>
                <Text>
                  {t('label.time-ms', {
                    milliseconds: evaluationInfo.summary.evaluationTimeMs,
                  })}
                </Text>
              </Space>
            </div>
          )}

          <div className="evaluation-steps">
            <Title level={5}>{t('label.evaluation-step-plural')}:</Title>
            {evaluationInfo.evaluationSteps.map((step) => (
              <Card
                className={`evaluation-step ${
                  step.matched ? 'matched' : 'not-matched'
                }`}
                key={step.stepNumber}
                size="small"
                title={
                  <Space>
                    <Text>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      {t('label.step')} <span>{step.stepNumber}</span>:
                    </Text>
                    <Text strong>{step.policy.name}</Text>
                    <Text>
                      {/* eslint-disable-next-line i18next/no-literal-string */}
                      - {t('label.rule')}: <span>{step.rule}</span>
                    </Text>
                  </Space>
                }>
                <Space className="w-full" direction="vertical" size="small">
                  <Text>
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    {t('label.source')}: <span>{step.source}</span> (
                    <span>{step.sourceEntity.name}</span>)
                  </Text>
                  <Text>
                    {t('label.effect')}:{' '}
                    <strong
                      style={{
                        color: step.effect === 'ALLOW' ? '#52c41a' : '#f5222d',
                      }}>
                      {step.effect}
                    </strong>
                  </Text>
                  <Text>
                    {t('label.matched')}:{' '}
                    <strong>
                      {step.matched ? t('label.yes') : t('label.no')}
                    </strong>
                  </Text>
                  <Text type="secondary">{step.matchReason}</Text>
                  {step.conditionEvaluations.length > 0 && (
                    <div>
                      <Text>{t('label.condition-plural')}:</Text>
                      {step.conditionEvaluations.map((cond, idx) => (
                        <div className="condition-eval" key={idx}>
                          <Text code>{cond.condition}</Text>
                          <Text>
                            {/* eslint-disable-next-line i18next/no-literal-string */}{' '}
                            →{' '}
                            <span>
                              {cond.result ? t('label.true') : t('label.false')}
                            </span>
                          </Text>
                          <Text type="secondary">
                            {/* eslint-disable-next-line i18next/no-literal-string */}{' '}
                            (<span>{cond.evaluationDetails}</span>)
                          </Text>
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
              <Title level={5}>{t('label.reasons-for-decision')}:</Title>
              {evaluationInfo.summary.reasonsForDecision.map((reason, idx) => (
                <Text key={idx}>
                  {/* eslint-disable-next-line i18next/no-literal-string */}•{' '}
                  <span>{reason}</span>
                </Text>
              ))}
            </div>
          )}
        </Space>
      </Card>
    );
  };

  return (
    <PageLayoutV1
      className="bg-grey"
      pageTitle={t('label.permission-debugger')}>
      <Row className="p-x-lg" gutter={[0, 20]}>
        <Col span={24}>
          <Card className="m-b-md" title={t('label.permission-debugger')}>
            <Space className="w-full" direction="vertical">
              <Title level={4}>
                {t('label.select-user-to-debug-permissions')}
              </Title>

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
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <Text type="secondary">
                    {t('label.selected-entity', {
                      entity: t('label.user-lowercase'),
                    })}
                    :{' '}
                    <strong>
                      <span>{selectedUsername}</span>
                    </strong>
                  </Text>
                </>
              )}
            </Space>
          </Card>

          <Card className="m-b-md" title={t('label.evaluate-permission')}>
            {!selectedUsername ? (
              <Text type="secondary">{t('message.select-user-first')}</Text>
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
                        placeholder={t('label.select-entity', {
                          entity: t('label.resource'),
                        })}
                        style={{ width: 200 }}>
                        {resources.map((resource) => (
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
                        placeholder={t('label.select-entity', {
                          entity: t('label.operation'),
                        })}
                        style={{ width: 200 }}>
                        {operations.map((operation) => (
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
