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

import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from '../components/AIGovUntitled.component';
import {
  RegistryFramework,
  RegistryFrameworkStatus,
} from '../sections/Registry/Registry.types';
import '../styles/ai-gov-pills.less';
import { AIAssetView } from './AssetDetail.types';

interface OverviewTabProps {
  view: AIAssetView;
}

const FRAMEWORK_LABELS: Record<RegistryFramework, string> = {
  [RegistryFramework.EU_AI_ACT]: 'EU AI Act',
  [RegistryFramework.NIST_AI_RMF]: 'NIST AI RMF',
  [RegistryFramework.ISO_IEC_42001]: 'ISO/IEC 42001',
  [RegistryFramework.SINGAPORE_MGF]: 'Singapore MGF',
  [RegistryFramework.CANADA_AIDA]: 'Canada AIDA',
  [RegistryFramework.US_BILL_OF_RIGHTS]: 'US AI BoR',
  [RegistryFramework.UK_AI]: 'UK AI',
  [RegistryFramework.CHINA_AI]: 'China AI',
  [RegistryFramework.CUSTOM]: 'Custom',
};

const STATUS_PILL: Record<RegistryFrameworkStatus, string> = {
  Compliant: 'ai-gov-pill--success',
  PartiallyCompliant: 'ai-gov-pill--warning',
  NonCompliant: 'ai-gov-pill--error',
  UnderReview: 'ai-gov-pill--info',
  NotApplicable: 'ai-gov-pill--quiet',
};

const formatPercent = (value?: number) =>
  typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';

