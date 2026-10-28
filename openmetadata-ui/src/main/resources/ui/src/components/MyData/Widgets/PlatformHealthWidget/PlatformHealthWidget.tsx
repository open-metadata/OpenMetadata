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

import { Button, Skeleton, Typography } from '@openmetadata/ui-core-components';
import {
  Activity,
  DataHealthScore,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HEALTH_PARAM } from '../../../../components/integration/ConnectionsPage/ConnectionsPage.constants';
import { useAddServiceAction } from '../../../../components/integration/ConnectionsPage/useAddServiceAction';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityTabs } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import connectionsRouterClassBase from '../../../../utils/ConnectionsRouterClassBase';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import BucketServiceRow from '../Common/TopicWidget/BucketServiceRow';
import FailingServiceRow from '../Common/TopicWidget/FailingServiceRow';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TOPIC_FILTERED_BODY_CLASSES } from '../Common/TopicWidget/topicRowStyles';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import TopicStatChips, {
  TopicStat,
} from '../Common/TopicWidget/TopicStatChips';
import {
  BucketService,
  FailingService,
  QuietHealthFilter,
  ServiceHealthFilter,
  useBucketServices,
  useIngestionPipelineStats,
} from './useIngestionPipelineStats';

// The card is a summary, not the full list — the footer link is the full list.
const MAX_VISIBLE_ROWS = 3;

const TONE = {
  icon: DataHealthScore,
  tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
};

interface HealthCounts {
  connectedServices: number;
  failingCount: number;
  healthyServices: number;
  pendingServices: number;
}

// Chip ids are the testids the specs reach for; the bucket is the filter the
// Connections listing reads.
const CHIP_TO_BUCKET: Record<string, ServiceHealthFilter> = {
  failing: 'failing',
  healthy: 'healthy',
  'not-run': 'notRun',
};
const BUCKET_TO_CHIP: Record<ServiceHealthFilter, string> = {
  failing: 'failing',
  healthy: 'healthy',
  notRun: 'not-run',
};

const VIEW_ALL_KEYS: Record<QuietHealthFilter, string> = {
  healthy: 'message.view-all-count-healthy-services',
  notRun: 'message.view-all-count-not-run-services',
};

const bucketSize = (
  { failingCount, healthyServices, pendingServices }: HealthCounts,
  bucket: ServiceHealthFilter
): number =>
  ({
    failing: failingCount,
    healthy: healthyServices,
    notRun: pendingServices,
  }[bucket]);

/** The card opens on the worst bucket that has anything in it. */
const getDefaultBucket = (counts: HealthCounts): ServiceHealthFilter =>
  (['failing', 'healthy', 'notRun'] as const).find(
    (bucket) => bucketSize(counts, bucket) > 0
  ) ?? 'failing';

/**
 * The three bucket chips. Each filters the rows below in place; an empty
 * bucket has no rows to show, so its chip cannot be picked.
 */
const buildHealthStats = (counts: HealthCounts, t: TFunction): TopicStat[] => [
  {
    id: 'failing',
    isDisabled: counts.failingCount === 0,
    label: t('message.count-of-total-failing', {
      count: counts.failingCount,
      total: counts.connectedServices,
    }),
    tone: 'critical',
  },
  {
    id: 'healthy',
    isDisabled: counts.healthyServices === 0,
    label: t('message.count-healthy', { count: counts.healthyServices }),
    tone: 'success',
  },
  {
    id: 'not-run',
    isDisabled: counts.pendingServices === 0,
    label: t('message.count-not-run-yet', { count: counts.pendingServices }),
    tone: 'muted',
  },
];

const buildSummary = (
  {
    connectedServices,
    failingCount,
    isError,
    isHealthy,
  }: Pick<HealthCounts, 'connectedServices' | 'failingCount'> & {
    isError: boolean;
    isHealthy: boolean;
  },
  t: TFunction
): string => {
  if (isError) {
    return t('message.something-went-wrong');
  }

  return isHealthy
    ? t('message.all-services-healthy', { count: connectedServices })
    : t('message.services-failing-of-total', {
        count: failingCount,
        total: connectedServices,
      });
};

// When the numbers were read, not when something last failed.
const getFreshness = (
  hasVerdict: boolean,
  dataUpdatedAt: number,
  t: TFunction
): string | undefined =>
  hasVerdict && dataUpdatedAt > 0
    ? t('message.updated-relative', { time: getRelativeTime(dataUpdatedAt) })
    : undefined;

/**
 * No service, no pipeline to judge — so no buckets and no AI read either, only
 * the way to connect one, offered to whoever may.
 */
const getEmptyState = (
  connectedServices: number,
  addService: (() => void) | undefined,
  t: TFunction
): TopicEmptyStateConfig | undefined =>
  connectedServices === 0
    ? {
        action: addService && {
          label: t('label.add-entity', { entity: t('label.service') }),
          onPress: addService,
        },
        description: t('message.platform-health-empty-description'),
        icon: Activity,
        needsSetup: true,
        summary: t('message.platform-health-widget-description'),
        title: t('message.no-services-connected-yet'),
      }
    : undefined;

