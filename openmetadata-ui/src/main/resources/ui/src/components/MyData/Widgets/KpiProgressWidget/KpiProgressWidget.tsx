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
  Calendar,
  RankingDetails,
  Target04,
} from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import {
  KpiWindow,
  KPI_ALL_TIME,
  KPI_WINDOW_DAYS,
  KPI_WINDOW_OPTIONS,
  useKpiProgress,
} from '../../../../hooks/useKpiProgress';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import FilterButton from '../Common/TopicWidget/FilterButton';
import KpiProgressRow from '../Common/TopicWidget/KpiProgressRow';
import TopicCard from '../Common/TopicWidget/TopicCard';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';

const TONE = {
  icon: RankingDetails,
  tile: 'tw:bg-utility-warning-50 tw:text-utility-warning-600',
};

export type KpiProgressWidgetProps = WidgetCommonProps;

/** Governance targets, their pace, and whether that pace gets there in time. */
const KpiProgressWidget: React.FC<KpiProgressWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [range, setRange] = useState<KpiWindow>(KPI_WINDOW_DAYS);
  const { kpis, atRiskCount, isError, isFetching, isLoading, refetch } =
    useKpiProgress(range);
  const { permissions } = usePermissionProvider();
  const { canCreate } = getDerivedPermissionFlags(
    permissions?.[ResourceEntity.KPI] ?? DEFAULT_ENTITY_PERMISSION
  );

  const windowOptions = useMemo(
    () =>
      KPI_WINDOW_OPTIONS.map((option) => ({
        label:
          option === KPI_ALL_TIME
            ? t('label.all-time')
            : t('label.last-n-days', { count: option }),
        value: String(option),
      })),
    [t]
  );

  const summary = t('message.count-kpis-tracked', { count: kpis.length });

  // The KPI list ignores the range — only each KPI's series follows it — so an
  // empty list means none are defined, not none in this window.
  const emptyState: TopicEmptyStateConfig | undefined =
    kpis.length === 0
      ? {
          action: canCreate
            ? {
                label: t('label.create-entity', {
                  entity: t('label.kpi-uppercase'),
                }),
                onPress: () => navigate(ROUTES.ADD_KPI),
              }
            : undefined,
          description: t('message.kpi-empty-description'),
          icon: Target04,
          needsSetup: true,
          summary: t('message.kpi-widget-description'),
          title: t('message.no-kpis-yet'),
        }
      : undefined;

  return (
    <TopicCard
      action={{
        label: t('label.manage-entity', {
          entity: t('label.kpi-uppercase-plural'),
        }),
        onPress: () => navigate(ROUTES.KPI_LIST),
      }}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      status={
        atRiskCount > 0
          ? {
              color: 'warning',
              label: t('message.count-at-risk', { count: atRiskCount }),
            }
          : undefined
      }
      summary={summary}
      title={t('label.kpi-title')}
      tone={TONE}
      topicKey={TopicKey.KPIS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!emptyState && (
        <>
          <div className="tw:mb-3 tw:flex tw:justify-end">
            <FilterButton
              iconLeading={Calendar}
              label={t('label.range')}
              options={windowOptions}
              testId="kpi-window-filter"
              value={String(range)}
              onChange={(next) =>
                setRange(next === KPI_ALL_TIME ? KPI_ALL_TIME : Number(next))
              }
            />
          </div>
          <ul
            className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
            data-testid="kpi-rows">
            {kpis.map((kpi) => (
              <KpiProgressRow key={kpi.id} kpi={kpi} />
            ))}
          </ul>
        </>
      )}
    </TopicCard>
  );
};

export default KpiProgressWidget;
