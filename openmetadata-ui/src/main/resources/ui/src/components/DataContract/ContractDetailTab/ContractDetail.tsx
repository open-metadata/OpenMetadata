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
/* eslint-disable i18next/no-literal-string */
import Icon, {
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Loading } from '@melloware/react-logviewer';
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-check-circle.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';

import { Cell, Pie, PieChart } from 'recharts';
import {
  GREEN_3,
  GREY_200,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
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
import { getConstraintStatus } from '../../../utils/DataContract/DataContractUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import { OwnerAvatar } from '../../common/OwnerAvtar/OwnerAvatar';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import Table from '../../common/Table/Table';
import './contract-detail.less';

const { Title, Text } = Typography;

const getStatusType = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'passed':
    case 'success':
      return StatusType.Success;
    case 'failed':
      return StatusType.Failure;
    case 'issue':
    case 'warning':
      return StatusType.Warning;
    default:
      return StatusType.Pending;
  }
};

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
      render: (name: string) => <Text className="text-primary">{name}</Text>,
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
            <Tag color="red">{constraint}</Tag>
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
    const total = testCaseSummary?.total ?? 0;
    const success = testCaseSummary?.success ?? 0;
    const failed = testCaseSummary?.failed ?? 0;
    const aborted = testCaseSummary?.aborted ?? 0;

    const items = [
      {
        label: t('label.total-test-plural'),
        value: total,
        color: GREEN_3,
        chartData: [
          { name: 'Success', value: success, color: GREEN_3 },
          { name: 'Aborted', value: failed, color: YELLOW_2 },
          { name: 'Failed', value: aborted, color: RED_3 },
        ],
      },
      {
        label: t('label.success'),
        value: success,
        color: GREEN_3,
        chartData: [
          { name: 'Success', value: success, color: GREEN_3 },
          {
            name: 'Unknown',
            value: total - success,
            color: GREY_200,
          },
        ],
      },
      {
        label: t('label.failed'),
        value: failed,
        color: RED_3,
        chartData: [
          { name: 'Failed', value: failed, color: RED_3 },
          {
            name: 'Unknown',
            value: total - failed,
            color: GREY_200,
          },
        ],
      },
      {
        label: t('label.aborted'),
        value: aborted,
        color: YELLOW_2,
        chartData: [
          { name: 'Aborted', value: aborted, color: YELLOW_2 },
          {
            name: 'Unknown',
            value: total - aborted,
            color: GREY_200,
          },
        ],
      },
    ];

    return items;
  }, [testCaseSummary]);

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
    if (contract?.id) {
      fetchLatestContractResults();

      if (contract?.testSuite?.id) {
        fetchTestCaseSummary();
        fetchTestCases();
      }
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
      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col flex="auto">
            <Title level={3} style={{ margin: 0 }}>
              {contract.displayName || contract.name}
            </Title>

            <Text type="secondary">
              {t('message.created-time-ago-by', {
                time: getRelativeTime(contract.updatedAt),
                by: contract.updatedBy,
              })}
            </Text>

            <div className="d-flex items-center gap-2 m-t-xs">
              <StatusBadgeV2
                externalIcon={FlagIcon}
                label={t('label.active')}
                status={StatusType.Success}
              />
              <Text type="secondary">Version {contract.version}</Text>
            </div>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<PlayCircleOutlined />}
                loading={validateLoading}
                size="small"
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
                icon={<EditOutlined />}
                size="small"
                type="primary"
                onClick={onEdit}>
                {t('label.edit')}
              </Button>
            </Space>
          </Col>
        </Row>
        {contract.owners && contract.owners.length > 0 && (
          <Row style={{ marginTop: 16 }}>
            <Col>
              <Text strong style={{ marginRight: 8 }}>
                {t('label.owner')}
              </Text>
              <OwnerAvatar avatarSize={24} owner={contract.owners[0]} />
            </Col>
          </Row>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        {/* Left Column */}
        <Col span={12}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <DescriptionV1
                wrapInCard
                description={contract.description}
                entityType={EntityType.DATA_CONTRACT}
                showCommentsIcon={false}
                showSuggestions={false}
              />
            </Col>

            <Col span={24}>
              <ExpandableCard
                cardProps={{
                  title: (
                    <div>
                      <Title level={5}>{t('label.schema')}</Title>
                      <Typography.Text type="secondary">
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
            <Col span={24}>
              <ExpandableCard
                cardProps={{
                  title: (
                    <div>
                      <Title level={5}>{t('label.contract-status')}</Title>
                      <Typography.Text type="secondary">
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
                          <Text className="contract-status-card-label">
                            {item.label}
                          </Text>
                          <div>
                            <Text className="contract-status-card-desc">
                              {item.desc}
                            </Text>
                            <Text className="contract-status-card-time">
                              {item.time}
                            </Text>
                          </div>
                        </div>
                      </div>

                      <StatusBadgeV2
                        label={item.status}
                        status={getStatusType(item.status)}
                      />
                    </div>
                  ))
                )}
              </ExpandableCard>
            </Col>

            {/* Semantics Card */}
            <Col span={24}>
              <ExpandableCard
                cardProps={{
                  title: (
                    <div>
                      <Title level={5}>{t('label.semantic-plural')}</Title>
                      <Typography.Text type="secondary">
                        {t('message.semantics-description')}
                      </Typography.Text>
                    </div>
                  ),
                }}>
                <Text className="card-subtitle">
                  {t('label.custom-integrity-rules')}
                </Text>
                {(contract?.semantics ?? []).map((item) => (
                  <div className="rule-item">
                    <Icon className="rule-icon" component={CheckIcon} />
                    <span className="rule-name">{item.name}</span>{' '}
                    <span className="rule-description">{item.description}</span>
                  </div>
                ))}
              </ExpandableCard>
            </Col>

            {/* Quality Card */}
            <Col span={24}>
              <ExpandableCard
                cardProps={{
                  title: (
                    <div>
                      <Title level={5}>{t('label.quality')}</Title>,
                      <Typography.Text type="secondary">
                        {t('message.data-quality-test-contract-title')}
                      </Typography.Text>
                    </div>
                  ),
                }}>
                {isTestCaseLoading ? (
                  <Loading />
                ) : (
                  <Row gutter={[0, 8]}>
                    <Col span={24}>
                      <Row
                        align="middle"
                        className="border border-radius-card p-md"
                        gutter={8}>
                        {testCaseSummaryChartItems.map((item) => (
                          <Col key={item.label} span={6}>
                            <Row
                              className="items-center"
                              gutter={16}
                              key={item.label}>
                              <Col span={24}>
                                <Text>{item.label}</Text>
                              </Col>

                              <Col span={24}>
                                <PieChart height={120} width={120}>
                                  <Pie
                                    cx="50%"
                                    cy="50%"
                                    data={item.chartData}
                                    dataKey="value"
                                    innerRadius={45}
                                    outerRadius={60}
                                    paddingAngle={2}>
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
                              </Col>
                            </Row>
                          </Col>
                        ))}
                      </Row>
                    </Col>
                    <Col span={24} style={{ marginTop: 8 }}>
                      <Space direction="vertical">
                        {testCaseResult.map((item) => (
                          <div
                            className="data-quality-item d-flex items-center"
                            key={item.id}>
                            <StatusBadgeV2
                              label=""
                              status={StatusType.Success}
                            />
                            <div className="data-quality-item-content">
                              <Typography.Text className="data-quality-item-name">
                                {item.name}
                              </Typography.Text>
                              <Text className="data-quality-item-description">
                                {item.description}
                              </Text>
                            </div>
                          </div>
                        ))}
                      </Space>
                    </Col>
                  </Row>
                )}
              </ExpandableCard>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  );
};

export { ContractDetail };
