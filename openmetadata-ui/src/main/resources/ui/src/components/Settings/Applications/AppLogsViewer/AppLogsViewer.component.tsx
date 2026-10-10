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

import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import type { BadgeColors } from '@openmetadata/ui-core-components';
import { capitalize, isEmpty, toString } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STATUS_ICON } from '../../../../constants/constants';
import { StepStats } from '../../../../generated/entity/applications/appRunRecord';
import {
  formatLatencyAverage,
  formatThroughput,
  getAppRunFailureLogs,
  getEntityStatsData,
} from '../../../../utils/ApplicationUtils';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { formatDateTimeWithTimezone } from '../../../../utils/date-time/DateTimeUtils';
import AppBadge from '../../../common/Badge/Badge.component';
import LogViewerModal from '../../../common/LogViewerModal/LogViewerModal.component';
import Table from '../../../common/Table/TableV2';
import './app-logs-viewer.less';
import {
  AppLogsViewerProps,
  ServerStats,
  ServerStatsData,
} from './AppLogsViewer.interface';
import ReindexFailures from './ReindexFailures.component';

const StatItem = ({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: ReactNode;
}) => (
  <Box align="center" direction="row" gap={1}>
    <Typography className="tw:text-tertiary" size="text-sm">
      {`${label}:`}
    </Typography>
    <Box align="center" data-testid={testId} direction="row" gap={2}>
      {children}
    </Box>
  </Box>
);

const CountBadge = ({
  color,
  count,
  title,
}: {
  color: BadgeColors;
  count?: number;
  title: string;
}) => (
  <Badge color={color} size="sm" tooltip={title} type="pill-color">
    {count ?? 0}
  </Badge>
);

