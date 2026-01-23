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

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Modal, Row, Table, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  cleanOrphanIndexes,
  getSearchStats,
  IndexStats,
  OrphanIndex,
  SearchStatsResponse,
} from '../../rest/searchAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './search-insights.less';

const SearchInsightsPage = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<SearchStatsResponse | null>(null);
  const [isCleaningOrphans, setIsCleaningOrphans] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.search-insights')
      ),
    [t]
  );

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSearchStats();
      setStats(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCleanOrphans = useCallback(async () => {
    try {
      setIsCleaningOrphans(true);
      const result = await cleanOrphanIndexes();
      showSuccessToast(
        t('message.orphan-indexes-deleted-successfully', {
          count: result.deletedCount,
        })
      );
      setShowConfirmModal(false);
      fetchStats();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCleaningOrphans(false);
    }
  }, [fetchStats, t]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const indexColumns: ColumnsType<IndexStats> = useMemo(
    () => [
      {
        title: t('label.index-name'),
        dataIndex: 'name',
        key: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: t('label.document-plural'),
        dataIndex: 'documents',
        key: 'documents',
        sorter: (a, b) => a.documents - b.documents,
        render: (value: number) => value.toLocaleString(),
      },
      {
        title: t('label.primary-shards'),
        dataIndex: 'primaryShards',
        key: 'primaryShards',
      },
      {
        title: t('label.replica-shards'),
        dataIndex: 'replicaShards',
        key: 'replicaShards',
      },
      {
        title: t('label.size'),
        dataIndex: 'sizeFormatted',
        key: 'size',
        sorter: (a, b) => a.sizeInBytes - b.sizeInBytes,
      },
      {
        title: t('label.health'),
        dataIndex: 'health',
        key: 'health',
        render: (health: string) => {
          const color =
            health === 'GREEN'
              ? 'success'
              : health === 'YELLOW'
              ? 'warning'
              : 'error';

          return <Tag color={color}>{health}</Tag>;
        },
      },
      {
        title: t('label.alias-plural'),
        dataIndex: 'aliases',
        key: 'aliases',
        render: (aliases: string[]) => (
          <span>{aliases.length > 0 ? aliases.join(', ') : '-'}</span>
        ),
      },
    ],
    [t]
  );

  const getHealthClass = useCallback((health: string) => {
    switch (health) {
      case 'GREEN':
        return 'health-green';
      case 'YELLOW':
        return 'health-yellow';
      default:
        return 'health-red';
    }
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      className="search-insights-page"
      mainContainerClassName="p-t-0"
      pageTitle={t('label.search-insights')}>
      <Row className="p-md settings-row m-0" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <PageHeader
              data={{
                header: t('label.search-insights'),
                subHeader: t('message.search-insights-description'),
              }}
            />
            <Button
              icon={<ReloadOutlined />}
              loading={isLoading}
              onClick={fetchStats}>
              {t('label.refresh')}
            </Button>
          </Row>
        </Col>
      </Row>

      {stats && (
        <>
          <Row className="p-md m-0" gutter={[16, 16]}>
            <Col lg={4} md={8} sm={12} xs={24}>
              <Card
                className={`stats-card ${getHealthClass(stats.clusterHealth)}`}>
                <div className="stats-card-value">
                  <Tag
                    color={
                      stats.clusterHealth === 'GREEN'
                        ? 'success'
                        : stats.clusterHealth === 'YELLOW'
                        ? 'warning'
                        : 'error'
                    }>
                    {stats.clusterHealth}
                  </Tag>
                </div>
                <div className="stats-card-label">
                  {t('label.cluster-health')}
                </div>
              </Card>
            </Col>
            <Col lg={4} md={8} sm={12} xs={24}>
              <Card className="stats-card">
                <div className="stats-card-value">{stats.totalIndexes}</div>
                <div className="stats-card-label">
                  {t('label.total-indexes')}
                </div>
              </Card>
            </Col>
            <Col lg={4} md={8} sm={12} xs={24}>
              <Card className="stats-card">
                <div className="stats-card-value">
                  {stats.totalDocuments.toLocaleString()}
                </div>
                <div className="stats-card-label">
                  {t('label.total-documents')}
                </div>
              </Card>
            </Col>
            <Col lg={4} md={8} sm={12} xs={24}>
              <Card className="stats-card">
                <div className="stats-card-value">
                  {stats.totalSizeFormatted}
                </div>
                <div className="stats-card-label">{t('label.total-size')}</div>
              </Card>
            </Col>
            <Col lg={4} md={8} sm={12} xs={24}>
              <Card className="stats-card">
                <div className="stats-card-value">
                  {stats.totalPrimaryShards + stats.totalReplicaShards}
                </div>
                <div className="stats-card-label">
                  {t('label.total-shards')}
                </div>
              </Card>
            </Col>
          </Row>

          <Row className="p-md m-0" gutter={[16, 16]}>
            <Col span={24}>
              <Typography.Title level={5}>
                {t('label.index-detail-plural')}
              </Typography.Title>
              <Table
                columns={indexColumns}
                dataSource={stats.indexes}
                pagination={{
                  defaultPageSize: 10,
                  pageSizeOptions: ['10', '20', '30', '50'],
                  showSizeChanger: true,
                }}
                rowKey="name"
                size="small"
              />
            </Col>
          </Row>

          <Row className="p-md m-0" gutter={[16, 16]}>
            <Col span={24}>
              <div
                className={`orphan-section ${
                  stats.orphanIndexes.length === 0 ? 'orphan-section-empty' : ''
                }`}>
                <Row align="middle" justify="space-between">
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {t('label.orphan-indexes')} ({stats.orphanIndexes.length})
                  </Typography.Title>
                  {stats.orphanIndexes.length > 0 && (
                    <Button
                      danger
                      loading={isCleaningOrphans}
                      type="primary"
                      onClick={() => setShowConfirmModal(true)}>
                      {t('label.clean-orphan-indexes')}
                    </Button>
                  )}
                </Row>
                {stats.orphanIndexes.length === 0 ? (
                  <Typography.Text type="secondary">
                    {t('message.no-orphan-indexes')}
                  </Typography.Text>
                ) : (
                  <Table
                    columns={[
                      {
                        title: t('label.index-name'),
                        dataIndex: 'name',
                        key: 'name',
                      },
                      {
                        title: t('label.size'),
                        dataIndex: 'sizeFormatted',
                        key: 'size',
                      },
                    ]}
                    dataSource={stats.orphanIndexes}
                    pagination={false}
                    rowKey="name"
                    size="small"
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            </Col>
          </Row>
        </>
      )}

      <Modal
        okButtonProps={{ danger: true, loading: isCleaningOrphans }}
        okText={t('label.delete')}
        open={showConfirmModal}
        title={t('label.clean-orphan-indexes')}
        onCancel={() => setShowConfirmModal(false)}
        onOk={handleCleanOrphans}>
        <Typography.Text>
          {t('message.confirm-delete-orphan-indexes', {
            count: stats?.orphanIndexes.length ?? 0,
          })}
        </Typography.Text>
        {stats && stats.orphanIndexes.length > 0 && (
          <ul style={{ marginTop: 16 }}>
            {stats.orphanIndexes.map((orphan: OrphanIndex) => (
              <li key={orphan.name}>
                {orphan.name} ({orphan.sizeFormatted})
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </PageLayoutV1>
  );
};

export default SearchInsightsPage;