const formatNumber = (value?: number) => {
  if (typeof value !== 'number') {
    return '—';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return value.toString();
};

const formatCost = (value?: number, currency?: string) => {
  if (typeof value !== 'number') {
    return '—';
  }
  const code = currency ?? 'USD';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

const formatDate = (value?: number) =>
  typeof value === 'number' ? new Date(value).toLocaleDateString() : '—';

const OverviewTab = ({ view }: OverviewTabProps) => {
  const { t } = useTranslation();

  return (
    <Row gutter={[16, 16]}>
      <Col lg={16} xs={24}>
        <Space className="tw:w-full" direction="vertical" size="middle">
          <Card title={t('label.compliance-summary')}>
            {isEmpty(view.frameworkSummaries) ? (
              <Empty
                description={t('label.no-entity', {
                  entity: t('label.compliance'),
                })}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Row gutter={[12, 12]}>
                {view.frameworkSummaries.map((summary) => (
                  <Col key={summary.framework} md={8} sm={12} xs={24}>
                    <Card bordered size="small">
                      <Typography.Text strong>
                        {FRAMEWORK_LABELS[summary.framework]}
                      </Typography.Text>
                      <div className="tw:mt-2">
                        <span
                          className={`ai-gov-pill ${
                            STATUS_PILL[summary.status]
                          }`}>
                          {summary.status}
                        </span>
                      </div>
                      {summary.assessedBy && (
                        <Typography.Paragraph
                          className="tw:mt-2 tw:mb-0"
                          type="secondary">
                          {t('label.assessed-by')}: {summary.assessedBy}
                        </Typography.Paragraph>
                      )}
                      {summary.assessedAt && (
                        <Typography.Paragraph
                          className="tw:mb-0"
                          type="secondary">
                          {t('label.last-assessed')}:{' '}
                          {formatDate(summary.assessedAt)}
                        </Typography.Paragraph>
                      )}
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          <Card title={t('label.data-access')}>
            <Space direction="vertical" size="small">
              <Space>
                {view.accessesPii ? (
                  <span className="ai-gov-pill ai-gov-pill--pii">
                    <span className="ai-gov-pill-dot" />
                    {t('label.pii-uppercase')}
                  </span>
                ) : (
                  <span className="ai-gov-pill ai-gov-pill--quiet">
                    {t('label.no-entity', { entity: t('label.pii-uppercase') })}
                  </span>
                )}
                {view.accessesSensitive && (
                  <span className="ai-gov-pill ai-gov-pill--high">
                    <span className="ai-gov-pill-dot" />
                    {t('label.sensitive')}
                  </span>
                )}
              </Space>
              <Typography.Text type="secondary">
                {view.dataCategories.length
                  ? view.dataCategories.join(' · ')
                  : t('label.no-data-categories')}
              </Typography.Text>
            </Space>
          </Card>

          <Card title={t('label.operational-metrics')}>
            <Row gutter={[16, 16]}>
              <Col md={6} sm={12} xs={24}>
                <Statistic
                  title={t('label.requests')}
                  value={formatNumber(view.metrics.totalExecutions)}
                />
              </Col>
              <Col md={6} sm={12} xs={24}>
                <Statistic
                  title={t('label.success-rate')}
                  value={formatPercent(view.metrics.successRate)}
                />
              </Col>
              <Col md={6} sm={12} xs={24}>
                <Statistic
                  title={t('label.bias-score')}
                  value={
                    typeof view.metrics.overallBiasScore === 'number'
                      ? view.metrics.overallBiasScore.toFixed(2)
                      : '—'
                  }
                  valueStyle={
                    view.metrics.biasDetected
                      ? { color: 'var(--warning-700)' }
                      : undefined
                  }
                />
              </Col>
              <Col md={6} sm={12} xs={24}>
                <Statistic
                  title={t('label.cost')}
                  value={formatCost(
                    view.metrics.totalCost,
                    view.metrics.currency
                  )}
                />
              </Col>
            </Row>
          </Card>
        </Space>
      </Col>

      <Col lg={8} xs={24}>
        <Space className="tw:w-full" direction="vertical" size="middle">
          <Card title={t('label.owner-plural')}>
            {isEmpty(view.owners) ? (
              <Typography.Text type="danger">
                {t('label.unassigned')}
              </Typography.Text>
            ) : (
              <Space direction="vertical" size="small">
                {view.owners.map((owner) => (
                  <Space key={owner.id}>
                    <Avatar size={24}>
                      {(owner.displayName ??
                        owner.name ??
                        '?')[0]?.toUpperCase()}
                    </Avatar>
                    <Typography.Text>
                      {owner.displayName ?? owner.name}
                    </Typography.Text>
                  </Space>
                ))}
              </Space>
            )}
          </Card>

          <Card title={t('label.tag-plural')}>
            {isEmpty(view.tags) ? (
              <Typography.Text type="secondary">
                {t('label.no-tags-added')}
              </Typography.Text>
            ) : (
              <Space wrap size={[4, 4]}>
                {view.tags.map((tag) => (
                  <Tag key={tag.tagFQN}>{tag.tagFQN}</Tag>
                ))}
              </Space>
            )}
          </Card>

          <Card title={t('label.certificate')}>
            {view.certificate ? (
              <Space direction="vertical" size="small">
                {view.certificate.number && (
                  <div>
                    <Typography.Text type="secondary">
                      {t('label.certificate-number')}
                    </Typography.Text>
                    <div className="tw:font-mono tw:text-sm">
                      {view.certificate.number}
                    </div>
                  </div>
                )}
                {view.certificate.validUntil && (
                  <div>
                    <Typography.Text type="secondary">
                      {t('label.valid-until')}
                    </Typography.Text>
                    <div>{formatDate(view.certificate.validUntil)}</div>
                  </div>
                )}
                {view.certificate.documentationUrl && (
                  <Button
                    href={view.certificate.documentationUrl}
                    rel="noopener noreferrer"
                    size="small"
                    target="_blank"
                    type="link">
                    {t('label.view-documentation')}
                  </Button>
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                {t('label.no-certificate-on-file')}
              </Typography.Text>
            )}
          </Card>
        </Space>
      </Col>
    </Row>
  );
};

export default OverviewTab;