const AppLogsViewer = ({ data }: AppLogsViewerProps) => {
  const { t } = useTranslation();
  const [showFailuresDrawer, setShowFailuresDrawer] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);

  const {
    successContext,
    failureContext,
    timestamp,
    status,
    startTime,
    endTime,
  } = data;

  const hasFailures = useMemo(() => {
    const jobStats =
      successContext?.stats?.jobStats ?? failureContext?.stats?.jobStats;

    return (jobStats?.failedRecords ?? 0) > 0;
  }, [successContext, failureContext]);

  // Wall-clock duration of the run, used as the rate basis on the overall
  // stats card. Stage cards keep using stepStats.totalTimeMs (stage-CPU time)
  // so engineers can still see per-stage cost. The overall card answers the
  // operator question "how fast is reindex actually going?" — which is
  // successRecords / wall_clock, not the inflated stage-CPU rate that sums
  // parallel worker time. For in-flight runs (no endTime yet) we tick a
  // local `now` state every 5s so the rate moves with the job; React's
  // dependency rules require the bumping value to be a state, not Date.now()
  // captured inside useMemo.
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!startTime || endTime) {
      return undefined;
    }
    const id = setInterval(() => setNow(Date.now()), 5000);

    return () => clearInterval(id);
  }, [startTime, endTime]);

  const wallClockMs = useMemo<number | undefined>(() => {
    if (!startTime) {
      return undefined;
    }
    const end = endTime ?? now;

    return Math.max(0, end - startTime);
  }, [startTime, endTime, now]);

  const failureLogs = useMemo(() => getAppRunFailureLogs(data), [data]);

  const statsRender = useCallback(
    (
      stepStats: StepStats,
      title?: string,
      options: {
        showStatus?: boolean;
        effectiveTimeMs?: number;
        latencyLabelKey?: string;
      } = {}
    ) => {
      const { showStatus = true, effectiveTimeMs, latencyLabelKey } = options;
      const StatusIcon = STATUS_ICON[status as keyof typeof STATUS_ICON];

      return (
        <Card
          data-testid={`stats-component${
            title ? `-${title.toLowerCase()}` : ''
          }`}
          size="sm">
          {title && <Card.Header title={title} />}
          <Card.Content>
            <Grid
              className="layout-row layout-grid"
              style={{ ...getLayoutGutter(16, 8) }}>
              <Grid.Item className="layout-column" span={24}>
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal"
                  gap={0}
                  itemClassName="layout-space-item"
                  wrap="wrap">
                  {showStatus && (
                    <>
                      <StatItem label={t('label.status')}>
                        {StatusIcon && <StatusIcon height={14} width={14} />}
                        <Typography size="text-sm">
                          {capitalize(status)}
                        </Typography>
                      </StatItem>
                      <Divider
                        className="tw:mx-2 tw:h-[0.9em] tw:self-center"
                        orientation="vertical"
                      />
                    </>
                  )}
                  <StatItem label={t('label.index-states')}>
                    <CountBadge
                      color="blue"
                      count={stepStats.totalRecords}
                      title={`${t('label.total-index-sent')}: ${
                        stepStats.totalRecords
                      }`}
                    />

                    <CountBadge
                      color="success"
                      count={stepStats.successRecords}
                      title={`${t('label.entity-index', {
                        entity: t('label.success'),
                      })}: ${stepStats.successRecords}`}
                    />

                    <CountBadge
                      color="error"
                      count={stepStats.failedRecords}
                      title={`${t('label.entity-index', {
                        entity: t('label.failed'),
                      })}: ${stepStats.failedRecords}`}
                    />

                    {stepStats.warningRecords !== undefined &&
                      stepStats.warningRecords > 0 && (
                        <CountBadge
                          color="warning"
                          count={stepStats.warningRecords}
                          title={`${t('label.entity-index', {
                            entity: t('label.warning-plural'),
                          })}: ${stepStats.warningRecords}`}
                        />
                      )}
                  </StatItem>
                  {(() => {
                    // effectiveTimeMs (e.g. wall-clock for the overall card) takes
                    // precedence over stepStats.totalTimeMs (stage-CPU time). This
                    // is also what avoids the misleading ">85k r/s" the overall
                    // card would otherwise show when jobStats.totalTimeMs is 0
                    // because stage timings aren't aggregated up to the job level.
                    const timeMs = effectiveTimeMs ?? stepStats.totalTimeMs;
                    if (
                      timeMs === undefined ||
                      stepStats.successRecords === undefined ||
                      stepStats.successRecords <= 0
                    ) {
                      return null;
                    }

                    return (
                      <>
                        <Divider
                          className="tw:mx-2 tw:h-[0.9em] tw:self-center"
                          orientation="vertical"
                        />
                        <StatItem
                          label={t(latencyLabelKey ?? 'label.latency')}
                          testId="stage-latency">
                          <Typography size="text-sm">
                            {`${formatLatencyAverage(
                              timeMs,
                              stepStats.successRecords
                            )} · ${formatThroughput(
                              timeMs,
                              stepStats.successRecords
                            )}`}
                          </Typography>
                        </StatItem>
                      </>
                    );
                  })()}
                  {showStatus && (
                    <>
                      <Divider
                        className="tw:mx-2 tw:h-[0.9em] tw:self-center"
                        orientation="vertical"
                      />
                      <StatItem label={t('label.last-updated')}>
                        <Typography size="text-sm">
                          {timestamp
                            ? formatDateTimeWithTimezone(timestamp)
                            : '--'}
                        </Typography>
                      </StatItem>
                    </>
                  )}
                </Box>
              </Grid.Item>
            </Grid>
          </Card.Content>
        </Card>
      );
    },
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
              <Box align="center" direction="row" gap={2}>
                <Typography>
                  {t('label.entity-record-plural', {
                    entity: t('label.total'),
                  })}{' '}
                </Typography>
                <AppBadge
                  className="entity-stats total m-l-sm"
                  label={entityTotalJobStatsData.totalRecords}
                />
              </Box>
            ),
            dataIndex: 'totalRecords',
            key: 'totalRecords',
            render: (text: string) => (
              <Typography className="text-primary">{text}</Typography>
            ),
          },
          {
            title: (
              <Box align="center" direction="row" gap={2}>
                <Typography>
                  {t('label.entity-record-plural', {
                    entity: t('label.success'),
                  })}{' '}
                </Typography>
                <AppBadge
                  className="entity-stats success m-l-sm"
                  label={entityTotalJobStatsData.successRecords}
                />
              </Box>
            ),
            dataIndex: 'successRecords',
            key: 'successRecords',
            render: (text: string) => (
              <Typography className="text-success">{text}</Typography>
            ),
          },
          {
            title: (
              <Box align="center" direction="row" gap={2}>
                <Typography>
                  {t('label.entity-record-plural', {
                    entity: t('label.failed'),
                  })}{' '}
                </Typography>
                <AppBadge
                  className="entity-stats failure m-l-sm"
                  label={entityTotalJobStatsData.failedRecords}
                />
              </Box>
            ),
            dataIndex: 'failedRecords',
            key: 'failedRecords',
            render: (text: string) => (
              <Typography className="text-failure tw:text-primary">
                {text}
              </Typography>
            ),
          },
          ...(successContext?.stats?.vectorStats?.totalRecords
            ? [
                {
                  title: t('label.vector-embedding-plural'),
                  dataIndex: 'vectorEmbeddings',
                  key: 'vectorEmbeddings',
                  render: (value: number | null) => (
                    <Typography
                      className={value !== null ? 'text-primary' : ''}>
                      {value !== null ? value : '-'}
                    </Typography>
                  ),
                },
              ]
            : []),
          {
            title: t('label.reader-avg'),
            dataIndex: 'readerAvgMs',
            key: 'readerAvgMs',
            render: (value: string) => (
              <Typography
                className="tw:text-primary"
                data-testid="entity-reader-avg">
                {value}
              </Typography>
            ),
          },
          {
            title: t('label.process-avg'),
            dataIndex: 'processAvgMs',
            key: 'processAvgMs',
            render: (value: string) => (
              <Typography
                className="tw:text-primary"
                data-testid="entity-process-avg">
                {value}
              </Typography>
            ),
          },
          {
            title: t('label.sink-avg'),
            dataIndex: 'sinkAvgMs',
            key: 'sinkAvgMs',
            render: (value: string) => (
              <Typography
                className="tw:text-primary"
                data-testid="entity-sink-avg">
                {value}
              </Typography>
            ),
          },
          ...(successContext?.stats?.vectorStats?.totalRecords
            ? [
                {
                  title: t('label.vector-avg'),
                  dataIndex: 'vectorAvgMs',
                  key: 'vectorAvgMs',
                  render: (value: string) => (
                    <Typography
                      className="tw:text-primary"
                      data-testid="entity-vector-avg">
                      {value}
                    </Typography>
                  ),
                },
              ]
            : []),
        ];
  }, [successContext, failureContext]);

  const entityStatsRenderer = useCallback(
    (entityStats: { [key: string]: StepStats }) => {
      return (
        <Table
          columns={tableColumn}
          containerClassName="tw:mt-4"
          data-testid="app-entity-stats-history-table"
          dataSource={getEntityStatsData(entityStats)}
          pagination={false}
          rowKey="name"
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
          <Typography className="font-medium tw:text-primary">
            {text}
          </Typography>
        ),
      },
      {
        title: (
          <Box align="center" direction="row" gap={2}>
            <Typography>
              {t('label.entity-record-plural', {
                entity: t('label.processed'),
              })}{' '}
            </Typography>
            <AppBadge
              className="entity-stats total m-l-sm"
              label={toString(totalProcessed)}
            />
          </Box>
        ),
        dataIndex: 'processedRecords',
        key: 'processedRecords',
        render: (text: number) => (
          <Typography className="text-primary">{text}</Typography>
        ),
      },
      {
        title: (
          <Box align="center" direction="row" gap={2}>
            <Typography>
              {t('label.entity-record-plural', {
                entity: t('label.success'),
              })}{' '}
            </Typography>
            <AppBadge
              className="entity-stats success m-l-sm"
              label={toString(totalSuccess)}
            />
          </Box>
        ),
        dataIndex: 'successRecords',
        key: 'successRecords',
        render: (text: number) => (
          <Typography className="text-success">{text}</Typography>
        ),
      },
      {
        title: (
          <Box align="center" direction="row" gap={2}>
            <Typography>
              {t('label.entity-record-plural', {
                entity: t('label.failed'),
              })}{' '}
            </Typography>
            <AppBadge
              className="entity-stats failure m-l-sm"
              label={toString(totalFailed)}
            />
          </Box>
        ),
        dataIndex: 'failedRecords',
        key: 'failedRecords',
        render: (text: number) => (
          <Typography className="text-failure tw:text-primary">
            {text}
          </Typography>
        ),
      },
      {
        title: t('label.partition-plural'),
        dataIndex: 'partitions',
        key: 'partitions',
        render: (text: string) => (
          <Typography className="tw:text-primary">{text}</Typography>
        ),
      },
    ];
  }, [serverStatsData]);

  const serverStatsRenderer = useCallback(() => {
    if (serverStatsData.length === 0) {
      return null;
    }

    const serverCount = successContext?.serverCount as number | undefined;

    return (
      <Card className="tw:mt-4" data-testid="server-stats-card" size="sm">
        <Card.Header
          title={
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal"
              gap={2}
              itemClassName="layout-space-item">
              <Typography size="text-sm" weight="semibold">
                {t('label.server-stat-plural')}
              </Typography>
              {serverCount && (
                <CountBadge
                  color="blue"
                  count={serverCount}
                  title={`${serverCount} ${t('label.server')}(s)`}
                />
              )}
            </Box>
          }
        />
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

  const renderOverallStats = (jobStats?: StepStats) =>
    jobStats
      ? statsRender(jobStats, t('label.overall-stat-plural'), {
          effectiveTimeMs: wallClockMs,
          latencyLabelKey: 'label.wall-clock',
        })
      : null;

  const renderStatCol = (stats: StepStats | undefined, labelKey: string) =>
    stats ? (
      <Grid.Item className="layout-column" span={6}>
        {statsRender(stats, t(labelKey), {
          showStatus: false,
        })}
      </Grid.Item>
    ) : null;

  const renderEntityStats = (entityStats?: { [key: string]: StepStats }) =>
    entityStats ? entityStatsRenderer(entityStats) : null;

  return (
    <>
      {renderOverallStats(successContext?.stats?.jobStats)}
      {renderOverallStats(failureContext?.stats?.jobStats)}

      <Grid
        className="layout-row layout-grid m-t-md"
        style={getLayoutGutter(16, 16)}>
        {renderStatCol(
          successContext?.stats?.readerStats,
          'label.reader-stat-plural'
        )}
        {renderStatCol(
          failureContext?.stats?.readerStats,
          'label.reader-stat-plural'
        )}

        {renderStatCol(
          successContext?.stats?.processStats,
          'label.process-stat-plural'
        )}
        {renderStatCol(
          failureContext?.stats?.processStats,
          'label.process-stat-plural'
        )}

        {renderStatCol(
          successContext?.stats?.sinkStats,
          'label.sink-stat-plural'
        )}
        {renderStatCol(
          failureContext?.stats?.sinkStats,
          'label.sink-stat-plural'
        )}

        {renderStatCol(
          successContext?.stats?.vectorStats,
          'label.vector-stat-plural'
        )}
        {renderStatCol(
          failureContext?.stats?.vectorStats,
          'label.vector-stat-plural'
        )}
      </Grid>

      {serverStatsRenderer()}

      {renderEntityStats(successContext?.stats?.entityStats)}
      {renderEntityStats(failureContext?.stats?.entityStats)}

      {failureLogs && (
        <Box className="tw:mt-4">
          <Button
            color="link-color"
            data-testid="view-logs-button"
            onPress={() => setShowLogsModal(true)}>
            {t('label.view-entity', { entity: t('label.log-plural') })}
          </Button>
        </Box>
      )}

      {hasFailures && (
        <Box className="tw:mt-4">
          <Button
            color="link-color"
            data-testid="view-reindex-failures-button"
            onPress={() => setShowFailuresDrawer(true)}>
            {t('label.view-reindex-failure-plural')}
          </Button>
        </Box>
      )}

      <ReindexFailures
        appName={data.appName}
        visible={showFailuresDrawer}
        onClose={() => setShowFailuresDrawer(false)}
      />

      <LogViewerModal
        logs={failureLogs}
        open={showLogsModal}
        title={t('label.log-plural')}
        onClose={() => setShowLogsModal(false)}
      />
    </>
  );
};

export default AppLogsViewer;
