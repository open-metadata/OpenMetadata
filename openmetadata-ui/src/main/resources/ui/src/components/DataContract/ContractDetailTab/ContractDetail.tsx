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
  EditOutlined,
  ExportOutlined,
  InfoCircleTwoTone,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import emptyContract from '../../../assets/img/empty-contract.png';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  Column,
  DataContract,
  EntityReference,
} from '../../../generated/entity/data/dataContract';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import { OwnerAvatar } from '../../common/OwnerAvtar/OwnerAvatar';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';

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

const reviewersAvatars = (reviewers: EntityReference[] = []) => (
  <Space className="reviewers-avatar-group" size={-8}>
    {reviewers.slice(0, 5).map((r) => (
      <OwnerAvatar isCompactView avatarSize={28} key={r.id} owner={r} />
    ))}
    {reviewers.length > 5 && <Tag color="blue">+{reviewers.length - 5}</Tag>}
  </Space>
);

const ownersAvatars = (owners: EntityReference[] = []) => (
  <Space className="owners-avatar-group" size={-8}>
    {owners.slice(0, 5).map((o) => (
      <OwnerAvatar isCompactView avatarSize={28} key={o.id} owner={o} />
    ))}
    {owners.length > 5 && <Tag color="blue">+{owners.length - 5}</Tag>}
  </Space>
);

const ContractDetail: React.FC<{
  contract?: DataContract | null;
  onEdit: () => void;
}> = ({ contract, onEdit }) => {
  const { t } = useTranslation();

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

  if (!contract) {
    return (
      <ErrorPlaceHolderNew
        icon={<img alt="empty-contract" src={emptyContract} />}
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
            <Row align="middle" gutter={16}>
              <Col>
                <Title level={3} style={{ margin: 0 }}>
                  {contract.displayName || contract.name}
                </Title>
              </Col>
              <Col>
                <StatusBadge
                  label={contract.status || t('label.draft')}
                  status={getStatusType(contract.status || 'draft')}
                />
              </Col>
            </Row>
            <Row style={{ marginTop: 8 }}>
              <Col>
                <Text type="secondary">
                  {contract.description || t('message.no-description')}
                </Text>
              </Col>
            </Row>
          </Col>
          <Col>
            <Space>
              <Button icon={<ExportOutlined />} size="small">
                {t('label.export')}
              </Button>
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
          {/* Contract Details Card */}
          <Card
            extra={reviewersAvatars(contract.reviewers)}
            title={<Title level={5}>{t('label.contract-details')}</Title>}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text type="secondary">{t('label.description')}</Text>
                <div style={{ marginBottom: 8 }}>
                  {contract.description || (
                    <Text type="secondary">{t('message.no-description')}</Text>
                  )}
                </div>
                <Switch
                  defaultChecked
                  checkedChildren={t('label.enable-incident-management')}
                  style={{ marginBottom: 8 }}
                  unCheckedChildren={t('label.enable-incident-management')}
                />
              </Col>
            </Row>
          </Card>

          {/* Schema Card */}
          <Card
            style={{ marginTop: 16 }}
            title={<Title level={5}>{t('label.schema')}</Title>}>
            <Table
              columns={schemaColumns}
              dataSource={contract.schema || []}
              pagination={false}
              rowKey="name"
              size="small"
            />
          </Card>

          {/* Security Card */}
          <Card
            style={{ marginTop: 16 }}
            title={<Title level={5}>{t('label.security')}</Title>}>
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Text strong>{t('label.access')}:</Text>{' '}
                <Text>
                  {t('message.limited-to-authorized-internal-consumers')}
                </Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('label.classification')}:</Text>{' '}
                <Tag color="red">{t('label.sensitive')}</Tag>
                <Text strong style={{ marginLeft: 16 }}>
                  {t('label.compliance')}
                </Text>{' '}
                <Tag color="purple">GDPR</Tag> <Tag color="purple">CCPA</Tag>
              </Col>
            </Row>
          </Card>

          {/* SLA Card */}
          <Card
            style={{ marginTop: 16 }}
            title={<Title level={5}>{t('label.sla')}</Title>}>
            <Row align="middle" gutter={[16, 8]}>
              <Col span={6}>
                <Text strong>{t('label.availability')}</Text>
                <Progress
                  percent={40}
                  status="active"
                  type="dashboard"
                  width={80}
                />
                <div style={{ color: '#52c41a', fontSize: 12 }}>+9.2%</div>
              </Col>
              <Col span={9}>
                <Text strong>{t('label.data-retention')}</Text>
                <div>
                  {t('message.data-retention-days', { count: 7 })}{' '}
                  <span
                    style={{ color: '#52c41a', fontSize: 12, marginLeft: 8 }}>
                    +9.2%
                  </span>
                </div>
              </Col>
              <Col span={9}>
                <Text strong>{t('label.max-latency')}</Text>
                <div>
                  {t('message.max-latency-seconds', { seconds: 20 })}{' '}
                  <span
                    style={{ color: '#52c41a', fontSize: 12, marginLeft: 8 }}>
                    +6.6%
                  </span>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right Column */}
        <Col span={8}>
          {/* Contract Status Card */}
          <Card
            extra={
              <Space>
                <Button icon={<ExportOutlined />} size="small">
                  {t('label.export')}
                </Button>
                <Button icon={<EditOutlined />} size="small" type="primary">
                  {t('label.edit')}
                </Button>
              </Space>
            }
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
