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
import {
  Alert,
  Badge,
  Box,
  Card,
  EmptyPlaceholder,
  ProgressBar,
  ProgressBarCircle,
  Skeleton,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle, Beaker01, Database01 } from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AssetRollup,
  DimensionRollup,
  Health,
  StatusCounts,
  TestResult,
} from '../../../generated/api/data/metricObservability';
import { Metric } from '../../../generated/entity/data/metric';
import { useMetricObservability } from '../../../hooks/useMetricObservability';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import MetricHealthPill from './MetricHealthPill.component';
import {
  getMetricDimensionLabelKey,
  getMetricIncidentSeverityLabel,
  getMetricObservabilityReasonLabelKey,
  getMetricResultBadgeColor,
  getMetricResultLabelKey,
  isMetricObservabilityPermissionError,
  isRedactedMetricAsset,
} from './MetricObservability.utils';

export interface MetricObservabilityTabProps {
  metric: Metric;
}

const SummaryTile = ({ label, value }: { label: string; value: number }) => (
  <Card size="sm">
    <Card.Content>
      <Typography className="tw:text-tertiary" size="text-xs">
        {label}
      </Typography>
      <Typography
        className="tw:tabular-nums"
        size="display-xs"
        weight="semibold">
        {value}
      </Typography>
    </Card.Content>
  </Card>
);

const MetricObservabilityLoading = ({ label }: { label: string }) => (
  <Box
    aria-label={label}
    className="tw:flex tw:flex-col tw:gap-4 tw:px-4 tw:py-6 tw:md:px-8"
    data-testid="metric-observability-loading"
    role="status">
    <Skeleton height={220} variant="rounded" />
    <Box className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton height={90} key={index} variant="rounded" />
      ))}
    </Box>
    <Skeleton height={280} variant="rounded" />
  </Box>
);

