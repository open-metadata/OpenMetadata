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
  CheckCircleTwoTone,
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

import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import {
  getContractResultByResultId,
  validateContractById,
} from '../../../rest/contractAPI';
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
  const [latestContractResults, setLatestContractResults] =
    useState<DataContractResult | null>(null);

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

  // Dynamic contract status based on latestContractResults

  const qualityStats = {
    total: 100,
    success: 60,
    failed: 10,
    aborted: 30,
    assertions: [
      {
        label: t('label.probability-range'),
        desc: t('message.churn-probability-range'),
      },
      {
        label: t('label.unique-event-id'),
        desc: t('message.event-id-must-be-0'),
      },
      {
        label: t('label.daily-volume-threshold'),
        desc: t('message.daily-volume-threshold'),
      },
      {
        label: t('label.probability-range'),
        desc: t('message.churn-probability-range'),
      },
    ],
  };

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
    }
  }, [contract?.id]);

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
                type="default"
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
                  title: <Title level={5}>{t('label.quality')}</Title>,
                }}>
                <Row gutter={[0, 8]}>
                  <Col span={24}>
                    <Row align="middle" gutter={8}>
                      <Col>
                        <Text strong>{t('label.total-tests')}</Text>
                      </Col>
                      <Col>
                        <Tag color="blue">{qualityStats.total}</Tag>
                      </Col>
                      <Col>
                        <Text strong>{t('label.success')}</Text>
                      </Col>
                      <Col>
                        <Tag color="green">{qualityStats.success}</Tag>
                      </Col>
                      <Col>
                        <Text strong>{t('label.failed')}</Text>
                      </Col>
                      <Col>
                        <Tag color="red">{qualityStats.failed}</Tag>
                      </Col>
                      <Col>
                        <Text strong>{t('label.aborted')}</Text>
                      </Col>
                      <Col>
                        <Tag color="orange">{qualityStats.aborted}</Tag>
                      </Col>
                    </Row>
                  </Col>
                  <Col span={24} style={{ marginTop: 8 }}>
                    <Space direction="vertical">
                      {qualityStats.assertions.map((a, i) => (
                        <span key={i}>
                          <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                          {a.label} <Text type="secondary">{a.desc}</Text>
                        </span>
                      ))}
                    </Space>
                  </Col>
                </Row>
              </ExpandableCard>
            </Col>
          </Row>
        </Col>
      </Row>
    </>
  );
};

export { ContractDetail };
