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

import { Button } from '@openmetadata/ui-core-components';
import { DataHealthScore } from '@openmetadata/ui-core-components/icons';
import type { TFunction } from 'i18next';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HEALTH_PARAM } from '../../../../components/integration/ConnectionsPage/ConnectionsPage.constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityTabs } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import connectionsRouterClassBase from '../../../../utils/ConnectionsRouterClassBase';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import FailingServiceRow from '../Common/TopicWidget/FailingServiceRow';
import TopicCard from '../Common/TopicWidget/TopicCard';
import { TopicKey } from '../Common/TopicWidget/topics.types';
import TopicStatChips, {
  TopicStat,
} from '../Common/TopicWidget/TopicStatChips';
import {
  FailingService,
  ServiceHealthFilter,
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

/**
 * The three bucket chips. A bucket is only clickable when it has something in
 * it — a link to an empty filtered list is a dead end.
 */
const buildHealthStats = (
  {
    connectedServices,
    failingCount,
    healthyServices,
    pendingServices,
  }: HealthCounts,
  goToHealth: (filter: ServiceHealthFilter) => void,
  t: TFunction
): TopicStat[] => [
  {
    id: 'failing',
    label: t('message.count-of-total-failing', {
      count: failingCount,
      total: connectedServices,
    }),
    onPress: failingCount > 0 ? () => goToHealth('failing') : undefined,
    tone: 'critical',
  },
  {
    id: 'healthy',
    label: t('message.count-healthy', { count: healthyServices }),
    onPress: healthyServices > 0 ? () => goToHealth('healthy') : undefined,
    tone: 'success',
  },
  {
    id: 'not-run',
    label: t('message.count-not-run-yet', { count: pendingServices }),
    onPress: pendingServices > 0 ? () => goToHealth('notRun') : undefined,
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

interface FailingServicesListProps {
  failingCount: number;
  failingServices: FailingService[];
  onOpen: (service: FailingService) => void;
  onViewAll: () => void;
}

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
          className="tw:mt-4 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
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
          size="sm"
          onPress={onViewAll}>
          {t('message.view-all-count-failing-services', {
            count: failingCount,
          })}
        </Button>
      )}
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
    (service: FailingService): void => {
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

  const stats = useMemo<TopicStat[]>(
    () =>
      buildHealthStats(
        {
          connectedServices,
          failingCount,
          healthyServices,
          pendingServices,
        },
        goToHealth,
        t
      ),
    [
      failingCount,
      connectedServices,
      healthyServices,
      pendingServices,
      goToHealth,
      t,
    ]
  );

  const summary = buildSummary(
    { connectedServices, failingCount, isError, isHealthy },
    t
  );

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.ingestion') }),
        onPress: () =>
          navigate(connectionsRouterClassBase.getSettingsServicesPath()),
      }}
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
      {!isError && (
        <>
          <TopicStatChips stats={stats} />
          <FailingServicesList
            failingCount={failingCount}
            failingServices={failingServices}
            onOpen={openService}
            onViewAll={() => goToHealth('failing')}
          />
        </>
      )}

      {PlatformHealthInsight && (
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
