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
import Icon, { PlayCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { Loading } from '@melloware/react-logviewer';
import {
  Button,
  Card,
  Col,
  Divider,
  RadioChangeEvent,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart } from 'recharts';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new-thick.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as FailIcon } from '../../../assets/svg/ic-fail.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-successful.svg';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';
import {
  ICON_DIMENSION_USER_PAGE,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { DataContractMode } from '../../../constants/DataContract.constants';
import { TEST_CASE_STATUS_ICON } from '../../../constants/DataQuality.constants';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  ContractExecutionStatus,
  DataContractResult,
} from '../../../generated/entity/datacontract/dataContractResult';
import { TestCase, TestSummary } from '../../../generated/tests/testCase';
import {
  getContractResultByResultId,
  validateContractById,
} from '../../../rest/contractAPI';
import {
  getListTestCaseBySearch,
  getTestCaseExecutionSummary,
} from '../../../rest/testAPI';
import {
  downloadContractYamlFile,
  getConstraintStatus,
  getContractStatusType,
  getTestCaseSummaryChartItems,
} from '../../../utils/DataContract/DataContractUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import Table from '../../common/Table/Table';
import ContractViewSwitchTab from '../ContractViewSwitchTab/ContractViewSwitchTab.component';
import ContractYaml from '../ContractYaml/ContractYaml.component';
import './contract-detail.less';

