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
import {
  CheckCircleTwoTone,
  DeleteOutlined,
  EditOutlined,
  InfoCircleTwoTone,
  PlayCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tag, Tooltip, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  Column,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import {
  deleteContractById,
  getLatestContractResults,
  validateContractById,
} from '../../../rest/contractAPI';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import { OwnerAvatar } from '../../common/OwnerAvtar/OwnerAvatar';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import Table from '../../common/Table/Table';

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
}> = ({ contract, onEdit }) => {
  const { t } = useTranslation();
  const [validateLoading, setValidateLoading] = useState(false);

  const schemaColumns = [
    {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: t('label.type'),
      dataIndex: 'dataType',
      key: 'dataType',
      render: (type: string) => <Tag color="purple">{type}</Tag>,
    },
    {
      title: t('label.constraints'),
      dataIndex: 'constraint',
      key: 'constraint',
      render: (constraint: string, record: Column) => (
        <Space>
          {constraint && <Tag color="red">{constraint}</Tag>}
          {record?.description && (
            <Tooltip title={record.description}>
              <InfoCircleTwoTone twoToneColor="#1890ff" />
            </Tooltip>
          )}
          {record?.tags?.map((tag) => (
            <Tag color="gold" key={tag.tagFQN}>
              {tag.displayName || tag.name}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  // Dummy data for status, quality, etc. Replace with real contract.latestResult/qualityExpectations as needed.
  const contractStatus = [
    {
      label: t('label.schema'),
      status: t('label.passed'),
      desc: t('message.passed-x-checks', { count: 5 }),
      time: '2 mins ago',
    },
    {
      label: t('label.semantics'),
      status: t('label.passed'),
      desc: t('message.passed-x-checks', { count: 5 }),
      time: '2 mins ago',
    },
    {
      label: t('label.security'),
      status: t('label.issue'),
      desc: t('message.issue-in-x-of-y-checks', { x: 1, y: 5 }),
      time: '2 mins ago',
    },
    {
      label: t('label.quality'),
      status: t('label.failed'),
      desc: t('message.failed-x-of-y-checks', { x: 2, y: 5 }),
      time: '2 mins ago',
    },
    {
      label: t('label.sla'),
      status: t('label.passed'),
      desc: t('message.passed-x-checks', { count: 5 }),
      time: '2 mins ago',
    },
  ];

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

  useEffect(() => {
    if (contract?.id) {
      getLatestContractResults(contract.id).then((res) => {
        // eslint-disable-next-line no-console
        console.log(res);
      });
    }
  }, [contract]);

  const handleRunNow = () => {
    if (contract?.id) {
      setValidateLoading(true);
      validateContractById(contract.id).finally(() => {
        setValidateLoading(false);
      });
    }
  };

  const handleDelete = () => {
    if (contract?.id) {
      deleteContractById(contract.id);
    }
  };

  if (!contract) {
    return (
      <ErrorPlaceHolderNew
        icon={<EmptyContractIcon />}
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        Create a contract based on all the metadata which you got for this
        entity.
        <div>
          <Button icon={<PlusOutlined />} type="primary" onClick={onEdit}>
            {t('label.add-entity', { entity: t('label.contract') })}
          </Button>
        </div>
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
              Created 4 hour ago by {contract.updatedBy}
            </Text>

            <div>
              <Tag color="blue">Active</Tag>
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
                icon={<DeleteOutlined />}
                size="small"
                onClick={handleDelete}
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
        <Col span={16}>
          <DescriptionV1
            wrapInCard
            description={contract.description}
            entityType={EntityType.DATA_CONTRACT}
            showCommentsIcon={false}
            showSuggestions={false}
          />

          {/* Schema Card */}
          <Card
            className="new-header-border-card"
            style={{ marginTop: 16 }}
            title={
              <div>
                <Title level={5}>{t('label.schema')}</Title>
                <Typography.Text type="secondary">
                  Expected schema structure of this asset
                </Typography.Text>
              </div>
            }>
            <Table
              columns={schemaColumns}
              dataSource={contract.schema || []}
              pagination={false}
              rowKey="name"
              size="small"
            />
          </Card>
        </Col>

        {/* Right Column */}
        <Col span={8}>
          {/* Contract Status Card */}
          <Card
            className="new-header-border-card"
            title={<Title level={5}>{t('label.contract-status')}</Title>}>
            {contractStatus.map((item) => (
              <Row align="middle" key={item.label} style={{ marginBottom: 12 }}>
                <Col span={12}>
                  <Text>{item.label}</Text>
                </Col>
                <Col span={6}>
                  <StatusBadge
                    label={item.status}
                    status={getStatusType(item.status)}
                  />
                </Col>
                <Col span={6}>
                  <Text style={{ fontSize: 12 }} type="secondary">
                    {item.desc}
                  </Text>
                </Col>
              </Row>
            ))}
          </Card>

          {/* Semantics Card */}
          <Card
            className="new-header-border-card"
            style={{ marginTop: 16 }}
            title={<Title level={5}>{t('label.semantics')}</Title>}>
            <Row gutter={[0, 8]}>
              <Col span={24}>
                <Text strong>{t('label.entity-description')}</Text>{' '}
                <Tag color="orange">{t('label.issue')}</Tag>
                <div>
                  <Text type="secondary">
                    {t('message.entity-description-required')}
                  </Text>
                </div>
              </Col>

              <Col span={24} style={{ marginTop: 8 }}>
                <Text strong>{t('label.custom-integrity-rules')}</Text>
                <div>
                  <Space direction="vertical">
                    <span>
                      <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                      {t('message.customer-id-must-exist')}
                    </span>
                    <span>
                      <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                      {t('message.email-must-match-pattern')}
                    </span>
                    <span>
                      <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                      {t('message.created-at-must-be-recent')}
                    </span>
                    <span>
                      <CheckCircleTwoTone twoToneColor="#52c41a" />{' '}
                      {t('message.customer-order-must-have-user')}
                    </span>
                  </Space>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Quality Card */}
          <Card
            className="new-header-border-card"
            style={{ marginTop: 16 }}
            title={<Title level={5}>{t('label.quality')}</Title>}>
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
                      <CheckCircleTwoTone twoToneColor="#52c41a" /> {a.label}{' '}
                      <Text type="secondary">{a.desc}</Text>
                    </span>
                  ))}
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export { ContractDetail };
