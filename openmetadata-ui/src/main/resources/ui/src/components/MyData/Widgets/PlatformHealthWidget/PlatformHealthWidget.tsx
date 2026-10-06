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
import { EntityTabs } from '../../../../enums/entity.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import connectionsRouterClassBase from '../../../../utils/ConnectionsRouterClassBase';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
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
  failingServices: FailingService[];
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
    failingServices,
    healthyServices,
    pendingServices,
  }: HealthCounts,
  goToHealth: (filter: ServiceHealthFilter) => void,
  t: TFunction
): TopicStat[] => [
  {
    id: 'failing',
    label: t('message.count-of-total-failing', {
      count: failingServices.length,
      total: connectedServices,
    }),
    onPress:
      failingServices.length > 0 ? () => goToHealth('failing') : undefined,
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

export type PlatformHealthWidgetProps = WidgetCommonProps;

/**
 * The card once we know the viewer may read ingestion data.
 *
 * Split out so the admin check happens *before* these hooks mount: every
 * endpoint behind the stats is admin-only, so a non-admin must not issue the
 * request at all rather than issue it and discard the 403.
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
    failedServices,
    failingServices,
    healthyServices,
    pendingServices,
    isLoading,
    isError,
  } = useIngestionPipelineStats();

  const isHealthy = !isLoading && !isError && failingServices.length === 0;

  const goToHealth = useCallback(
    (filter: ServiceHealthFilter): void => {
      navigate(
        `${connectionsRouterClassBase.getSettingsServicesPath()}?${HEALTH_PARAM}=${filter}`
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
          failingServices,
          healthyServices,
          pendingServices,
        },
        goToHealth,
        t
      ),
    [
      failingServices,
      connectedServices,
      healthyServices,
      pendingServices,
      goToHealth,
      t,
    ]
  );

  const summary = isHealthy
    ? t('message.all-services-healthy', { count: connectedServices })
    : t('message.services-failing-of-total', {
        count: failingServices.length,
        total: connectedServices,
      });
  const lastRunTs = failingServices[0]?.lastRunTs;

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.ingestion') }),
        onPress: () =>
          navigate(connectionsRouterClassBase.getSettingsServicesPath()),
      }}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isLoading={isLoading}
      meta={
        lastRunTs
          ? t('message.updated-relative', { time: getRelativeTime(lastRunTs) })
          : undefined
      }
      status={
        isHealthy
          ? undefined
          : { color: 'error', label: t('label.needs-attention') }
      }
      summary={summary}
      title={t('label.platform-health')}
      tone={TONE}
      topicKey={TopicKey.PLATFORM_HEALTH}
      widgetKey={widgetKey}>
      <TopicStatChips stats={stats} />

      {failingServices.length > 0 && (
        <ul
          className="tw:mt-4 tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
          data-testid="platform-health-rows">
          {failingServices.slice(0, MAX_VISIBLE_ROWS).map((service) => (
            <FailingServiceRow
              key={service.id}
              service={service}
              onOpen={openService}
            />
          ))}
        </ul>
      )}

      {failingServices.length > MAX_VISIBLE_ROWS && (
        <Button
          className="tw:mt-3 tw:self-start tw:px-0"
          color="link-color"
          data-testid="view-all-failing-services"
          size="sm"
          onPress={() => goToHealth('failing')}>
          {t('message.view-all-count-failing-services', {
            count: failingServices.length,
          })}
        </Button>
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
  const isAdmin = Boolean(
    useApplicationStore((state) => state.currentUser)?.isAdmin
  );

  if (!isAdmin) {
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