interface FailingServicesListProps {
  failingCount: number;
  failingServices: FailingService[];
  onOpen: (service: FailingService) => void;
  onViewAll: () => void;
}

interface BucketServicesListProps {
  bucket: QuietHealthFilter;
  count: number;
  services: BucketService[];
  onOpen: (service: BucketService) => void;
  onViewAll: () => void;
}

/** The first few healthy or not-run services, and a way to the rest. */
const BucketServicesList: React.FC<BucketServicesListProps> = ({
  bucket,
  count,
  services,
  onOpen,
  onViewAll,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {services.length > 0 && (
        <ul
          className="tw:mt-2 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="platform-health-rows">
          {services.map((service) => (
            <BucketServiceRow
              bucket={bucket}
              key={service.id}
              service={service}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      {count > MAX_VISIBLE_ROWS && (
        <Button
          className="tw:mt-3 tw:self-start tw:px-0"
          color="link-color"
          data-testid={`view-all-${bucket}-services`}
          size="xs"
          onPress={onViewAll}>
          {t(VIEW_ALL_KEYS[bucket], { count })}
        </Button>
      )}
    </>
  );
};

/** The worst offenders, and a way to the rest when there are more of them. */
const FailingServicesList: React.FC<FailingServicesListProps> = ({
  failingCount,
  failingServices,
  onOpen,
  onViewAll,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {failingServices.length > 0 && (
        <ul
          className="tw:mt-2 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="platform-health-rows">
          {failingServices.slice(0, MAX_VISIBLE_ROWS).map((service) => (
            <FailingServiceRow
              key={service.id}
              service={service}
              onOpen={onOpen}
            />
          ))}
        </ul>
      )}

      {failingCount > MAX_VISIBLE_ROWS && (
        <Button
          className="tw:mt-3 tw:self-start tw:px-0"
          color="link-color"
          data-testid="view-all-failing-services"
          size="xs"
          onPress={onViewAll}>
          {t('message.view-all-count-failing-services', {
            count: failingCount,
          })}
        </Button>
      )}
    </>
  );
};

// Stands in for the rows while a bucket's first page loads.
const BucketRowsSkeleton = () => (
  <div
    className="tw:mt-4 tw:flex tw:flex-col tw:gap-4 tw:py-3"
    data-testid="platform-health-rows-loading">
    {['70%', '55%', '62%'].map((width) => (
      <Skeleton height={14} key={width} width={width} />
    ))}
  </div>
);

/**
 * A healthy or not-run bucket whose read failed. Said outright, with a retry:
 * an empty list under a chip that counts services would read as a contradiction.
 */
const BucketRowsError = ({ onRetry }: { onRetry: () => void }) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:mt-4 tw:flex tw:items-center tw:gap-2 tw:py-3"
      data-testid="platform-health-bucket-error"
      role="alert">
      <Typography className="tw:text-text-tertiary!" size="text-xs">
        {t('server.unexpected-error')}
      </Typography>
      <Button
        color="link-color"
        data-testid="platform-health-bucket-retry"
        size="xs"
        onPress={onRetry}>
        {t('label.retry')}
      </Button>
    </div>
  );
};

interface HealthBucketsProps {
  counts: HealthCounts;
  failingServices: FailingService[];
  goToHealth: (filter: ServiceHealthFilter) => void;
  onOpen: (service: Pick<FailingService, 'fqn' | 'serviceCategory'>) => void;
}

/**
 * The bucket chips and the rows of whichever bucket is picked. The failing
 * rows come with the counts; the healthy and not-run ones are read only once
 * their chip is picked.
 */
const HealthBuckets: React.FC<HealthBucketsProps> = ({
  counts,
  failingServices,
  goToHealth,
  onOpen,
}) => {
  const { t } = useTranslation();
  const stats = useMemo(() => buildHealthStats(counts, t), [counts, t]);
  // Unset until the viewer picks one, so the default follows the counts as
  // they change rather than freezing on the first response.
  const [chosenBucket, setChosenBucket] = useState<ServiceHealthFilter>();
  const bucket = chosenBucket ?? getDefaultBucket(counts);
  const quietBucket = bucket === 'failing' ? undefined : bucket;
  const bucketServices = useBucketServices(quietBucket, MAX_VISIBLE_ROWS);

  const renderRows = () => {
    if (!quietBucket) {
      return (
        <FailingServicesList
          failingCount={counts.failingCount}
          failingServices={failingServices}
          onOpen={onOpen}
          onViewAll={() => goToHealth('failing')}
        />
      );
    }

    if (bucketServices.isError) {
      return <BucketRowsError onRetry={bucketServices.refetch} />;
    }

    return bucketServices.isLoading ? (
      <BucketRowsSkeleton />
    ) : (
      <BucketServicesList
        bucket={quietBucket}
        count={bucketSize(counts, quietBucket)}
        services={bucketServices.services}
        onOpen={onOpen}
        onViewAll={() => goToHealth(quietBucket)}
      />
    );
  };

  return (
    <>
      <TopicStatChips
        label={t('label.platform-health')}
        stats={stats}
        value={BUCKET_TO_CHIP[bucket]}
        onChange={(chip) => setChosenBucket(CHIP_TO_BUCKET[chip])}
      />
      {renderRows()}
    </>
  );
};

export type PlatformHealthWidgetProps = WidgetCommonProps;

/**
 * The card once we know the viewer may read ingestion data.
 *
 * Split out so the permission check happens *before* these hooks mount: a
 * viewer who may not read ingestion pipelines must not issue the request at
 * all rather than issue it and discard the 403.
 */
const PlatformHealthCard: React.FC<PlatformHealthWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const PlatformHealthInsight =
    customizeMyDataPageClassBase.getPlatformHealthInsight();
  const {
    connectedServices,
    dataUpdatedAt,
    failedServices,
    failingServices,
    healthyServices,
    pendingServices,
    warningServices,
    isLoading,
    isError,
    refetch,
  } = useIngestionPipelineStats();
  const { addService, canAddService } = useAddServiceAction('all');

  // The rows are only the worst few; the count is the server's tally.
  const failingCount = failedServices + warningServices;
  // No verdict without data: an error must not read as "Needs attention" over
  // a row of zeros, nor as healthy.
  const hasVerdict = !isLoading && !isError;
  const isHealthy = hasVerdict && failingCount === 0;

  // Only the Connections listing reads `health`; the classic Settings >
  // Services page ignores it, so a filter appended there would promise a
  // filtered list and show the unfiltered category menu instead.
  const goToHealth = useCallback(
    (filter: ServiceHealthFilter): void => {
      const servicesPath = connectionsRouterClassBase.getSettingsServicesPath();

      navigate(
        connectionsRouterClassBase.isEmbeddedMode()
          ? `${servicesPath}?${HEALTH_PARAM}=${filter}`
          : servicesPath
      );
    },
    [navigate]
  );

  const openService = useCallback(
    (service: Pick<FailingService, 'fqn' | 'serviceCategory'>): void => {
      navigate(
        connectionsRouterClassBase.getServiceDetailsPath(
          service.serviceCategory,
          service.fqn,
          EntityTabs.AGENTS
        )
      );
    },
    [navigate]
  );

  const counts = useMemo<HealthCounts>(
    () => ({
      connectedServices,
      failingCount,
      healthyServices,
      pendingServices,
    }),
    [connectedServices, failingCount, healthyServices, pendingServices]
  );

  const summary = buildSummary(
    { connectedServices, failingCount, isError, isHealthy },
    t
  );
  const emptyState = getEmptyState(
    connectedServices,
    canAddService ? addService : undefined,
    t
  );

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.ingestion') }),
        onPress: () =>
          navigate(connectionsRouterClassBase.getSettingsServicesPath()),
      }}
      bodyClassName={classNames(TOPIC_FILTERED_BODY_CLASSES, 'tw:pb-3')}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isLoading={isLoading}
      meta={getFreshness(hasVerdict, dataUpdatedAt, t)}
      status={
        hasVerdict && !isHealthy
          ? { color: 'error', label: t('label.needs-attention') }
          : undefined
      }
      summary={summary}
      title={t('label.platform-health')}
      tone={TONE}
      topicKey={TopicKey.PLATFORM_HEALTH}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!isError && !emptyState && (
        <HealthBuckets
          counts={counts}
          failingServices={failingServices}
          goToHealth={goToHealth}
          onOpen={openService}
        />
      )}

      {PlatformHealthInsight && !emptyState && (
        <PlatformHealthInsight
          connectedServices={connectedServices}
          failedServices={failedServices}
          failingServices={failingServices}
          healthyServices={healthyServices}
          isError={isError}
          isHealthy={isHealthy}
          isLoading={isLoading}
          pendingServices={pendingServices}
          warningServices={warningServices}
        />
      )}
    </TopicCard>
  );
};

/**
 * Ingestion health as a topic card: the three service buckets, the worst
 * offenders, and the deployment's read on what they have in common.
 *
 * The persona layout decides whether this card is on the page; this decides
 * whether the viewer may see inside it.
 */
const PlatformHealthWidget: React.FC<PlatformHealthWidgetProps> = (props) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  // The card is a view onto ingestion pipelines, so it opens to whoever may
  // view them, not only to admins.
  const { hasViewAccess } = getDerivedPermissionFlags(
    permissions?.[ResourceEntity.INGESTION_PIPELINE] ??
      DEFAULT_ENTITY_PERMISSION
  );

  if (!hasViewAccess) {
    return (
      <TopicCard
        handleRemoveWidget={props.handleRemoveWidget}
        isEditView={props.isEditView}
        summary={t('message.no-permission-to-view')}
        title={t('label.platform-health')}
        tone={TONE}
        topicKey={TopicKey.PLATFORM_HEALTH}
        widgetKey={props.widgetKey}
      />
    );
  }

  return <PlatformHealthCard {...props} />;
};

export default PlatformHealthWidget;