const ContractDetail: React.FC<{
  contract?: DataContract | null;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ contract, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [validateLoading, setValidateLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestCaseLoading, setIsTestCaseLoading] = useState(false);
  const [latestContractResults, setLatestContractResults] =
    useState<DataContractResult>();
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [testCaseResult, setTestCaseResult] = useState<TestCase[]>([]);
  const [mode, setMode] = useState<DataContractMode>(DataContractMode.UI);

  const fetchLatestContractResults = async () => {
    try {
      setIsLoading(true);
      const results = await getContractResultByResultId(
        contract?.id || '',
        contract?.latestResult?.resultId || ''
      );
      setLatestContractResults(results);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestCaseSummary = async () => {
    try {
      const response = await getTestCaseExecutionSummary(
        contract?.testSuite?.id
      );
      setTestCaseSummary(response);
    } catch {
      // silent fail
    }
  };

  const fetchTestCases = async () => {
    setIsTestCaseLoading(true);
    try {
      const response = await getListTestCaseBySearch({
        testSuiteId: contract?.testSuite?.id,
        ...DEFAULT_SORT_ORDER,
        limit: 5,
      });
      setTestCaseResult(response.data);
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', {
          entity: t('label.test-case-plural'),
        })
      );
    } finally {
      setIsTestCaseLoading(false);
    }
  };

  const schemaDetail = useMemo(() => {
    return pruneEmptyChildren(contract?.schema || []);
  }, [contract?.schema]);

  const schemaColumns = [
    {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Typography.Text className="text-primary">{name}</Typography.Text>
      ),
    },
    {
      title: t('label.type'),
      dataIndex: 'dataType',
      key: 'dataType',
      render: (type: string) => (
        <Tag className="custom-tag" color="purple">
          {type}
        </Tag>
      ),
    },
    {
      title: t('label.constraint-plural'),
      dataIndex: 'constraint',
      key: 'constraint',
      render: (constraint: string) => (
        <div>
          {constraint ? (
            <Tag className="custom-tag" color="blue">
              {constraint}
            </Tag>
          ) : (
            <Typography.Text data-testid="no-constraints">
              {NO_DATA_PLACEHOLDER}
            </Typography.Text>
          )}
        </div>
      ),
    },
  ];

  const constraintStatus = useMemo(() => {
    if (!latestContractResults) {
      return [];
    }

    return getConstraintStatus(latestContractResults);
  }, [latestContractResults]);

  const { showTestCaseSummaryChart, testCaseSummaryChartItems } =
    useMemo(() => {
      return {
        showTestCaseSummaryChart: Boolean(
          testCaseSummary?.total ??
            testCaseSummary?.success ??
            testCaseSummary?.failed ??
            testCaseSummary?.aborted
        ),
        testCaseSummaryChartItems:
          getTestCaseSummaryChartItems(testCaseSummary),
      };
    }, [testCaseSummary]);

  const showContractStatusAlert = useMemo(() => {
    const { result, contractExecutionStatus } = latestContractResults ?? {};

    return (
      result &&
      (contractExecutionStatus === ContractExecutionStatus.Failed ||
        contractExecutionStatus === ContractExecutionStatus.Aborted)
    );
  }, [latestContractResults]);

  const getSemanticIconPerLastExecution = (semanticName: string) => {
    if (!latestContractResults) {
      return DefaultIcon;
    }
    const isRuleFailed =
      latestContractResults?.semanticsValidation?.failedRules?.find(
        (rule) => rule.ruleName === semanticName
      );

    if (isRuleFailed) {
      return FailIcon;
    }

    return CheckIcon;
  };

  const getTestCaseStatusIcon = (record: TestCase) => (
    <Icon
      className="test-status-icon"
      component={
        TEST_CASE_STATUS_ICON[
          (record?.testCaseResult?.testCaseStatus ??
            'Queued') as keyof typeof TEST_CASE_STATUS_ICON
        ]
      }
    />
  );

  const handleExportContract = useCallback(() => {
    if (!contract) {
      return;
    }

    downloadContractYamlFile(contract);
  }, [contract]);

  const handleRunNow = () => {
    if (contract?.id) {
      setValidateLoading(true);
      validateContractById(contract.id)
        .then(() =>
          showSuccessToast('Contract validation trigger successfully.')
        )
        .finally(() => {
          setValidateLoading(false);
        });
    }
  };

  const handleModeChange = useCallback((e: RadioChangeEvent) => {
    setMode(e.target.value);
  }, []);

  const renderDataContractHeader = useMemo(() => {
    if (!contract) {
      return null;
    }

    return (
      <Row align="middle" justify="space-between">
        <Col flex="auto">
          <Typography.Text className="contract-title">
            {getEntityName(contract)}
          </Typography.Text>

          <Typography.Text className="contract-time">
            {t('message.modified-time-ago-by', {
              time: getRelativeTime(contract.updatedAt),
              by: contract.updatedBy,
            })}
          </Typography.Text>

          <div className="contract-status-badge-container">
            <StatusBadgeV2
              externalIcon={FlagIcon}
              label={contract.status ?? t('label.active')}
              status={StatusType.Success}
            />

            <StatusBadgeV2
              className="contract-version-badge"
              label={t('label.version-number', {
                version: contract.version,
              })}
              status={StatusType.Version}
            />
          </div>
        </Col>
        <Col>
          <div className="contract-action-container">
            {!isEmpty(contract.owners) && (
              <div className="contract-owner-label-container">
                <Typography.Text>{t('label.owner-plural')}</Typography.Text>
                <OwnerLabel
                  avatarSize={24}
                  isCompactView={false}
                  maxVisibleOwners={5}
                  owners={contract.owners}
                  showLabel={false}
                />
              </div>
            )}

            <ContractViewSwitchTab
              handleModeChange={handleModeChange}
              mode={mode}
            />

            <Divider className="contract-divider" type="vertical" />

            <Button
              className="contract-run-now-button"
              icon={<PlayCircleOutlined />}
              loading={validateLoading}
              size="middle"
              onClick={handleRunNow}>
              {t('label.run-now')}
            </Button>

            <Button
              className="contract-export-button"
              data-testid="export-contract-button"
              onClick={handleExportContract}>
              {t('label.export')}
            </Button>

            <Button
              danger
              className="delete-button"
              icon={<DeleteIcon />}
              size="small"
              onClick={onDelete}
            />
            <Button
              className="contract-edit-button"
              icon={
                <EditIcon
                  className="anticon"
                  style={{ ...ICON_DIMENSION_USER_PAGE }}
                />
              }
              type="primary"
              onClick={onEdit}>
              {t('label.edit')}
            </Button>
          </div>
        </Col>
      </Row>
    );
  }, [
    contract,
    mode,
    onDelete,
    onEdit,
    handleRunNow,
    handleModeChange,
    validateLoading,
  ]);

  useEffect(() => {
    if (contract?.id && contract?.latestResult?.resultId) {
      fetchLatestContractResults();
    }

    if (contract?.testSuite?.id) {
      fetchTestCaseSummary();
      fetchTestCases();
    }
  }, [contract]);

  if (!contract) {
    return (
      <ErrorPlaceHolderNew
        icon={
          <EmptyContractIcon className="empty-contract-icon" height={140} />
        }
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph className="m-t-md w-80" type="secondary">
          {t('message.create-contract-description')}
        </Typography.Paragraph>

        <Button
          className="m-t-md"
          data-testid="add-contract-button"
          icon={<PlusOutlined />}
          type="primary"
          onClick={onEdit}>
          {t('label.add-entity', { entity: t('label.contract') })}
        </Button>
      </ErrorPlaceHolderNew>
    );
  }

  return (
    <Card
      className="contract-header-container"
      style={{ marginBottom: 16 }}
      title={renderDataContractHeader}>
      {mode === DataContractMode.YAML ? (
        <ContractYaml contract={contract} />
      ) : (
        <Row className="contract-detail-container" gutter={[16, 0]}>
          {/* Left Column */}
          <Col span={12}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <ExpandableCard
                  cardProps={{
                    className: 'expandable-card-contract',
                    title: (
                      <div className="contract-card-title-container">
                        <Typography.Text className="contract-card-title">
                          {t('label.entity-detail-plural', {
                            entity: t('label.contract'),
                          })}
                        </Typography.Text>
                        <Typography.Text className="contract-card-description">
                          {t('message.expected-schema-structure-of-this-asset')}
                        </Typography.Text>
                      </div>
                    ),
                  }}>
                  <div className="expandable-card-contract-body">
                    <DescriptionV1
                      description={contract.description}
                      entityType={EntityType.DATA_CONTRACT}
                      showCommentsIcon={false}
                      showSuggestions={false}
                    />
                  </div>
                </ExpandableCard>
              </Col>

              <Col span={24}>
                <ExpandableCard
                  cardProps={{
                    className: 'expandable-card-contract',
                    title: (
                      <div className="contract-card-title-container">
                        <Typography.Text className="contract-card-title">
                          {t('label.schema')}
                        </Typography.Text>
                        <Typography.Text className="contract-card-description">
                          {t('message.expected-schema-structure-of-this-asset')}
                        </Typography.Text>
                      </div>
                    ),
                  }}>
                  <Table
                    columns={schemaColumns}
                    dataSource={schemaDetail}
                    pagination={false}
                    rowKey="name"
                    size="small"
                  />
                </ExpandableCard>
              </Col>
            </Row>
          </Col>

          {/* Right Column */}
          <Col span={12}>
            {/* Contract Status Card */}

            <Row gutter={[16, 16]}>
              {contract?.latestResult?.resultId && (
                <Col span={24}>
                  <ExpandableCard
                    cardProps={{
                      className: 'expandable-card-contract',
                      title: (
                        <div className="contract-card-title-container">
                          <Typography.Text className="contract-card-title">
                            {t('label.contract-status')}
                          </Typography.Text>
                          <Typography.Text className="contract-card-description">
                            {t('message.contract-status-description')}
                          </Typography.Text>
                        </div>
                      ),
                    }}>
                    {isLoading ? (
                      <Loading />
                    ) : (
                      <>
                        {showContractStatusAlert && (
                          <AlertBar
                            defafultExpand
                            className="h-full m-b-md"
                            message={latestContractResults?.result ?? ''}
                            type="error"
                          />
                        )}

                        {constraintStatus.map((item) => (
                          <div
                            className="contract-status-card-item d-flex justify-between items-center"
                            key={item.label}>
                            <div className="d-flex items-center">
                              <Icon
                                className="contract-status-card-icon"
                                component={item.icon}
                                data-testid={`${item.label}-icon`}
                              />

                              <div className="d-flex flex-column m-l-md">
                                <Typography.Text className="contract-status-card-label">
                                  {item.label}
                                </Typography.Text>
                                <div>
                                  <Typography.Text className="contract-status-card-desc">
                                    {item.desc}
                                  </Typography.Text>
                                  <Typography.Text className="contract-status-card-time">
                                    {item.time}
                                  </Typography.Text>
                                </div>
                              </div>
                            </div>

                            <StatusBadgeV2
                              label={item.status}
                              status={getContractStatusType(item.status)}
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </ExpandableCard>
                </Col>
              )}

              {/* Semantics Card */}
              {contract?.semantics && contract?.semantics.length > 0 && (
                <Col span={24}>
                  <ExpandableCard
                    cardProps={{
                      className: 'expandable-card-contract',
                      title: (
                        <div className="contract-card-title-container">
                          <Typography.Text className="contract-card-title">
                            {t('label.semantic-plural')}
                          </Typography.Text>
                          <Typography.Text className="contract-card-description">
                            {t('message.semantics-description')}
                          </Typography.Text>
                        </div>
                      ),
                    }}>
                    <div className="expandable-card-contract-body">
                      <Typography.Text className="card-subtitle">
                        {t('label.custom-integrity-rules')}
                      </Typography.Text>
                      <div className="rule-item-container">
                        {(contract?.semantics ?? []).map((item) => (
                          <div className="rule-item">
                            <Icon
                              className={classNames('rule-icon', {
                                'rule-icon-default': !latestContractResults,
                              })}
                              component={getSemanticIconPerLastExecution(
                                item.name
                              )}
                            />
                            <span className="rule-name">{item.name}</span>{' '}
                            <span className="rule-description">
                              {item.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ExpandableCard>
                </Col>
              )}

              {/* Quality Card */}
              {contract?.testSuite?.id && (
                <Col span={24}>
                  <ExpandableCard
                    cardProps={{
                      className: 'expandable-card-contract',
                      title: (
                        <div className="contract-card-title-container">
                          <Typography.Text className="contract-card-title">
                            {t('label.quality')}
                          </Typography.Text>
                          <Typography.Text className="contract-card-description">
                            {t('message.data-quality-test-contract-title')}
                          </Typography.Text>
                        </div>
                      ),
                    }}>
                    <div className="expandable-card-contract-body">
                      {isTestCaseLoading ? (
                        <Loading />
                      ) : (
                        <div className="data-quality-card-container">
                          {showTestCaseSummaryChart && (
                            <div className="data-quality-chart-container">
                              {testCaseSummaryChartItems.map((item) => (
                                <div
                                  className="data-quality-chart-item"
                                  key={item.label}>
                                  <Typography.Text className="chart-label">
                                    {item.label}
                                  </Typography.Text>

                                  <PieChart height={120} width={120}>
                                    <Pie
                                      cx="50%"
                                      cy="50%"
                                      data={item.chartData}
                                      dataKey="value"
                                      innerRadius={40}
                                      outerRadius={50}>
                                      {item.chartData.map((entry, index) => (
                                        <Cell
                                          fill={entry.color}
                                          key={`cell-${index}`}
                                        />
                                      ))}
                                    </Pie>
                                    <text
                                      className="chart-center-text"
                                      dominantBaseline="middle"
                                      textAnchor="middle"
                                      x="50%"
                                      y="50%">
                                      {item.value}
                                    </text>
                                  </PieChart>
                                </div>
                              ))}
                            </div>
                          )}

                          <Space direction="vertical">
                            {testCaseResult.map((item) => {
                              return (
                                <div
                                  className="data-quality-item d-flex items-center"
                                  key={item.id}>
                                  {getTestCaseStatusIcon(item)}
                                  <div className="data-quality-item-content">
                                    <Typography.Text className="data-quality-item-name">
                                      {item.name}
                                    </Typography.Text>
                                    <Typography.Text className="data-quality-item-description">
                                      <RichTextEditorPreviewerNew
                                        markdown={item.description ?? ''}
                                      />
                                    </Typography.Text>
                                  </div>
                                </div>
                              );
                            })}
                          </Space>
                        </div>
                      )}
                    </div>
                  </ExpandableCard>
                </Col>
              )}
            </Row>
          </Col>
        </Row>
      )}
    </Card>
  );
};

export { ContractDetail };