const MetricObservabilityTab: FC<MetricObservabilityTabProps> = ({
  metric,
}) => {
  const { t } = useTranslation();
  const query = useMetricObservability(metric.id);
  const observability = query.observability;
  const rollupByAssetId = useMemo(
    () =>
      new Map<string, AssetRollup>(
        (observability?.assets ?? []).map((asset) => [asset.asset.id, asset])
      ),
    [observability?.assets]
  );
  const sourceRollups = observability?.assets ?? [];
  const sourceCoverage = observability?.sourceCoverage;
  const hasRedactedAssets =
    (sourceCoverage?.restrictedTables ?? 0) > 0 ||
    sourceRollups.some(
      ({ asset, redacted }) => redacted || isRedactedMetricAsset(asset)
    );
  const hasPartialCoverage =
    observability?.partial === true ||
    sourceCoverage?.partial === true ||
    (sourceCoverage?.restrictedTables ?? 0) > 0;

  if (query.isPending) {
    return <MetricObservabilityLoading label={t('label.loading')} />;
  }

  if (query.error) {
    const isPermissionError = isMetricObservabilityPermissionError(query.error);

    return (
      <Box
        className="tw:relative tw:min-h-80 tw:px-4 tw:py-6 tw:md:px-8"
        data-testid="metric-observability-error">
        <EmptyPlaceholder
          actions={
            isPermissionError
              ? undefined
              : [
                  {
                    key: 'retry',
                    label: t('label.try-again'),
                    onClick: () => query.refetch(),
                  },
                ]
          }
          description={
            isPermissionError
              ? t('message.no-permission-to-view')
              : t('message.temporary-error-try-reloading')
          }
          title={
            isPermissionError ? t('label.access-denied') : t('label.error')
          }
        />
      </Box>
    );
  }

  if (!observability) {
    return (
      <Box
        className="tw:relative tw:min-h-80 tw:px-4 tw:py-6 tw:md:px-8"
        data-testid="metric-observability-empty">
        <EmptyPlaceholder
          description={t('message.only-upstream-assets-scored')}
          title={t('label.no-data-found')}
        />
      </Box>
    );
  }

  const health = observability.health ?? Health.Unknown;
  const dimensions = observability.dimensions ?? [];
  const visibleSourceIds = new Set(
    sourceRollups
      .filter(
        ({ asset, redacted }) => !redacted && !isRedactedMetricAsset(asset)
      )
      .map(({ asset }) => asset.id)
  );
  const restrictDetails = hasPartialCoverage || hasRedactedAssets;
  const tests = (observability.tests ?? []).filter(
    (test) =>
      !restrictDetails ||
      (Boolean(test.asset) && visibleSourceIds.has(test.asset?.id ?? ''))
  );
  const incidents = (observability.incidents ?? []).filter(
    (incident) =>
      !restrictDetails ||
      (Boolean(incident.asset) &&
        visibleSourceIds.has(incident.asset?.id ?? ''))
  );
  const statusCounts: StatusCounts = observability.statusCounts ?? {
    aborted: 0,
    failed: 0,
    missing: 0,
    passed: 0,
    queued: 0,
    terminal: tests.length,
  };
  const reasonLabelKey = getMetricObservabilityReasonLabelKey(
    observability.reasonCode
  );
  const healthLabel =
    health === Health.Healthy
      ? t('label.healthy')
      : health === Health.AtRisk
      ? t('label.at-risk')
      : health === Health.Degraded
      ? t('label.degraded')
      : t('label.unknown');

  return (
    <Box
      aria-busy={query.isFetching}
      className="tw:flex tw:flex-col tw:gap-4 tw:px-4 tw:py-6 tw:md:px-8"
      data-testid="metric-observability-tab">
      {hasRedactedAssets && (
        <Alert
          data-testid="metric-observability-redacted"
          title={t('label.access-denied')}
          variant="warning"
        />
      )}
      {hasPartialCoverage && (
        <Alert
          data-testid="metric-observability-partial"
          title={t('label.partial-coverage')}
          variant="brand">
          {sourceCoverage?.restrictedTables ?? 0}/
          {sourceCoverage?.upstreamTables ??
            observability.upstreamAssetCount ??
            0}{' '}
          {t('label.source-plural')}
        </Alert>
      )}

      <Card data-testid="metric-health-summary">
        <Card.Content className="tw:grid tw:grid-cols-1 tw:items-center tw:gap-6 tw:md:grid-cols-[220px_1fr]">
          <Box align="center" direction="col" gap={3}>
            {observability.score === undefined ? (
              <Box
                align="center"
                className="tw:size-24 tw:justify-center tw:rounded-full tw:border-8 tw:border-secondary"
                data-testid="metric-health-score-unknown">
                <Typography size="text-sm" weight="semibold">
                  {t('label.unknown')}
                </Typography>
              </Box>
            ) : (
              <Box
                aria-label={t('label.health')}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={observability.score}
                role="progressbar">
                <span aria-hidden="true">
                  <ProgressBarCircle
                    label={t('label.health')}
                    size="xs"
                    value={observability.score}
                  />
                </span>
              </Box>
            )}
            <MetricHealthPill health={health} score={observability.score} />
          </Box>
          <Box direction="col" gap={2}>
            <Typography size="text-lg" weight="semibold">
              {t('label.summary')}
            </Typography>
            <Typography
              className="tw:text-tertiary"
              data-testid="metric-rollup-reason"
              size="text-sm">
              {observability.score !== undefined
                ? t('message.metric-observability-score-explanation', {
                    aborted: statusCounts.aborted,
                    failed: statusCounts.failed,
                    health: healthLabel,
                    passed: statusCounts.passed,
                    score: Math.round(observability.score),
                  })
                : reasonLabelKey
                ? t(reasonLabelKey)
                : observability.rollupReason ??
                  t('message.metric-health-unavailable')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.last-run')}:{' '}
              {observability.latestRunTime
                ? formatDateTime(observability.latestRunTime)
                : t('label.unknown')}
            </Typography>
            <Typography
              className="tw:text-tertiary"
              data-testid="metric-observability-evaluated-at"
              size="text-xs">
              {t('label.updated-at')}:{' '}
              {observability.evaluatedAt
                ? formatDateTime(observability.evaluatedAt)
                : t('label.unknown')}
            </Typography>
          </Box>
        </Card.Content>
      </Card>

      <Box
        className="tw:grid tw:grid-cols-2 tw:gap-3 tw:md:grid-cols-3 tw:xl:grid-cols-5"
        data-testid="metric-global-status-counts">
        <SummaryTile label={t('label.passed')} value={statusCounts.passed} />
        <SummaryTile label={t('label.failed')} value={statusCounts.failed} />
        <SummaryTile label={t('label.aborted')} value={statusCounts.aborted} />
        <SummaryTile label={t('label.queued')} value={statusCounts.queued} />
        <SummaryTile label={t('label.missing')} value={statusCounts.missing} />
      </Box>

      {sourceCoverage && (
        <Card data-testid="metric-source-coverage">
          <Card.Header
            title={t('label.entity-coverage', {
              entity: t('label.source-plural'),
            })}
          />
          <Card.Content className="tw:flex tw:flex-col tw:gap-3">
            <Box align="center" gap={3} justify="between">
              <Typography size="text-sm" weight="medium">
                {sourceCoverage.testedTables}/{sourceCoverage.upstreamTables}{' '}
                {t('label.source-plural')}
              </Typography>
              <Typography className="tw:tabular-nums" size="text-sm">
                {Math.round(sourceCoverage.coveragePercent)}%
              </Typography>
            </Box>
            <ProgressBar value={sourceCoverage.coveragePercent} />
            <Typography className="tw:text-tertiary" size="text-xs">
              {sourceCoverage.visibleTables} {t('label.visible-result-plural')}{' '}
              · {sourceCoverage.restrictedTables} {t('label.access-denied')}
            </Typography>
          </Card.Content>
        </Card>
      )}

      <Card data-testid="metric-asset-rollups">
        <Card.Header
          title={t('label.data-health-by-entity', {
            entity: t('label.asset-plural'),
          })}
        />
        <Card.Content className="tw:relative tw:flex tw:min-h-48 tw:flex-col tw:gap-4">
          {sourceRollups.length === 0 ? (
            <EmptyPlaceholder
              description={
                hasRedactedAssets
                  ? t('message.no-permission-to-view')
                  : t('message.no-data-available')
              }
              title={t('label.no-data-found')}
            />
          ) : (
            sourceRollups.map((sourceRollup) => {
              const asset = sourceRollup.asset;
              const assetRollup = rollupByAssetId.get(asset.id) ?? sourceRollup;
              const isRedacted =
                sourceRollup.redacted || isRedactedMetricAsset(asset);

              return (
                <Box direction="col" gap={2} key={asset.id}>
                  <Box align="center" gap={2} justify="between">
                    <Box align="center" className="tw:min-w-0" gap={2}>
                      <Database01
                        aria-hidden="true"
                        className="tw:shrink-0 tw:text-fg-quaternary"
                        size={18}
                      />
                      <Typography ellipsis size="text-sm" weight="medium">
                        {isRedacted
                          ? t('label.access-denied')
                          : getEntityName(asset)}
                      </Typography>
                    </Box>
                    <MetricHealthPill
                      data-testid={`metric-rollup-health-${asset.id}`}
                      health={assetRollup?.health ?? Health.Unknown}
                      score={assetRollup?.score}
                    />
                  </Box>
                  {assetRollup.score === undefined ? (
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {t(
                        'message.metric-observability-reason-no-terminal-results'
                      )}
                    </Typography>
                  ) : (
                    <ProgressBar
                      labelPosition="right"
                      value={assetRollup.score}
                    />
                  )}
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {t('label.passed')}: {assetRollup.passed ?? 0} ·{' '}
                    {t('label.failed')}: {assetRollup.failed ?? 0} ·{' '}
                    {t('label.aborted')}: {assetRollup.aborted ?? 0}
                  </Typography>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {t('label.last-run')}:{' '}
                    {assetRollup.latestRunTime
                      ? formatDateTime(assetRollup.latestRunTime)
                      : t('label.unknown')}
                  </Typography>
                </Box>
              );
            })
          )}
        </Card.Content>
      </Card>

      <Card data-testid="metric-dimension-rollup">
        <Card.Header
          title={t('label.entity-distribution', {
            entity: t('label.dimension'),
          })}
        />
        <Card.Content className="tw:relative tw:min-h-40">
          {dimensions.length === 0 ? (
            <EmptyPlaceholder
              description={t('message.no-data-available')}
              title={t('label.no-data-found')}
            />
          ) : (
            <Box className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:xl:grid-cols-3">
              {dimensions.map((dimension: DimensionRollup) => {
                const labelKey = getMetricDimensionLabelKey(
                  dimension.dimension
                );

                return (
                  <Card
                    data-testid={`metric-dimension-${dimension.dimension}`}
                    key={dimension.dimension}
                    size="sm">
                    <Card.Content className="tw:flex tw:flex-col tw:gap-3">
                      <Box align="center" gap={2} justify="between">
                        <Typography size="text-sm" weight="semibold">
                          {labelKey ? t(labelKey) : dimension.dimension}
                        </Typography>
                        <Typography
                          className="tw:tabular-nums"
                          size="text-sm"
                          weight="semibold">
                          {Math.round(dimension.score)}%
                        </Typography>
                      </Box>
                      <ProgressBar value={dimension.score} />
                      <Typography className="tw:text-tertiary" size="text-xs">
                        {dimension.passed}/{dimension.total} {t('label.passed')}
                      </Typography>
                    </Card.Content>
                  </Card>
                );
              })}
            </Box>
          )}
        </Card.Content>
      </Card>

      <Card data-testid="metric-tests">
        <Card.Header
          extra={
            <Badge color="gray" size="sm">
              {tests.length}
            </Badge>
          }
          title={t('label.test-case-plural')}
        />
        <Card.Content className="tw:relative tw:min-h-40 tw:p-0">
          {tests.length === 0 ? (
            <EmptyPlaceholder
              description={t('message.no-data-available')}
              title={t('label.no-data-found')}
            />
          ) : (
            <Table aria-label={t('label.test-case-plural')} size="sm">
              <Table.Header>
                <Table.Head isRowHeader id="test" label={t('label.test')} />
                <Table.Head id="asset" label={t('label.asset')} />
                <Table.Head id="dimension" label={t('label.dimension')} />
                <Table.Head id="status" label={t('label.status')} />
                <Table.Head id="lastRun" label={t('label.last-run')} />
              </Table.Header>
              <Table.Body items={tests}>
                {(test: TestResult) => {
                  const dimensionLabelKey = test.dimension
                    ? getMetricDimensionLabelKey(test.dimension)
                    : undefined;

                  return (
                    <Table.Row id={test.testCase.id}>
                      <Table.Cell>{getEntityName(test.testCase)}</Table.Cell>
                      <Table.Cell>
                        {test.asset
                          ? getEntityName(test.asset)
                          : t('label.access-denied')}
                      </Table.Cell>
                      <Table.Cell>
                        {dimensionLabelKey
                          ? t(dimensionLabelKey)
                          : test.dimension ?? t('label.no-dimension')}
                      </Table.Cell>
                      <Table.Cell>
                        <Badge
                          color={getMetricResultBadgeColor(test.status)}
                          size="sm">
                          {t(
                            getMetricResultLabelKey(test.status) ??
                              'label.unknown'
                          )}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        {test.timestamp
                          ? formatDateTime(test.timestamp)
                          : t('label.unknown')}
                      </Table.Cell>
                    </Table.Row>
                  );
                }}
              </Table.Body>
            </Table>
          )}
        </Card.Content>
      </Card>

      <Card data-testid="metric-incidents">
        <Card.Header
          extra={
            <Badge color="gray" size="sm">
              {incidents.length}
            </Badge>
          }
          title={t('label.incident-plural')}
        />
        <Card.Content className="tw:relative tw:min-h-40">
          {incidents.length === 0 ? (
            <EmptyPlaceholder
              description={t('message.no-metric-incidents')}
              icon={AlertCircle}
              title={t('label.no-data-found')}
            />
          ) : (
            <ul className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary">
              {incidents.map((incident, index) => (
                <li
                  className="tw:flex tw:items-start tw:gap-3 tw:py-3"
                  key={incident.id ?? `${incident.testCase.id}-${index}`}>
                  <Box
                    align="center"
                    className="tw:size-9 tw:shrink-0 tw:justify-center tw:rounded-lg tw:bg-utility-error-50 tw:text-fg-error-primary">
                    <Beaker01 aria-hidden="true" size={18} />
                  </Box>
                  <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
                    <Typography size="text-sm" weight="semibold">
                      {getEntityName(incident.testCase)}
                    </Typography>
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {incident.asset
                        ? getEntityName(incident.asset)
                        : t('label.access-denied')}
                    </Typography>
                    <Box align="center" className="tw:flex-wrap" gap={2}>
                      <Badge color="error" size="xs">
                        {t(
                          getMetricResultLabelKey(incident.status) ??
                            'label.unknown'
                        )}
                      </Badge>
                      {incident.severity && (
                        <Badge color="warning" size="xs">
                          {getMetricIncidentSeverityLabel(t, incident.severity)}
                        </Badge>
                      )}
                      <Typography className="tw:text-tertiary" size="text-xs">
                        {incident.timestamp
                          ? formatDateTime(incident.timestamp)
                          : t('label.unknown')}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>
    </Box>
  );
};

export default MetricObservabilityTab;
