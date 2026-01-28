/*
 *  Copyright 2023 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { LazyLog } from '@melloware/react-logviewer';
import {
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Table,
  Typography,
} from 'antd';
import { capitalize, isEmpty, isNil } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ICON_DIMENSION, STATUS_ICON } from '../../../../constants/constants';
import { StepStats } from '../../../../generated/entity/applications/appRunRecord';
import { getEntityStatsData } from '../../../../utils/ApplicationUtils';
import { formatDateTimeWithTimezone } from '../../../../utils/date-time/DateTimeUtils';
import { formatJsonString } from '../../../../utils/StringsUtils';
import AppBadge from '../../../common/Badge/Badge.component';
import CopyToClipboardButton from '../../../common/CopyToClipboardButton/CopyToClipboardButton';
import './app-logs-viewer.less';
import {
  AppLogsViewerProps,
  ServerStats,
  ServerStatsData,
} from './AppLogsViewer.interface';
import ReindexFailures from './ReindexFailures.component';

const AppLogsViewer = ({ data, scrollHeight }: AppLogsViewerProps) => {
  const { t } = useTranslation();
  const [showFailuresDrawer, setShowFailuresDrawer] = useState(false);

  const { successContext, failureContext, timestamp, status } = data;

  const hasFailures = useMemo(() => {
    const jobStats =
      successContext?.stats?.jobStats ?? failureContext?.stats?.jobStats;

    return (jobStats?.failedRecords ?? 0) > 0;
  }, [successContext, failureContext]);

  const handleJumpToEnd = () => {
    const logsBody = document.getElementsByClassName(
      'ReactVirtualized__Grid'
    )[0];

    if (!isNil(logsBody)) {
      logsBody.scrollTop = logsBody.scrollHeight;
    }
  };

  const logsRender = useCallback(
    (logs: string) =>
      logs && (
        <Row className="p-t-sm">
          <Col className="d-flex justify-end" span={24}>
            <Space size="small">
              <Button
                ghost
                data-testid="jump-to-end-button"
                type="primary"
                onClick={handleJumpToEnd}>
                {t('label.jump-to-end')}
              </Button>

              <CopyToClipboardButton copyText={logs} />
            </Space>
          </Col>

          <Col
            className="p-t-md h-min-400 lazy-log-container"
            data-testid="lazy-log"
            span={24}>
            <LazyLog
              caseInsensitive
              enableSearch
              selectableLines
              extraLines={1} // 1 is to be add so that linux users can see last line of the log
              text={logs}
            />
          </Col>
        </Row>
      ),
    [handleJumpToEnd]
  );

  const statsRender = useCallback(
    (stepStats: StepStats, title?: string, showStatus = true) => (
      <Card
        data-testid={`stats-component${title ? `-${title.toLowerCase()}` : ''}`}
        size="small"
        title={title}>
        <Row gutter={[16, 8]}>
          <Col span={24}>
            <Space wrap direction="horizontal" size={0}>
              {showStatus && (
                <>
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.status'
                    )}:`}</span>

                    <Space align="center" className="m-l-xs" size={8}>
                      <Icon
                        component={
                          STATUS_ICON[status as keyof typeof STATUS_ICON]
                        }
                        style={ICON_DIMENSION}
                      />
                      <span>{capitalize(status)}</span>
                    </Space>
                  </div>
                  <Divider type="vertical" />
                </>
              )}
              <div className="flex">
                <span className="text-grey-muted">{`${t(
                  'label.index-states'
                )}:`}</span>
                <span className="m-l-xs">
                  <Space size={8}>
                    <Badge
                      showZero
                      className="request-badge running"
                      count={stepStats.totalRecords}
                      overflowCount={99999999}
                      title={`${t('label.total-index-sent')}: ${
                        stepStats.totalRecords
                      }`}
                    />

                    <Badge
                      showZero
                      className="request-badge success"
                      count={stepStats.successRecords}
                      overflowCount={99999999}
                      title={`${t('label.entity-index', {
                        entity: t('label.success'),
                      })}: ${stepStats.successRecords}`}
                    />

                    <Badge
                      showZero
                      className="request-badge failed"
                      count={stepStats.failedRecords}
                      overflowCount={99999999}
                      title={`${t('label.entity-index', {
                        entity: t('label.failed'),
                      })}: ${stepStats.failedRecords}`}
                    />

                    {stepStats.warningRecords !== undefined &&
                      stepStats.warningRecords > 0 && (
                        <Badge
                          showZero
                          className="request-badge warning"
                          count={stepStats.warningRecords}
                          overflowCount={99999999}
                          title={`${t('label.entity-index', {
                            entity: t('label.warning-plural'),
                          })}: ${stepStats.warningRecords}`}
                        />
                      )}
                  </Space>
                </span>
              </div>
              {showStatus && (
                <>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.last-updated'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {timestamp ? formatDateTimeWithTimezone(timestamp) : '--'}
                    </span>
                  </div>
                </>
              )}
            </Space>
          </Col>
        </Row>
      </Card>
    ),
    [timestamp, formatDateTimeWithTimezone, status]
  );

  const tableColumn = useMemo(() => {
    const entityTotalJobStatsData =
      successContext?.stats?.jobStats || failureContext?.stats?.jobStats;

    return isEmpty(entityTotalJobStatsData)
      ? []
      : [
          {
            title: t('label.name'),
            dataIndex: 'name',
            key: 'name',
          },
          {
            title: (
              <div className="d-flex items-center">
                <Typography.Text>
                  {t('label.entity-record-plural', {
                    entity: t('label.total'),
                  })}{' '}
                </Typography.Text>
                <AppBadge
                  className="entity-stats total m-l-sm"
                  label={entityTotalJobStatsData.totalRecords}
                />
              </div>
            ),
            dataIndex: 'totalRecords',
            key: 'totalRecords',
            render: (text: string) => (
              <Typography.Text className="text-primary">{text}</Typography.Text>
            ),
          },
          {
            title: (
              <div className="d-flex items-center">
                <Typography.Text>
                  {t('label.entity-record-plural', {
                    entity: t('label.success'),
                  })}{' '}
                </Typography.Text>
                <AppBadge
                  className="entity-stats success m-l-sm"
                  label={entityTotalJobStatsData.successRecords}
                />
              </div>
            ),
            dataIndex: 'successRecords',
            key: 'successRecords',
            render: (text: string) => (
              <Typography.Text className="text-success">{text}</Typography.Text>
            ),
          },
          {
            title: (
              <div className="d-flex items-center">
                <Typography.Text>
                  {t('label.entity-record-plural', {
                    entity: t('label.failed'),
                  })}{' '}
                </Typography.Text>
                <AppBadge
                  className="entity-stats failure m-l-sm"
                  label={entityTotalJobStatsData.failedRecords}
                />
              </div>
            ),
            dataIndex: 'failedRecords',
            key: 'failedRecords',
            render: (text: string) => (
              <Typography.Text className="text-failure">{text}</Typography.Text>
            ),
          },
        ];
  }, [successContext, failureContext]);

  const entityStatsRenderer = useCallback(
    (entityStats: { [key: string]: StepStats }) => {
      return (
        <Table
          className="m-t-md"
          columns={tableColumn}
          data-testid="app-entity-stats-history-table"
          dataSource={getEntityStatsData(entityStats)}
          pagination={false}
          rowKey="name"
          scroll={scrollHeight ? { y: scrollHeight } : undefined}
          size="small"
        />
      );
    },
    [tableColumn]
  );

  const serverStatsData = useMemo((): ServerStatsData[] => {
    const serverStats = successContext?.serverStats as
      | Record<string, ServerStats>
      | undefined;
    if (!serverStats) {
      return [];
    }

    return Object.entries(serverStats).map(([serverId, stats]) => ({
      name: serverId,
      processedRecords: stats.processedRecords ?? 0,
      successRecords: stats.successRecords ?? 0,
      failedRecords: stats.failedRecords ?? 0,
      partitions: `${stats.completedPartitions ?? 0}/${
        stats.totalPartitions ?? 0
      }`,
    }));
  }, [successContext?.serverStats]);

  const serverStatsColumns = useMemo(() => {
    if (serverStatsData.length === 0) {
      return [];
    }

    const totalProcessed = serverStatsData.reduce(
      (sum, s) => sum + s.processedRecords,
      0
    );
    const totalSuccess = serverStatsData.reduce(
      (sum, s) => sum + s.successRecords,
      0
    );
    const totalFailed = serverStatsData.reduce(
      (sum, s) => sum + s.failedRecords,
      0
    );

    return [
      {
        title: t('label.server'),
        dataIndex: 'name',
        key: 'name',
        render: (text: string) => (
          <Typography.Text className="font-medium">{text}</Typography.Text>
        ),
      },
      {
        title: (
          <div className="d-flex items-center">
            <Typography.Text>
              {t('label.entity-record-plural', {
                entity: t('label.processed'),
              })}{' '}
            </Typography.Text>
            <AppBadge
              className="entity-stats total m-l-sm"
              label={totalProcessed}
            />
          </div>
        ),
        dataIndex: 'processedRecords',
        key: 'processedRecords',
        render: (text: number) => (
          <Typography.Text className="text-primary">{text}</Typography.Text>
        ),
      },
      {
        title: (
          <div className="d-flex items-center">
            <Typography.Text>
              {t('label.entity-record-plural', {
                entity: t('label.success'),
              })}{' '}
            </Typography.Text>
            <AppBadge
              className="entity-stats success m-l-sm"
              label={totalSuccess}
            />
          </div>
        ),
        dataIndex: 'successRecords',
        key: 'successRecords',
        render: (text: number) => (
          <Typography.Text className="text-success">{text}</Typography.Text>
        ),
      },
      {
        title: (
          <div className="d-flex items-center">
            <Typography.Text>
              {t('label.entity-record-plural', {
                entity: t('label.failed'),
              })}{' '}
            </Typography.Text>
            <AppBadge
              className="entity-stats failure m-l-sm"
              label={totalFailed}
            />
          </div>
        ),
        dataIndex: 'failedRecords',
        key: 'failedRecords',
        render: (text: number) => (
          <Typography.Text className="text-failure">{text}</Typography.Text>
        ),
      },
      {
        title: t('label.partition-plural'),
        dataIndex: 'partitions',
        key: 'partitions',
        render: (text: string) => <Typography.Text>{text}</Typography.Text>,
      },
    ];
  }, [serverStatsData]);

  const serverStatsRenderer = useCallback(() => {
    if (serverStatsData.length === 0) {
      return null;
    }

    const serverCount = successContext?.serverCount as number | undefined;

    return (
      <Card
        className="m-t-md"
        data-testid="server-stats-card"
        size="small"
        title={
          <Space>
            <span>{t('label.server-stat-plural')}</span>
            {serverCount && (
              <Badge
                className="request-badge running"
                count={serverCount}
                title={`${serverCount} ${t('label.server')}(s)`}
              />
            )}
          </Space>
        }>
        <Table
          columns={serverStatsColumns}
          data-testid="server-stats-table"
          dataSource={serverStatsData}
          pagination={false}
          rowKey="name"
          size="small"
        />
      </Card>
    );
  }, [serverStatsData, serverStatsColumns, successContext?.serverCount]);

  return (
    <>
      {successContext?.stats?.jobStats &&
        statsRender(
          successContext?.stats.jobStats,
          t('label.overall-stat-plural')
        )}
      {failureContext?.stats?.jobStats &&
        statsRender(
          failureContext?.stats.jobStats,
          t('label.overall-stat-plural')
        )}

      <Row className="m-t-md" gutter={[16, 16]}>
        {successContext?.stats?.readerStats && (
          <Col span={6}>
            {statsRender(
              successContext.stats.readerStats,
              t('label.reader-stat-plural'),
              false
            )}
          </Col>
        )}
        {failureContext?.stats?.readerStats && (
          <Col span={6}>
            {statsRender(
              failureContext.stats.readerStats,
              t('label.reader-stat-plural'),
              false
            )}
          </Col>
        )}

        {successContext?.stats?.processStats && (
          <Col span={6}>
            {statsRender(
              successContext.stats.processStats,
              t('label.process-stat-plural'),
              false
            )}
          </Col>
        )}
        {failureContext?.stats?.processStats && (
          <Col span={6}>
            {statsRender(
              failureContext.stats.processStats,
              t('label.process-stat-plural'),
              false
            )}
          </Col>
        )}

        {successContext?.stats?.sinkStats && (
          <Col span={6}>
            {statsRender(
              successContext.stats.sinkStats,
              t('label.sink-stat-plural'),
              false
            )}
          </Col>
        )}
        {failureContext?.stats?.sinkStats && (
          <Col span={6}>
            {statsRender(
              failureContext.stats.sinkStats,
              t('label.sink-stat-plural'),
              false
            )}
          </Col>
        )}

        {successContext?.stats?.vectorStats && (
          <Col span={6}>
            {statsRender(
              successContext.stats.vectorStats,
              t('label.vector-stat-plural'),
              false
            )}
          </Col>
        )}
        {failureContext?.stats?.vectorStats && (
          <Col span={6}>
            {statsRender(
              failureContext.stats.vectorStats,
              t('label.vector-stat-plural'),
              false
            )}
          </Col>
        )}
      </Row>

      {serverStatsRenderer()}

      {successContext?.stats?.entityStats &&
        entityStatsRenderer(successContext.stats.entityStats)}
      {failureContext?.stats?.entityStats &&
        entityStatsRenderer(failureContext.stats.entityStats)}

      {logsRender(
        formatJsonString(
          JSON.stringify(
            failureContext?.stackTrace ?? failureContext?.failure ?? {}
          )
        )
      )}

      {hasFailures && (
        <div className="m-t-md">
          <Button
            data-testid="view-reindex-failures-button"
            type="link"
            onClick={() => setShowFailuresDrawer(true)}>
            {t('label.view-reindex-failure-plural')}
          </Button>
        </div>
      )}

      <ReindexFailures
        visible={showFailuresDrawer}
        onClose={() => setShowFailuresDrawer(false)}
      />
    </>
  );
};

export default AppLogsViewer;
