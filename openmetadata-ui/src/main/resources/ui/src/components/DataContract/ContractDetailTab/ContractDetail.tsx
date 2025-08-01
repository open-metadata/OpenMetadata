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
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-check-circle.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';

import { isEmpty } from 'lodash';
import { Cell, Pie, PieChart } from 'recharts';
import {
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { TEST_CASE_STATUS_ICON } from '../../../constants/DataQuality.constants';
import { DEFAULT_SORT_ORDER } from '../../../constants/profiler.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
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
  getConstraintStatus,
  getContractStatusType,
  getTestCaseSummaryChartItems,
} from '../../../utils/DataContract/DataContractUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import Table from '../../common/Table/Table';
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
    useState<DataContractResult | null>(null);
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [testCaseResult, setTestCaseResult] = useState<TestCase[]>([]);

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
      render: (type: string) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: t('label.constraint-plural'),
      dataIndex: 'constraint',
      key: 'constraint',
      render: (constraint: string) => (
        <div>
          {constraint ? (
            <Tag color="blue">{constraint}</Tag>
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

  const testCaseSummaryChartItems = useMemo(() => {
    return getTestCaseSummaryChartItems(testCaseSummary);
  }, [testCaseSummary]);

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
          icon={<PlusOutlined />}
          type="primary"
          onClick={onEdit}>
          {t('label.add-entity', { entity: t('label.contract') })}
        </Button>
      </ErrorPlaceHolderNew>
    );
  }

  return (
    <>
      {/* Header Section */}
      <Card className="contract-header-container" style={{ marginBottom: 16 }}>
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

            <div className="d-flex items-center gap-2 m-t-xs">
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

              <Button
                className="contract-run-now-button"
                icon={<PlayCircleOutlined />}
                loading={validateLoading}
                size="middle"
                onClick={handleRunNow}>
                {t('label.run-now')}
              </Button>
              <Button
                danger
                className="delete-button"
                icon={<DeleteIcon />}
                size="small"
                onClick={onDelete}
              />
              <Button
                icon={
                  <EditIcon className="anticon" style={{ ...ICON_DIMENSION }} />
                }
                size="small"
                type="primary"
                onClick={onEdit}>
                {t('label.edit')}
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

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
                    constraintStatus.map((item) => (
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
                    ))
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
                          <Icon className="rule-icon" component={CheckIcon} />
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
                                    {item.description}
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
    </>
  );
};

export { ContractDetail };
