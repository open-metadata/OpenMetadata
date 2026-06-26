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

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../../../constants/constants';
import { withPageLayout } from '../../../hoc/withPageLayout';
import {
  AIGovernanceFramework,
  FrameworkCoverageEntry,
  getFrameworkByFqn,
  getFrameworkCoverage,
} from '../../../rest/aiGovernanceFrameworkAPI';
import { getDecodedFqn } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AIGovernanceTab } from '../AIGovernancePage.interface';
import type { ColumnsType } from '../components/AIGovUntitled.component';
import {
  Breadcrumb,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from '../components/AIGovUntitled.component';

interface FrameworkDetailPageProps {
  pageTitle: string;
}

const STATUS_TONE: Record<FrameworkCoverageEntry['status'], string> = {
  Met: 'green',
  Partial: 'orange',
  Gap: 'red',
};

const FrameworkDetailPage = ({
  pageTitle: _pageTitle,
}: FrameworkDetailPageProps) => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const [framework, setFramework] = useState<AIGovernanceFramework | null>(
    null
  );
  const [controls, setControls] = useState<FrameworkCoverageEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fqn) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const decoded = getDecodedFqn(fqn);
        const fw = await getFrameworkByFqn(decoded);
        if (cancelled) {
          return;
        }
        setFramework(fw);
        if (fw.id) {
          const coverage = await getFrameworkCoverage(fw.id);
          if (!cancelled) {
            setControls(coverage.controls);
          }
        }
      } catch (error) {
        if (!cancelled) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [fqn]);

  if (loading) {
    return (
      <div className="tw:p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!framework) {
    return (
      <div className="tw:p-6">
        <Card>
          <Empty
            description={t('label.no-entity', {
              entity: t('label.framework-plural'),
            })}
          />
        </Card>
      </div>
    );
  }

  const met = controls.filter((c) => c.status === 'Met').length;
  const total = controls.length;
  const inScopeAssets = controls.reduce(
    (acc, c) => acc + c.affectedAssetCount,
    0
  );

  const columns: ColumnsType<FrameworkCoverageEntry> = [
    {
      title: t('label.control'),
      key: 'control',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>
            {row.displayName ?? row.code}
          </Typography.Text>
          <Typography.Text className="tw:font-mono tw:text-xs" type="secondary">
            {row.code.toUpperCase()}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('label.category'),
      dataIndex: 'category',
      render: (value) => (value ? <Tag>{String(value)}</Tag> : '—'),
    },
    {
      title: t('label.status'),
      dataIndex: 'status',
      render: (status) => {
        const controlStatus = status as FrameworkCoverageEntry['status'];

        return <Tag color={STATUS_TONE[controlStatus]}>{controlStatus}</Tag>;
      },
    },
    {
      title: t('label.assets-affected'),
      dataIndex: 'affectedAssetCount',
      width: 160,
    },
    {
      title: t('label.evidence'),
      dataIndex: 'evidenceCount',
      width: 130,
    },
  ];

  return (
    <div className="tw:p-6">
      <Breadcrumb
        items={[
          {
            title: (
              <Link to={ROUTES.AI_GOVERNANCE}>{t('label.ai-governance')}</Link>
            ),
          },
          {
            title: (
              <Link
                to={ROUTES.AI_GOVERNANCE_WITH_TAB.replace(
                  PLACEHOLDER_ROUTE_TAB,
                  AIGovernanceTab.FRAMEWORKS
                )}>
                {t('label.framework-plural')}
              </Link>
            ),
          },
          { title: framework.displayName ?? framework.name },
        ]}
      />

      <Card className="tw:mt-4">
        <Space className="tw:w-full" direction="vertical" size="middle">
          <Space align="start" className="tw:w-full tw:justify-between">
            <Space direction="vertical" size={0}>
              <Typography.Title className="tw:m-0" level={3}>
                {framework.displayName ?? framework.name}
              </Typography.Title>
              {framework.reference && (
                <Typography.Text className="tw:font-mono" type="secondary">
                  {framework.reference} · {framework.region ?? '—'}
                </Typography.Text>
              )}
            </Space>
            <Space>
              {framework.source && (
                <Tag color={framework.source === 'BuiltIn' ? 'blue' : 'purple'}>
                  {framework.source}
                </Tag>
              )}
              {framework.enabled ? (
                <Tag color="green">{t('label.enabled')}</Tag>
              ) : (
                <Tag>{t('label.disabled')}</Tag>
              )}
            </Space>
          </Space>
          <Row gutter={[16, 16]}>
            <Col md={6} sm={12} xs={24}>
              <Statistic
                title={t('label.coverage')}
                value={
                  total === 0 ? '0%' : `${Math.round((met / total) * 100)}%`
                }
              />
            </Col>
            <Col md={6} sm={12} xs={24}>
              <Statistic
                title={t('label.controls-met')}
                value={`${met} / ${total}`}
              />
            </Col>
            <Col md={6} sm={12} xs={24}>
              <Statistic
                title={t('label.assets-in-scope')}
                value={inScopeAssets}
              />
            </Col>
            <Col md={6} sm={12} xs={24}>
              <Statistic
                title={t('label.assessment-cadence')}
                value={framework.assessmentCadence ?? '—'}
              />
            </Col>
          </Row>
        </Space>
      </Card>

      <Card className="tw:mt-4" title={t('label.controls-library')}>
        <Table<FrameworkCoverageEntry>
          columns={columns}
          dataSource={controls}
          locale={{
            emptyText: t('label.no-entity', {
              entity: t('label.control-plural'),
            }),
          }}
          pagination={false}
          rowKey="code"
        />
      </Card>
    </div>
  );
};

export default withPageLayout(FrameworkDetailPage);
